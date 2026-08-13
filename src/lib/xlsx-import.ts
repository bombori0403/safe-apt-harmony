import * as XLSX from "xlsx";
import { scoreToRiskLevel, RISK_LEVELS, type RiskLevel } from "@/lib/types";

export interface ImportRow {
  description: string;
  proc?: string;        // 작업공정명(대분류)
  sub?: string;         // 세부작업내용(중분류)
  legalBasis?: string;  // 관련근거(법적기준) 전문
  article?: string;     // 제N조
  likelihood?: number;  // 가능성(빈도)
  severity?: number;    // 중대성(강도)
  level?: RiskLevel;    // 현재 위험성 등급
  measure?: string;     // 위험성 감소대책
  dueDate?: string;     // 개선예정일 (YYYY-MM-DD)
  done?: boolean;       // 개선여부/완료
}

export interface ParsedSheet {
  sheetName: string;
  method: "빈도강도법" | "3단계_판단법";
  rows: ImportRow[];
}

const norm = (v: any) => (v == null ? "" : String(v).replace(/\s+/g, "").toLowerCase());
const txt = (v: any) => (v == null ? "" : String(v).replace(/\s+/g, " ").trim());

function toNum(v: any): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

function toDate(v: any): string | undefined {
  if (v == null || v === "") return undefined;
  if (v instanceof Date) {
    // 로컬 날짜 구성요소로 포맷 — toISOString(UTC 변환)은 KST에서 하루 당겨지는 버그.
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(v);
  const m = s.match(/(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return undefined;
}

function levelFrom상중하(v: string): RiskLevel | undefined {
  const s = v.trim();
  if (s === "상") return "매우높음";
  if (s === "중") return "보통";
  if (s === "하") return "낮음";
  return undefined;
}

// 한 시트를 표준서식으로 파싱. 헤더 행을 자동 탐지하고 키워드로 열을 매핑한다.
export function parseStandardSheet(ws: XLSX.WorkSheet, sheetName: string): ParsedSheet | null {
  const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
  if (!aoa.length) return null;

  const KW = {
    proc: ["작업공정", "대분류"],
    sub: ["세부작업", "중분류"],
    desc: ["위험발생", "발생상황"],
    legal: ["관련근거", "법적"],
    like: ["가능성", "빈도"],
    sev: ["중대성", "강도"],
    measure: ["감소대책"],
    due: ["개선예정", "예정일"],
    done: ["개선여부", "완료여부", "이행결과"],
    cur: ["현재위험성", "위험성"],
  };
  const hit = (sig: string, kws: string[]) => kws.some((k) => sig.includes(k));

  // 헤더행 탐지: 0~14행 중 키워드가 가장 많이 걸리는 행
  let headerRow = -1, best = 0;
  for (let r = 0; r < Math.min(aoa.length, 14); r++) {
    const sig = (aoa[r] || []).map(norm).join("|");
    let score = 0;
    for (const kws of Object.values(KW)) if (kws.some((k) => sig.includes(k))) score++;
    if (score > best) { best = score; headerRow = r; }
  }
  if (headerRow < 0 || best < 3) return null;

  // 열 시그니처: 헤더행 ±1행을 합쳐 다줄 헤더 대응
  const ncol = Math.max(...aoa.slice(headerRow, headerRow + 2).map((r) => (r ? r.length : 0)));
  const colSig: string[] = [];
  for (let c = 0; c < ncol; c++) {
    let s = "";
    for (let r = headerRow - 1; r <= headerRow + 1; r++) if (aoa[r]) s += norm(aoa[r][c]);
    colSig[c] = s;
  }
  const findCol = (kws: string[], exclude: string[] = []) =>
    colSig.findIndex((s) => hit(s, kws) && !exclude.some((e) => s.includes(e)));

  // 유해·위험요인 설명: '위험발생상황' 열 우선, 없으면 '유해'(단 위험분류/원인물 열 제외)
  let descCol = findCol(KW.desc, ["위험분류"]);
  if (descCol < 0) descCol = findCol(["유해"], ["위험분류", "원인물"]);
  const col = {
    proc: findCol(KW.proc),
    sub: findCol(KW.sub),
    desc: descCol,
    legal: findCol(KW.legal),
    like: findCol(KW.like),
    sev: findCol(KW.sev),
    measure: findCol(KW.measure, ["연번", "이행", "구분", "결과"]),  // 감소대책 '연번/이행결과/구분' 열 제외
    due: findCol(KW.due),
    done: findCol(KW.done),
  };
  if (col.desc < 0) return null;

  // 현재위험성 열: 가능성/중대성이 있으면 빈도강도법, 없으면 상/중/하 열 탐색
  const method: ParsedSheet["method"] = col.like >= 0 && col.sev >= 0 ? "빈도강도법" : "3단계_판단법";
  // 위험성(등급) 열 후보: '위험성' 포함하되 '감소대책' 아닌 열, 가능성/중대성 열 이후
  let riskCol = -1;
  for (let c = 0; c < ncol; c++) {
    const s = colSig[c];
    if (s.includes("위험성") && !s.includes("감소") && !s.includes("가능성") && !s.includes("중대성")) {
      if (c > Math.max(col.like, col.sev)) { riskCol = c; break; }
      if (riskCol < 0) riskCol = c;
    }
  }

  const rows: ImportRow[] = [];
  for (let r = headerRow + 1; r < aoa.length; r++) {
    const row = aoa[r]; if (!row) continue;
    const desc = txt(row[col.desc]);
    if (!desc || desc.length < 5) continue;
    // 헤더 잔여행만 스킵. "유해" 부분일치는 실제 위험요인("유해가스 중독" 등)까지 버리므로 헤더 문구 전체로 매칭
    if (hit(norm(desc), ["유해·위험요인", "유해위험요인", "위험발생상황"])) continue;

    const legal = col.legal >= 0 ? txt(row[col.legal]) : "";
    const am = legal.match(/제\s*(\d+)\s*조/);
    const like = col.like >= 0 ? toNum(row[col.like]) : undefined;
    const sev = col.sev >= 0 ? toNum(row[col.sev]) : undefined;
    let level: RiskLevel | undefined;
    if (method === "빈도강도법" && like && sev) level = scoreToRiskLevel(like * sev);
    else if (riskCol >= 0) level = levelFrom상중하(txt(row[riskCol]));

    // "개선여부": '완료/이행/○'은 완료, 단 '미완료/미이행' 등 '미'로 시작하면 미완료로 처리
    const doneVal = col.done >= 0 ? txt(row[col.done]) : "";
    const isDone = !doneVal.startsWith("미") && /완료|이행|^[oO○]$/.test(doneVal);
    rows.push({
      description: desc,
      proc: col.proc >= 0 ? txt(row[col.proc]) : undefined,
      sub: col.sub >= 0 ? txt(row[col.sub]) : undefined,
      legalBasis: legal || undefined,
      article: am ? `제${am[1]}조` : undefined,
      likelihood: like,
      severity: sev,
      level,
      measure: col.measure >= 0 ? txt(row[col.measure]) || undefined : undefined,
      dueDate: col.due >= 0 ? toDate(row[col.due]) : undefined,
      done: isDone,
    });
  }
  if (!rows.length) return null;
  return { sheetName, method, rows };
}

// ─────────────────────────────────────────────────────────────────────────
// 표준서식(e-KRAS 6시트) 전체 가져오기
// 1-1 재검토 · 1-2 위험성결정(신규) = 위험요인 시트, 2-1/2-2 감소대책 = 대책 시트.
// 대책 시트의 '위험발생 상황 및 결과' 텍스트로 위험요인 시트와 이어붙여
// 현재조치·현재위험성·감소대책·개선예정일·담당자까지 한 번에 복원한다.
// ─────────────────────────────────────────────────────────────────────────

export interface StdMeasureRow { content: string; dueDate?: string; responsible?: string; done?: boolean; }
export interface StdHazardRow {
  origin: "carryover" | "new";
  description: string;
  processName?: string;        // 작업공정명(대분류)
  currentControl?: string;
  legalBasis?: string;
  level?: RiskLevel;           // 현재 위험성(상/중/하 → 매핑)
  postLevel?: RiskLevel;       // 대책 후 위험성(3-1 이행확인)
  measures: StdMeasureRow[];
}
export interface StdFormResult {
  hazards: StdHazardRow[];
  carryover: number;           // 재검토(과년도) 건수
  neu: number;                 // 신규 건수
  measures: number;            // 감소대책 건수
}

const inc = (s: string, kws: string[]) => kws.some((k) => s.includes(k));

// 시트명으로 역할 판별: 이행확인=이행결과 시트, 감소대책=대책시트, 재검토/신규(결정)=위험요인 시트.
function stdRole(name: string): { kind: "hazard" | "measure" | "confirm"; origin: "carryover" | "new" } | null {
  const n = name.replace(/\s/g, "");
  if (n.includes("이행") && !n.includes("사진")) return { kind: "confirm", origin: "new" }; // 3-1(사진대지 3-2 제외)
  const isMeasure = n.includes("감소대책");
  const carry = n.includes("재검토");
  const neu = n.includes("신규");
  if (isMeasure && (carry || neu)) return { kind: "measure", origin: carry ? "carryover" : "new" };
  if (!isMeasure && (carry || (neu && n.includes("결정")))) return { kind: "hazard", origin: carry ? "carryover" : "new" };
  return null;
}

// 헤더행 탐지 + 열 시그니처 계산(표준서식은 다줄 헤더라 headerRow±2를 합침).
function analyzeStdSheet(ws: XLSX.WorkSheet) {
  const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
  if (!aoa.length) return null;
  const anchors = ["위험발생", "유해위험요인", "유해·위험요인", "관련근거", "현재위험성", "위험성감소대책"];
  let headerRow = -1, best = 0;
  for (let r = 0; r < Math.min(aoa.length, 16); r++) {
    const sig = (aoa[r] || []).map(norm).join("|");
    let score = 0;
    for (const a of anchors) if (sig.includes(a)) score++;
    if (score > best) { best = score; headerRow = r; }
  }
  if (headerRow < 0 || best < 2) return null;
  const ncol = Math.max(...aoa.slice(headerRow, headerRow + 2).map((r) => (r ? r.length : 0)));
  const colSig: string[] = [];
  for (let c = 0; c < ncol; c++) {
    let s = "";
    for (let r = headerRow - 1; r <= headerRow + 2; r++) if (aoa[r]) s += norm(aoa[r][c]);
    colSig[c] = s;
  }
  const find = (kws: string[], exc: string[] = []) =>
    colSig.findIndex((s) => inc(s, kws) && !exc.some((e) => s.includes(e)));
  return { aoa, headerRow, find };
}

// 위험요인 목록에서 origin+위험발생상황으로 매칭. 정확 매칭 실패 시 부분일치(문구 편집·표기차 허용).
function findHazardByDesc(
  hazards: StdHazardRow[], byDesc: Map<string, StdHazardRow>,
  origin: "carryover" | "new", desc: string,
): StdHazardRow | null {
  const nd = norm(desc);
  const exact = byDesc.get(origin + " " + nd);
  if (exact) return exact;
  if (nd.length < 8) return null;
  const pre = nd.slice(0, 14);
  for (const c of hazards) {
    if (c.origin !== origin) continue;
    const cn = norm(c.description);
    if (cn.length < 8) continue;
    const ratio = Math.min(cn.length, nd.length) / Math.max(cn.length, nd.length);
    if (cn.slice(0, 14) === pre && ratio >= 0.55) return c;             // 앞부분 일치(끝부분 편집 허용)
    if (ratio >= 0.7 && (cn.includes(nd) || nd.includes(cn))) return c; // 포함 관계
  }
  return null;
}

export function parseStandardForm(buf: ArrayBuffer): StdFormResult | null {
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const roles = wb.SheetNames.map((n) => ({ n, role: stdRole(n) })).filter((x) => x.role);
  if (!roles.length) return null;

  const hazards: StdHazardRow[] = [];
  const byDesc = new Map<string, StdHazardRow>();
  // 다줄 헤더(주제목행/부제목행)에서 데이터 시작을 headerRow+1로 잡되, 남은 헤더/부제목 셀은 걸러낸다.
  // 짧은 라벨은 정확일치, 긴 헤더 문구는 앞부분 일치로만(실제 위험요인 문장이 잘못 걸리지 않게).
  const HEADER_CELLS = new Set([
    "위험분류", "현재위험성", "대책전위험성", "위험성", "위험성감소대책", "감소대책연번",
    "안전보건조치", "현재의안전보건조치", "과년도", "관련근거", "관련근거법적근거", "법적근거",
    "담당자", "개선예정일", "작업공정명", "세부작업내용", "연번", "구분", "완료여부", "현재",
  ]);
  const skipHeader = (d: string) => {
    const nd = norm(d);
    return HEADER_CELLS.has(nd) || nd.startsWith("위험발생상황") || nd.startsWith("유해위험요인") || nd.startsWith("유해·위험요인");
  };

  // 1) 위험요인 시트(1-1 재검토 / 1-2 신규)
  for (const { n, role } of roles) {
    if (role!.kind !== "hazard") continue;
    const A = analyzeStdSheet(wb.Sheets[n]); if (!A) continue;
    let descCol = A.find(["위험발생"], ["위험분류"]);
    if (descCol < 0) descCol = A.find(["유해위험요인", "유해·위험요인"], ["위험분류"]);
    const procCol = A.find(["작업공정", "대분류"]);
    const legalCol = A.find(["관련근거", "법적"]);
    const ctrlCol = A.find(["현재의안전보건조치"]);
    const riskCol = A.find(["현재위험성"]);
    if (descCol < 0) continue;
    for (let r = A.headerRow + 1; r < A.aoa.length; r++) {
      const row = A.aoa[r]; if (!row) continue;
      const desc = txt(row[descCol]);
      if (!desc || desc.length < 4 || skipHeader(desc)) continue;
      const h: StdHazardRow = {
        origin: role!.origin,
        description: desc,
        processName: procCol >= 0 ? txt(row[procCol]) || undefined : undefined,
        currentControl: ctrlCol >= 0 ? txt(row[ctrlCol]) || undefined : undefined,
        legalBasis: legalCol >= 0 ? txt(row[legalCol]) || undefined : undefined,
        level: riskCol >= 0 ? levelFrom상중하(txt(row[riskCol])) : undefined,
        measures: [],
      };
      hazards.push(h);
      const k = role!.origin + " " + norm(desc);
      if (!byDesc.has(k)) byDesc.set(k, h);
    }
  }

  // 2) 감소대책 시트(2-1 재검토 / 2-2 신규) — 위험발생상황 텍스트로 위험요인에 이어붙임
  let mcount = 0;
  for (const { n, role } of roles) {
    if (role!.kind !== "measure") continue;
    const A = analyzeStdSheet(wb.Sheets[n]); if (!A) continue;
    let descCol = A.find(["위험발생"], ["위험분류"]);
    if (descCol < 0) descCol = A.find(["유해위험요인", "유해·위험요인"], ["위험분류"]);
    const measCol = A.find(["위험성감소대책"]);
    const dueCol = A.find(["개선예정", "예정일"]);
    const respCol = A.find(["담당자"]);
    if (measCol < 0 || descCol < 0) continue;
    for (let r = A.headerRow + 1; r < A.aoa.length; r++) {
      const row = A.aoa[r]; if (!row) continue;
      const content = txt(row[measCol]);
      const desc = txt(row[descCol]);
      if (!content || !desc || desc.length < 4 || skipHeader(desc)) continue;
      // 위험요인 시트(1-1/1-2)에 이미 있는 항목에만 대책을 이어붙인다. 새 위험요인은 만들지 않는다
      // — 감소대책 시트의 위험발생상황 문구가 조금 달라도 중복(신규 건수 부풀림)이 생기지 않게.
      // origin(재검토/신규)까지 맞춰 정확 매칭 → 실패 시 유사(부분일치) 매칭.
      const h = findHazardByDesc(hazards, byDesc, role!.origin, desc);
      if (!h) continue;   // 매칭되는 위험요인이 없으면 건너뜀(중복 위험요인 생성 방지)
      h.measures.push({
        content,
        dueDate: dueCol >= 0 ? toDate(row[dueCol]) : undefined,
        responsible: respCol >= 0 ? txt(row[respCol]) || undefined : undefined,
      });
      mcount++;
    }
  }

  // 3) 이행확인 시트(3-1) — 대책 후 위험성·완료여부를 위험요인에 채운다(대책은 2-x에서 이미 붙음).
  for (const { n, role } of roles) {
    if (role!.kind !== "confirm") continue;
    const A = analyzeStdSheet(wb.Sheets[n]); if (!A) continue;
    let descCol = A.find(["위험발생"], ["위험분류"]);
    if (descCol < 0) descCol = A.find(["유해위험요인", "유해·위험요인"], ["위험분류"]);
    const postCol = A.find(["현재위험성"]);        // '감소대책 이행결과 > 현재 위험성' = 대책 후
    // '완료 여부' 열 — '감소대책 이행결과'(대책 내용)와 겹치지 않게 제외.
    const doneCol = A.find(["완료여부", "이행여부", "개선완료", "완료"], ["감소대책", "이행결과", "예정일"]);
    const gubunCol = A.find(["구분"]);
    if (descCol < 0 || (postCol < 0 && doneCol < 0)) continue;  // 3-2 사진대지 등은 여기서 걸러짐
    for (let r = A.headerRow + 1; r < A.aoa.length; r++) {
      const row = A.aoa[r]; if (!row) continue;
      const desc = txt(row[descCol]);
      if (!desc || desc.length < 4 || skipHeader(desc)) continue;
      const gubun = gubunCol >= 0 ? txt(row[gubunCol]) : "";
      const rowOrigin: "carryover" | "new" = gubun.includes("재검토") ? "carryover" : "new";
      let h = findHazardByDesc(hazards, byDesc, rowOrigin, desc);
      if (!h) h = findHazardByDesc(hazards, byDesc, rowOrigin === "carryover" ? "new" : "carryover", desc);
      if (!h) continue;
      if (postCol >= 0) {
        const pl = levelFrom상중하(txt(row[postCol]));
        if (pl) h.postLevel = pl;
      }
      if (doneCol >= 0) {
        const dv = txt(row[doneCol]);
        const done = !!dv && !dv.startsWith("미") && /완료|이행|^[oO○]$/.test(dv);
        if (done) h.measures.forEach((m) => (m.done = true));
      }
    }
  }

  if (!hazards.length) return null;
  return {
    hazards,
    carryover: hazards.filter((h) => h.origin === "carryover").length,
    neu: hazards.filter((h) => h.origin === "new").length,
    measures: mcount,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// 직접 열 매핑(임의 서식 대응)
// 표준서식이 아니어도, 어떤 엑셀이든 열 목록을 뽑아 사용자가 항목↔열을 짝짓게 한다.
// ─────────────────────────────────────────────────────────────────────────

export interface MapColumn { index: number; label: string; samples: string[]; }
export interface MapSheet { sheetName: string; headerRow: number; columns: MapColumn[]; rows: any[][]; }

// 매핑 대상 항목(앱 필드). description만 필수.
export const MAP_FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: "description", label: "위험발생상황 (유해·위험요인)", required: true },
  { key: "proc", label: "작업공정명" },
  { key: "legalBasis", label: "관련근거 (법적기준)" },
  { key: "current_control", label: "현재의 안전보건조치" },
  { key: "level", label: "현재 위험성 (상/중/하)" },
  { key: "measure", label: "위험성 감소대책" },
  { key: "dueDate", label: "개선 예정일" },
  { key: "responsible", label: "담당자" },
];

function colLetter(n: number): string {
  let s = "";
  n += 1;
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

// 아무 엑셀이나 시트별로 헤더행(비어있지 않은 셀이 가장 많은 행)을 추정해 열/샘플/데이터를 뽑는다.
export function readWorkbookForMapping(buf: ArrayBuffer): { sheetNames: string[]; sheets: MapSheet[] } {
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheets: MapSheet[] = [];
  for (const name of wb.SheetNames) {
    const aoa: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, blankrows: false });
    if (!aoa.length) continue;
    let hr = 0, best = -1;
    for (let r = 0; r < Math.min(aoa.length, 12); r++) {
      const cnt = (aoa[r] || []).filter((c) => c != null && String(c).trim() !== "").length;
      if (cnt > best) { best = cnt; hr = r; }
    }
    const ncol = Math.max(...aoa.map((r) => (r ? r.length : 0)));
    const columns: MapColumn[] = [];
    for (let c = 0; c < ncol; c++) {
      const label = txt(aoa[hr]?.[c]) || `열 ${colLetter(c)}`;
      const samples: string[] = [];
      for (let r = hr + 1; r < aoa.length && samples.length < 3; r++) {
        const v = txt(aoa[r]?.[c]);
        if (v) samples.push(v.length > 24 ? v.slice(0, 24) + "…" : v);
      }
      columns.push({ index: c, label: label.length > 30 ? label.slice(0, 30) + "…" : label, samples });
    }
    const rows = aoa.slice(hr + 1);
    if (rows.length) sheets.push({ sheetName: name, headerRow: hr, columns, rows });
  }
  return { sheetNames: wb.SheetNames, sheets };
}

// 열 제목 키워드로 항목별 열을 자동 추측(사용자가 확인·수정). 한 열은 한 항목에만.
const MAP_GUESS: Record<string, string[]> = {
  description: ["위험발생", "유해위험요인", "유해·위험요인", "위험요인", "작업내용", "위험내용"],
  proc: ["작업공정", "공정명", "작업명"],
  legalBasis: ["관련근거", "법적", "법규", "근거"],
  current_control: ["현재의안전보건조치", "현재조치", "안전보건조치", "조치사항", "기존조치"],
  level: ["현재위험성", "위험성", "위험도", "등급"],
  measure: ["위험성감소대책", "감소대책", "개선대책", "대책", "조치계획"],
  dueDate: ["개선예정", "예정일", "완료예정", "개선일", "조치일", "이행일"],
  responsible: ["담당자", "책임자", "조치자", "담당"],
};

export function guessMapping(columns: MapColumn[]): Record<string, number> {
  const used = new Set<number>();
  const out: Record<string, number> = {};
  for (const [field, kws] of Object.entries(MAP_GUESS)) {
    let found = -1;
    for (const col of columns) {
      if (used.has(col.index)) continue;
      if (inc(norm(col.label), kws)) { found = col.index; break; }
    }
    out[field] = found;
    if (found >= 0) used.add(found);
  }
  for (const f of MAP_FIELDS) if (!(f.key in out)) out[f.key] = -1;
  return out;
}

// 셀 값 → 위험성 등급(상/중/하, 등급 텍스트, 적정/보완, 1~25 점수 모두 대응).
export function levelFromCell(v: any): RiskLevel | undefined {
  const s = txt(v);
  if (!s) return undefined;
  const l3 = levelFrom상중하(s); if (l3) return l3;
  if ((RISK_LEVELS as string[]).includes(s)) return s as RiskLevel;
  if (s.includes("적정")) return "낮음";
  if (s.includes("보완")) return "높음";
  const n = Number(s.replace(/[^0-9.]/g, ""));
  if (Number.isFinite(n) && n > 0 && n <= 25) return scoreToRiskLevel(n);
  return undefined;
}

// 매핑에 따라 시트 데이터를 위험요인(+감소대책) 목록으로 변환.
export function rowsFromMapping(ms: MapSheet, mapping: Record<string, number>, origin: "carryover" | "new"): StdHazardRow[] {
  const g = (r: any[], k: string) => { const i = mapping[k]; return i != null && i >= 0 ? txt(r[i]) : ""; };
  const out: StdHazardRow[] = [];
  for (const r of ms.rows) {
    const desc = g(r, "description");
    if (!desc || desc.length < 2 || skipHeaderText(desc)) continue;
    const content = g(r, "measure");
    const dueIdx = mapping.dueDate;
    out.push({
      origin,
      description: desc,
      processName: g(r, "proc") || undefined,
      currentControl: g(r, "current_control") || undefined,
      legalBasis: g(r, "legalBasis") || undefined,
      level: mapping.level != null && mapping.level >= 0 ? levelFromCell(r[mapping.level]) : undefined,
      measures: content ? [{
        content,
        dueDate: dueIdx != null && dueIdx >= 0 ? toDate(r[dueIdx]) : undefined,
        responsible: g(r, "responsible") || undefined,
      }] : [],
    });
  }
  return out;
}

const skipHeaderText = (d: string) => inc(norm(d), ["위험발생상황", "유해위험요인", "유해·위험요인"]);

// 파일 전체를 읽어 파싱 가능한 시트 목록을 돌려준다.
export async function parseWorkbook(buf: ArrayBuffer): Promise<{ all: string[]; parsed: ParsedSheet[] }> {
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const parsed: ParsedSheet[] = [];
  for (const name of wb.SheetNames) {
    try {
      const p = parseStandardSheet(wb.Sheets[name], name);
      if (p && p.rows.length) parsed.push(p);
    } catch { /* 스킵 */ }
  }
  // 행 수 많은 순
  parsed.sort((a, b) => b.rows.length - a.rows.length);
  return { all: wb.SheetNames, parsed };
}
