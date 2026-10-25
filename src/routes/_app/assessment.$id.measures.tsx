import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RISK_ORDER, riskLevelClass, scoreToRiskLevel, type RiskLevel } from "@/lib/types";
import { toast } from "sonner";
import { writeErrorMessage } from "@/lib/write-error";
import { PhotoUpload } from "@/components/photo-upload";
import { StepHeader } from "@/components/step-header";
import { Term } from "@/components/term";
import { GLOSSARY } from "@/lib/glossary";
import { Pencil, Trash2, Check, X, Printer, Plus, AlertTriangle } from "lucide-react";

const MEASURE_TYPES = ["본질적_대책", "공학적_대책", "관리적_대책", "개인보호구"] as const;
const MEASURE_STATUSES = ["대기", "진행중", "완료"] as const;

/** 대책 유형 표시: 이름 + 한 줄 풀이 (본질적→공학적→관리적→개인보호구 순으로 우선) */
const MEASURE_TYPE_GLOSS: Record<(typeof MEASURE_TYPES)[number], string> = {
  본질적_대책: `본질적 대책 — ${GLOSSARY.본질적대책.short}`,
  공학적_대책: `공학적 대책 — ${GLOSSARY.공학적대책.short}`,
  관리적_대책: `관리적 대책 — ${GLOSSARY.관리적대책.short}`,
  개인보호구: `개인보호구 — ${GLOSSARY.개인보호구.short}`,
};
function displayMeasureType(type: string | null) {
  return type?.replace("_대책", "") ?? "-";
}
/** 대책 상태 3가지를 '입력만 함 / 실행 중 / 실행 완료'로 읽히게 (DB 값은 그대로) */
const STATUS_LABEL: Record<string, string> = { 대기: "입력됨 (아직 실행 전)", 진행중: "실행 중", 완료: "실행 완료" };

export const Route = createFileRoute("/_app/assessment/$id/measures")({
  validateSearch: (s: Record<string, unknown>) => ({ hazard: typeof s.hazard === "string" ? s.hazard : undefined }),
  component: Measures,
});

