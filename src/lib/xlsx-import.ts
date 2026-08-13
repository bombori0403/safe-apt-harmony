import * as XLSX from "xlsx";
import { scoreToRiskLevel, type RiskLevel } from "@/lib/types";

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
  if (v instanceof Date) return v.toISOString().slice(0, 10);
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

export interface StdMeasureRow { content: string; dueDate?: string; responsible?: string; }
export interface StdHazardRow {
  origin: "carryover" | "new";
  description: string;
  currentControl?: string;
  legalBasis?: string;
  level?: RiskLevel;           // 현재 위험성(상/중/하 → 매핑)
  measures: StdMeasureRow[];
}
export interface StdFormResult {
  hazards: StdHazardRow[];
  carryover: number;           // 재검토(과년도) 건수
  neu: number;                 // 신규 건수
  measures: number;            // 감소대책 건수
}

const inc = (s: string, kws: string[]) => kws.some((k) => s.includes(k));

// 시트명으로 역할 판별: 감소대책 포함=대책시트, 재검토/신규(결정)=위험요인 시트.
function stdRole(name: string): { kind: "hazard" | "measure"; origin: "carryover" | "new" } | null {
  const n = name.replace(/\s/g, "");
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

export function parseStandardForm(buf: ArrayBuffer): StdFormResult | null {
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const roles = wb.SheetNames.map((n) => ({ n, role: stdRole(n) })).filter((x) => x.role);
  if (!roles.length) return null;

  const hazards: StdHazardRow[] = [];
  const byDesc = new Map<string, StdHazardRow>();
  const skipHeader = (d: string) => inc(norm(d), ["위험발생상황", "유해위험요인", "유해·위험요인"]);

  // 1) 위험요인 시트(1-1 재검토 / 1-2 신규)
  for (const { n, role } of roles) {
    if (role!.kind !== "hazard") continue;
    const A = analyzeStdSheet(wb.Sheets[n]); if (!A) continue;
    let descCol = A.find(["위험발생"], ["위험분류"]);
    if (descCol < 0) descCol = A.find(["유해위험요인", "유해·위험요인"], ["위험분류"]);
    const legalCol = A.find(["관련근거", "법적"]);
    const ctrlCol = A.find(["현재의안전보건조치"]);
    const riskCol = A.find(["현재위험성"]);
    if (descCol < 0) continue;
    for (let r = A.headerRow + 2; r < A.aoa.length; r++) {
      const row = A.aoa[r]; if (!row) continue;
      const desc = txt(row[descCol]);
      if (!desc || desc.length < 4 || skipHeader(desc)) continue;
      const h: StdHazardRow = {
        origin: role!.origin,
        description: desc,
        currentControl: ctrlCol >= 0 ? txt(row[ctrlCol]) || undefined : undefined,
        legalBasis: legalCol >= 0 ? txt(row[legalCol]) || undefined : undefined,
        level: riskCol >= 0 ? levelFrom상중하(txt(row[riskCol])) : undefined,
        measures: [],
      };
      hazards.push(h);
      if (!byDesc.has(norm(desc))) byDesc.set(norm(desc), h);
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
    const ctrlCol = A.find(["현재의안전보건조치"]);
    const riskCol = A.find(["현재위험성"]);
    if (measCol < 0 || descCol < 0) continue;
    for (let r = A.headerRow + 2; r < A.aoa.length; r++) {
      const row = A.aoa[r]; if (!row) continue;
      const content = txt(row[measCol]);
      const desc = txt(row[descCol]);
      if (!content || !desc || desc.length < 4 || skipHeader(desc)) continue;
      let h = byDesc.get(norm(desc));
      if (!h) {
        // 위험요인 시트에 없던 항목이면 대책 시트 정보로 새로 만든다.
        h = {
          origin: role!.origin, description: desc,
          currentControl: ctrlCol >= 0 ? txt(row[ctrlCol]) || undefined : undefined,
          legalBasis: undefined,
          level: riskCol >= 0 ? levelFrom상중하(txt(row[riskCol])) : undefined,
          measures: [],
        };
        hazards.push(h);
        byDesc.set(norm(desc), h);
      }
      h.measures.push({
        content,
        dueDate: dueCol >= 0 ? toDate(row[dueCol]) : undefined,
        responsible: respCol >= 0 ? txt(row[respCol]) || undefined : undefined,
      });
      mcount++;
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