function Measures() {
  const { id } = Route.useParams();
  const { hazard: hazardFilter } = Route.useSearch();
  const navigate = useNavigate();
  const [a, setA] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [formOpen, setFormOpen] = useState<Record<string, boolean>>({}); // 위험요인별 '대책 추가' 폼 펼침
  const dirtyForms = useRef<Record<string, string>>({}); // 펼친 폼에 적다 만 내용 (다음으로 갈 때 확인용)
  const allowLevel = (a?.allowable_level ?? "낮음") as RiskLevel;

  async function load() {
    const { data: ass } = await supabase.from("assessments").select("*").eq("id", id).maybeSingle();
    setA(ass);
    const { data: h } = await supabase.from("hazards").select("*, measures(*)").eq("assessment_id", id).order("created_at", { ascending: true });
    setItems(h ?? []);
  }
  useEffect(() => {
    load();
    const onFocus = () => load();
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [id]);

  function isOverAllow(level: string | null) {
    if (!level) return false;
    return RISK_ORDER[level as RiskLevel] > RISK_ORDER[allowLevel];
  }

  async function addMeasure(hid: string, payload: any) {
    const { data, error } = await supabase.from("measures").insert({ hazard_id: hid, ...payload }).select();
    if (error || !data?.length) { toast.error(writeErrorMessage(error, "권한이 없어 추가할 수 없습니다")); return false; }
    toast.success("대책이 저장되었습니다"); load();
    return true;
  }

  async function updateMeasure(mid: string, patch: any) {
    const { data, error } = await supabase.from("measures").update(patch).eq("id", mid).select();
    if (error || !data?.length) { toast.error(writeErrorMessage(error, "권한이 없어 수정할 수 없습니다")); return; }
    toast.success("저장되었습니다"); load();
  }

  async function updatePostRisk(hid: string, patch: { post_likelihood?: number; post_severity?: number; post_level?: RiskLevel }) {
    const merged: any = { ...patch };
    // 빈도강도법: derive the level from the entered 가능성×중대성 numbers.
    if (patch.post_likelihood !== undefined || patch.post_severity !== undefined) {
      const h = items.find((x) => x.id === hid);
      const pl = patch.post_likelihood ?? h?.post_likelihood;
      const ps = patch.post_severity ?? h?.post_severity;
      if (pl && ps) merged.post_level = scoreToRiskLevel(pl * ps);
    }
    const { data, error } = await supabase.from("hazards").update(merged).eq("id", hid).select("id");
    if (error || !data?.length) { toast.error(writeErrorMessage(error, "권한이 없어 저장할 수 없습니다")); return; }
    load();
  }

  async function updateHazardPhotos(hid: string, patch: { photos?: string[]; after_photos?: string[] }) {
    const { data, error } = await supabase.from("hazards").update(patch).eq("id", hid).select("id");
    if (error || !data?.length) { toast.error(writeErrorMessage(error, "권한이 없어 저장할 수 없습니다")); return; }
    load();
  }

  async function deleteMeasure(mid: string) {
    if (!confirm("이 감소대책을 삭제하시겠습니까?")) return;
    const { data, error } = await supabase.from("measures").delete().eq("id", mid).select();
    if (error || !data?.length) { toast.error(writeErrorMessage(error, "권한이 없어 삭제할 수 없습니다")); return; }
    toast.success("삭제되었습니다"); load();
  }

  const overItems = items.filter((h) => isOverAllow(h.level));
  const noMeasure = overItems.filter((h) => !(h.measures?.length > 0));
  const notDone = overItems.flatMap((h) => (h.measures ?? []).filter((m: any) => m.status !== "완료"));

  async function complete() {
    // 적다 만 대책 폼이 있으면 먼저 묻는다
    const dirty = Object.entries(dirtyForms.current).filter(([, v]) => v.trim());
    if (dirty.length) {
      if (!confirm(`저장하지 않은 대책 입력이 ${dirty.length}건 있습니다.\n\n[확인] 그대로 두고 다음 단계로 (입력은 사라집니다)\n[취소] 돌아가서 '대책 저장'을 누르기`)) return;
    }
    // 대책 없는 초과 항목은 경고(막지는 않음 — 대책 수립은 협의 단계에서 보완할 수 있음)
    if (noMeasure.length) {
      if (!confirm(`허용수준을 넘는데 대책이 없는 위험요인이 ${noMeasure.length}건 있습니다.\n그래도 협의·공유 단계로 갈까요?`)) return;
    }
    const { data, error } = await supabase.from("assessments").update({ status: "협의중" }).eq("id", id).select("id");
    if (error || !data?.length) { toast.error(writeErrorMessage(error, "체험 기간이 종료되었거나 권한이 없어 진행할 수 없습니다.")); return; }
    if (notDone.length) toast.info(`아직 실행 전인 대책이 ${notDone.length}건 있습니다. 실행 후 '실행 완료'로 바꾸고 개선 후 위험성을 입력하세요.`);
    navigate({ to: "/assessment/$id/share", params: { id } });
  }

  if (!a) return <div className="p-8 text-muted-foreground">불러오는 중...</div>;

  const todo = hazardFilter
    ? "선택한 위험요인의 대책만 작성합니다"
    : overItems.length === 0
      ? "허용수준을 넘는 항목이 없습니다. 바로 협의·공유로 가도 됩니다"
      : noMeasure.length > 0
        ? `허용수준(${allowLevel})을 넘는 ${overItems.length}건 중 대책이 없는 ${noMeasure.length}건에 대책을 세우세요`
        : `대책 입력 완료 — 실행 전 ${notDone.length}건은 실행 후 '실행 완료'로 바꾸고 개선 후 위험성을 입력하세요`;

  const visible = hazardFilter ? items.filter(h => h.id === hazardFilter) : [...items].sort((x, y) => Number(isOverAllow(y.level)) - Number(isOverAllow(x.level)));

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-5">
      <StepHeader current="measures" assessmentId={id} workName={a.work_name} method={a.method} todo={todo} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 text-base">
          <p><Term k="감소대책" /></p>
          <p className="text-sm text-muted-foreground">우선순위: <Term k="본질적대책" compact /> → <Term k="공학적대책" compact /> → <Term k="관리적대책" compact /> → <Term k="개인보호구" compact /></p>
          {hazardFilter && (
            <Link to="/assessment/$id/measures" params={{ id }} search={{ hazard: undefined }} className="text-sm text-primary underline inline-block">전체 보기</Link>
          )}
        </div>
        <Link to="/assessment/$id/measures-report" params={{ id }}>
          <Button variant="outline" size="sm" className="gap-1"><Printer className="h-4 w-4" />감소대책 출력</Button>
        </Link>
      </div>

      {visible.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-base text-muted-foreground">
          {hazardFilter ? "해당 유해·위험요인을 찾을 수 없습니다." : "등록된 유해·위험요인이 없습니다. 먼저 유해·위험요인을 등록하세요."}
        </CardContent></Card>
      ) : visible.map(h => {
        const over = isOverAllow(h.level);
        const ms: any[] = h.measures ?? [];
        const allDone = ms.length > 0 && ms.every((m) => m.status === "완료");
        // 대책 없는 초과 항목은 폼을 바로 펼쳐 두고, 적다 만 폼은 재조회(load)로 닫히지 않게 유지한다
        const dirty = !!dirtyForms.current[h.id]?.trim();
        const open = formOpen[h.id] !== undefined ? (formOpen[h.id] || dirty) : (over && ms.length === 0) || dirty;
        return (
          <Card key={h.id} className={over && ms.length === 0 ? "border-destructive/50" : ""}><CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="font-semibold text-lg leading-snug">{h.description}</div>
              <div className="flex items-center gap-2 flex-wrap">
                {h.level && <span className={`px-2 py-1 rounded text-sm ${riskLevelClass(h.level)}`}>{h.level}</span>}
                {over
                  ? <Badge className="bg-destructive/10 text-destructive border-destructive/30 gap-1" variant="outline"><AlertTriangle className="h-3.5 w-3.5" />허용수준 초과 — 대책 필요</Badge>
                  : <Badge variant="outline" className="text-muted-foreground">허용 범위 (대책 선택)</Badge>}
              </div>
            </div>

            {/* 대책 상태 요약: 입력 → 실행 → 실행 후 확인 */}
            {ms.length > 0 && (
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="secondary">대책 {ms.length}건</Badge>
                <Badge variant={allDone ? "default" : "outline"} className={allDone ? "bg-success text-success-foreground" : ""}>{allDone ? "모두 실행 완료" : `실행 전·중 ${ms.filter((m) => m.status !== "완료").length}건`}</Badge>
                {allDone && (h.post_level
                  ? <Badge variant="outline" className="border-success/50 text-success gap-1"><Check className="h-3.5 w-3.5" />개선 후 위험성 확인됨: {h.post_level}</Badge>
                  : <Badge variant="outline" className="border-warning text-warning">개선 후 위험성 입력 필요</Badge>)}
              </div>
            )}

            {ms.length > 0 && (
              <div className="space-y-1.5">
                {ms.map((m: any) => (
                  <MeasureRow key={m.id} m={m} onUpdate={(p) => updateMeasure(m.id, p)} onDelete={() => deleteMeasure(m.id)} />
                ))}
              </div>
            )}

            {open ? (
              <MeasureForm
                onAdd={async (p) => { const ok = await addMeasure(h.id, p); if (ok) { setFormOpen((o) => ({ ...o, [h.id]: false })); delete dirtyForms.current[h.id]; } return ok; }}
                onCancel={() => { setFormOpen((o) => ({ ...o, [h.id]: false })); delete dirtyForms.current[h.id]; }}
                onDirty={(txt) => { dirtyForms.current[h.id] = txt; }}
                canCancel={!(over && ms.length === 0)}
              />
            ) : (
              <Button type="button" variant="outline" className="gap-1" onClick={() => setFormOpen((o) => ({ ...o, [h.id]: true }))}>
                <Plus className="h-5 w-5" />대책 추가
              </Button>
            )}

            {ms.length > 0 && (
              <PostRiskEditor hazard={h} method={a.method} onChange={(p) => updatePostRisk(h.id, p)} />
            )}
            {ms.length > 0 && (
              <div className="border-t pt-3 mt-1">
                <div className="text-sm font-medium text-muted-foreground mb-2">이행 사진 대지 (변경 전 / 변경 후)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">변경 전 (현장)</div>
                    <PhotoUpload max={2} assessmentId={id} hazardId={h.id} photos={h.photos ?? []} onChange={(photos) => updateHazardPhotos(h.id, { photos })} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">변경 후 (이행)</div>
                    <PhotoUpload max={2} assessmentId={id} hazardId={h.id} photos={h.after_photos ?? []} onChange={(after_photos) => updateHazardPhotos(h.id, { after_photos })} />
                  </div>
                </div>
              </div>
            )}
          </CardContent></Card>
        );
      })}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {overItems.length > 0 && <span className="text-base text-muted-foreground">대책 수립 <b className="text-foreground">{overItems.length - noMeasure.length}</b>/{overItems.length}건</span>}
        <Button size="lg" onClick={complete}>협의·공유 단계로</Button>
      </div>
    </div>
  );
}

function PostRiskEditor({ hazard, method, onChange }: { hazard: any; method: string; onChange: (p: { post_likelihood?: number; post_severity?: number; post_level?: RiskLevel }) => void }) {
  const score = hazard.post_likelihood && hazard.post_severity ? hazard.post_likelihood * hazard.post_severity : null;
  const shownLevel = (score ? scoreToRiskLevel(score) : hazard.post_level) as RiskLevel | null;

  return (
    <div className="border-t pt-3 mt-1 space-y-2 text-base">
      <div className="text-sm"><Term k="개선후위험성" /></div>

      {method === "빈도강도법" && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-28 text-sm"><Term k="가능성" compact /></span>
            {[1,2,3,4,5].map(n => (
              <button key={n} type="button" aria-pressed={hazard.post_likelihood===n} onClick={() => onChange({ post_likelihood: n })}
                className={`w-11 h-11 rounded border text-base ${hazard.post_likelihood===n?"bg-primary text-primary-foreground border-primary":""}`}>{n}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-28 text-sm"><Term k="중대성" compact /></span>
            {[1,2,3,4,5].map(n => (
              <button key={n} type="button" aria-pressed={hazard.post_severity===n} onClick={() => onChange({ post_severity: n })}
                className={`w-11 h-11 rounded border text-base ${hazard.post_severity===n?"bg-primary text-primary-foreground border-primary":""}`}>{n}</button>
            ))}
          </div>
        </>
      )}

      {method === "3단계_판단법" && (
        <div className="grid grid-cols-3 gap-2">
          {(["하","중","상"] as const).map(v => {
            const lvl: RiskLevel = v === "상" ? "매우높음" : v === "중" ? "보통" : "낮음";
            const sel = hazard.post_level === lvl;
            return <button key={v} type="button" aria-pressed={sel} onClick={() => onChange({ post_level: lvl })}
              className={`min-h-12 py-2 rounded-md border-2 text-base font-semibold ${sel ? (v==="상"?"border-danger bg-danger/10 text-danger":v==="중"?"border-warning bg-warning/10 text-warning":"border-success bg-success/10 text-success") : "border-border"}`}>{v}</button>;
          })}
        </div>
      )}

      {method === "5단계_판단법" && (
        <div className="grid grid-cols-5 gap-1.5">
          {(["매우낮음","낮음","보통","높음","매우높음"] as RiskLevel[]).map(lvl => (
            <button key={lvl} type="button" aria-pressed={hazard.post_level===lvl} onClick={() => onChange({ post_level: lvl })}
              className={`min-h-12 py-2 rounded-md border text-sm font-medium ${hazard.post_level===lvl?"border-primary border-2 bg-primary/10":"border-border"}`}>{lvl}</button>
          ))}
        </div>
      )}

      {method === "체크리스트법" && (
        <div className="flex gap-2">
          <button type="button" aria-pressed={hazard.post_level==="낮음"} onClick={() => onChange({ post_level: "낮음" })}
            className={`flex-1 min-h-12 py-2.5 rounded-md border-2 text-base ${hazard.post_level==="낮음"?"border-success bg-success/10 text-success":"border-border"}`}>○ 적정</button>
          <button type="button" aria-pressed={hazard.post_level==="높음"} onClick={() => onChange({ post_level: "높음" })}
            className={`flex-1 min-h-12 py-2.5 rounded-md border-2 text-base ${hazard.post_level==="높음"?"border-danger bg-danger/10 text-danger":"border-border"}`}>× 보완</button>
        </div>
      )}

      {method === "OPS" && (
        <div className="grid grid-cols-3 gap-2">
          {(["낮음","보통","높음"] as RiskLevel[]).map(lvl => (
            <button key={lvl} type="button" aria-pressed={hazard.post_level===lvl} onClick={() => onChange({ post_level: lvl })}
              className={`min-h-12 py-2 rounded-md border-2 text-base font-medium ${hazard.post_level===lvl?"border-primary bg-primary/10":"border-border"}`}>{lvl}</button>
          ))}
        </div>
      )}

      {shownLevel && (
        <div>
          개선 후: {score && <><strong>{score}</strong>점 → </>}
          <span className={`px-2 py-0.5 rounded text-sm ${riskLevelClass(shownLevel)}`}>{shownLevel}</span>
        </div>
      )}
    </div>
  );
}

function MeasureForm({ onAdd, onCancel, onDirty, canCancel }: { onAdd: (p: any) => Promise<boolean>; onCancel: () => void; onDirty: (txt: string) => void; canCancel: boolean }) {
  const [type, setType] = useState("관리적_대책");
  const [content, setContent] = useState("");
  const [resp, setResp] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const uid = useId(); // 카드마다 폼이 있으므로 라벨 htmlFor 가 서로 섞이지 않게
  useEffect(() => { onDirty(content); }, [content]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onDirty(""), []); // eslint-disable-line react-hooks/exhaustive-deps
  async function save() {
    if (!content.trim()) { toast.error("대책 내용을 적어 주세요"); return; }
    setBusy(true);
    const ok = await onAdd({ type, content: content.trim(), responsible_name: resp, due_date: due || null, status: "대기" });
    setBusy(false);
    if (ok) { setContent(""); setResp(""); setDue(""); }
  }
  return (
    <div className="rounded-md border border-primary/30 bg-primary/[0.03] p-3 space-y-3 text-base">
      <div className="font-medium">새 감소대책</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <Label htmlFor={`${uid}-content`}>무엇을 할 건가요? <span className="text-destructive">*</span></Label>
          <Input id={`${uid}-content`} value={content} onChange={e=>setContent(e.target.value)} placeholder="예: 안전난간 설치, 작업절차서 비치" autoFocus />
        </div>
        <div>
          <Label htmlFor={`${uid}-type`}>대책 유형</Label>
          <select id={`${uid}-type`} value={type} onChange={e=>setType(e.target.value)} className="w-full h-11 px-2 rounded border bg-background text-base">
            {MEASURE_TYPES.map(value => <option key={value} value={value}>{MEASURE_TYPE_GLOSS[value]}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor={`${uid}-resp`}>책임자</Label>
          <Input id={`${uid}-resp`} value={resp} onChange={e=>setResp(e.target.value)} placeholder="예: 관리과장 홍길동" />
        </div>
        <div>
          <Label htmlFor={`${uid}-due`}>이행 예정일</Label>
          <Input id={`${uid}-due`} type="date" value={due} onChange={e=>setDue(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2 justify-end">
        {canCancel && <Button type="button" variant="ghost" onClick={onCancel}>취소</Button>}
        <Button type="button" onClick={save} disabled={busy || !content.trim()} className="gap-1"><Check className="h-5 w-5" />{busy ? "저장 중…" : "대책 저장"}</Button>
      </div>
    </div>
  );
}

function MeasureRow({ m, onUpdate, onDelete }: { m: any; onUpdate: (p: any) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [type, setType] = useState(m.type ?? "관리적_대책");
  const [content, setContent] = useState(m.content ?? "");
  const [resp, setResp] = useState(m.responsible_name ?? "");
  const [due, setDue] = useState(m.due_date ?? "");
  const [status, setStatus] = useState(m.status ?? "대기");

  if (!editing) {
    const statusColor = m.status === "완료" ? "bg-green-100 text-green-700 border-green-300"
      : m.status === "진행중" ? "bg-blue-100 text-blue-700 border-blue-300"
      : "bg-amber-100 text-amber-700 border-amber-300";
    return (
      <div className="bg-muted/40 rounded p-3 text-base space-y-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <span className="font-medium flex-1 min-w-[12rem]">[{displayMeasureType(m.type)}] {m.content}</span>
          <div className="flex items-center gap-1 flex-wrap">
            <select
              aria-label="대책 상태"
              value={m.status ?? "대기"}
              onChange={e => onUpdate({ status: e.target.value, completed_at: e.target.value === "완료" ? new Date().toISOString() : null })}
              className={`h-11 px-2 rounded border text-base ${statusColor}`}
            >
              {MEASURE_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <Button size="icon" variant="ghost" aria-label="대책 수정" onClick={() => setEditing(true)}><Pencil className="h-5 w-5" /></Button>
            <Button size="icon" variant="ghost" aria-label="대책 삭제" className="text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="h-5 w-5" /></Button>
          </div>
        </div>
        {(m.responsible_name || m.due_date) && <div className="text-sm text-muted-foreground">책임자: {m.responsible_name || "-"} · 예정일: {m.due_date ?? "-"}{m.completed_at ? ` · 완료: ${new Date(m.completed_at).toLocaleDateString("ko-KR")}` : ""}</div>}
        {m.status !== "완료" && (
          <div>
            <div className="text-sm mb-1"><Term k="미완료감소대책" compact /></div>
            <textarea
              key={m.id}
              defaultValue={m.residual_action ?? ""}
              onBlur={(e) => {
                const val = e.target.value.trim();
                if (val !== (m.residual_action ?? "")) onUpdate({ residual_action: val || null });
              }}
              placeholder="아직 실행하지 못한 부분과 계획 — 예: 자재 입고 후 난간 설치 예정"
              rows={1}
              className="w-full px-3 py-2 rounded border bg-background text-base resize-y"
              aria-label="미완료 감소대책"
            />
          </div>
        )}
        {m.status === "완료" && m.residual_action && (
          <div className="text-sm text-muted-foreground line-through">미완료였던 내용: {m.residual_action}</div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-muted/40 rounded p-3 text-base space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <Label>대책 내용</Label>
          <Input value={content} onChange={e=>setContent(e.target.value)} />
        </div>
        <div>
          <Label>대책 유형</Label>
          <select value={type} onChange={e=>setType(e.target.value)} className="w-full h-11 px-2 rounded border bg-background text-base">
            {MEASURE_TYPES.map(value => <option key={value} value={value}>{MEASURE_TYPE_GLOSS[value]}</option>)}
          </select>
        </div>
        <div>
          <Label>상태</Label>
          <select value={status} onChange={e=>setStatus(e.target.value)} className="w-full h-11 px-2 rounded border bg-background text-base">
            {MEASURE_STATUSES.map(value => <option key={value} value={value}>{STATUS_LABEL[value]}</option>)}
          </select>
        </div>
        <div>
          <Label>책임자</Label>
          <Input value={resp} onChange={e=>setResp(e.target.value)} />
        </div>
        <div>
          <Label>이행 예정일</Label>
          <Input type="date" value={due ?? ""} onChange={e=>setDue(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={() => setEditing(false)}><X className="h-5 w-5 mr-1" />취소</Button>
        <Button onClick={() => {
          if (!content.trim()) { toast.error("내용을 입력하세요"); return; }
          onUpdate({ type, content, responsible_name: resp, due_date: due || null, status, completed_at: status === "완료" ? (m.completed_at ?? new Date().toISOString()) : null });
          setEditing(false);
        }}><Check className="h-5 w-5 mr-1" />저장</Button>
      </div>
    </div>
  );
}
