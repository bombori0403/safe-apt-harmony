import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { RiskLevel } from "@/lib/types";
import { RISK_ORDER, riskLevelClass, scoreToRiskLevel } from "@/lib/types";
import { toast } from "sonner";
import { writeErrorMessage } from "@/lib/write-error";
import { PhotoUpload } from "@/components/photo-upload";
import { useAuth } from "@/hooks/use-auth";
import { suggestLegalBasis } from "@/lib/legal-basis-keywords";
import { StepHeader } from "@/components/step-header";
import { Term } from "@/components/term";
import { METHOD_SCALE_HINT, SCALE_DISCLAIMER } from "@/lib/glossary";
import { Pencil, Trash2, Check, X, Scale, ChevronDown, ChevronUp, Loader2, AlertTriangle } from "lucide-react";

// 표시용 법적기준: 사용자 수정값 > 라이브러리 > 자동 제안 순.
function effectiveLegal(h: any): string {
  return h.legal_basis_override || h.hazard_library?.legal_basis || suggestLegalBasis(h.description ?? "")?.legal_basis || "";
}

export const Route = createFileRoute("/_app/assessment/$id/results")({
  component: Results,
});

type SaveMark = { state: "saving" | "saved" | "error"; at: Date };

function Results() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [a, setA] = useState<any>(null);
  const [hazards, setHazards] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editingLegalId, setEditingLegalId] = useState<string | null>(null);
  const [editLegal, setEditLegal] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({}); // 카드 '자세히' 펼침
  const [marks, setMarks] = useState<Record<string, SaveMark>>({}); // 카드별 저장 표시(지속)
  const [flashId, setFlashId] = useState<string | null>(null); // 미평가 항목 강조
  const controlTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const latestControl = useRef<Record<string, string>>({}); // 현재조치 칸의 최신 입력값
  const saveChain = useRef<Record<string, Promise<void>>>({}); // 항목별 저장 직렬화(늦게 온 옛 요청이 최신값을 덮지 않게)
  const hazardsRef = useRef<any[]>([]);
  useEffect(() => { hazardsRef.current = hazards; }, [hazards]);
  useEffect(() => () => { Object.values(controlTimers.current).forEach(clearTimeout); }, []);

  /** 같은 항목의 저장은 순서대로 한 번에 하나씩 */
  function enqueue(hid: string, fn: () => Promise<void>) {
    const p = (saveChain.current[hid] ?? Promise.resolve()).then(fn).catch(() => {});
    saveChain.current[hid] = p;
    return p;
  }

  function mark(hid: string, state: SaveMark["state"]) {
    setMarks((m) => ({ ...m, [hid]: { state, at: new Date() } }));
  }

  async function saveLegal(hid: string) {
    const val = editLegal.trim();
    mark(hid, "saving");
    const { data, error } = await supabase.from("hazards").update({ legal_basis_override: val || null }).eq("id", hid).select();
    if (error || !data?.length) { mark(hid, "error"); toast.error(writeErrorMessage(error, "권한이 없어 수정할 수 없습니다")); return; }
    mark(hid, "saved");
    setEditingLegalId(null);
    await load();
  }

  async function saveDesc(hid: string) {
    if (!editDesc.trim()) { toast.error("내용을 입력하세요"); return; }
    mark(hid, "saving");
    const { data, error } = await supabase.from("hazards").update({ description: editDesc.trim() }).eq("id", hid).select();
    if (error || !data?.length) { mark(hid, "error"); toast.error(writeErrorMessage(error, "권한이 없어 수정할 수 없습니다")); return; }
    mark(hid, "saved");
    setEditingId(null);
    await load();
  }

  async function deleteHazard(hid: string) {
    if (!confirm("이 유해·위험요인을 삭제하시겠습니까? 관련 감소대책도 함께 삭제됩니다.")) return;
    const { error: mErr } = await supabase.from("measures").delete().eq("hazard_id", hid);
    if (mErr) { console.error(mErr); toast.error(writeErrorMessage(mErr)); return; }
    const { data, error } = await supabase.from("hazards").delete().eq("id", hid).select();
    if (error || !data?.length) { toast.error(writeErrorMessage(error, "권한이 없어 삭제할 수 없습니다")); return; }
    toast.success("삭제되었습니다");
    await load();
  }

  useEffect(() => {
    if (!user) return;
    supabase.from("users").select("org_role").eq("auth_id", user.id).maybeSingle()
      .then(({ data }) => setRole(data?.org_role ?? null));
  }, [user]);

  async function load() {
    const { data: ass } = await supabase.from("assessments").select("*").eq("id", id).maybeSingle();
    setA(ass);
    const { data: h } = await supabase.from("hazards").select("*, hazard_library:library_item_id(article_no, legal_basis)").eq("assessment_id", id).order("created_at");
    setHazards(h ?? []);
  }
  useEffect(() => { load(); }, [id]);

  if (role && role !== "admin" && role !== "manager") {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-3">
        <h1 className="text-xl font-bold">접근 권한이 없습니다</h1>
        <p className="text-base text-muted-foreground">위험성 결정은 매니저 이상만 사용할 수 있습니다.</p>
        <Link to="/assessment/$id" params={{ id }}><Button variant="outline">돌아가기</Button></Link>
      </div>
    );
  }

  /** 방법별로 표준 등급(level_standardized)을 정한다. OPS 는 위험요인 개수가 아니라 담당자가 고른 등급을 그대로 쓴다(법령 조사 2-4). */
  function standardize(method: string, level?: RiskLevel | null, likelihood?: number, severity?: number): RiskLevel | null {
    if (method === "빈도강도법" && likelihood && severity) {
      return scoreToRiskLevel(likelihood * severity);
    }
    return level ?? null;
  }

  async function doUpdate(hid: string, patch: any, opts: { touchLevel?: boolean } = { touchLevel: true }) {
    const merged = { ...patch };
    if (opts.touchLevel) {
      const h = hazardsRef.current.find(x => x.id === hid) ?? {};
      const lvl = standardize(a.method, patch.level ?? h.level, patch.likelihood ?? h.likelihood, patch.severity ?? h.severity);
      if (lvl) { merged.level = merged.level ?? lvl; merged.level_standardized = lvl; }
    }
    mark(hid, "saving");
    const { data, error } = await supabase.from("hazards").update(merged).eq("id", hid).select();
    if (error || !data?.length) { mark(hid, "error"); toast.error(writeErrorMessage(error, "권한이 없거나 체험 기간이 종료되어 저장되지 않았습니다")); return; }
    mark(hid, "saved");
    await load();
  }

  function updateHazard(hid: string, patch: any) {
    return enqueue(hid, () => doUpdate(hid, patch));
  }

  /** '현재의 안전보건조치': 입력이 멈추면 1초 뒤 저장(칸을 벗어나지 않아도), 벗어날 때도 저장.
   *  저장은 항목별로 직렬화되고 실행 시점의 최신 입력을 읽으므로 늦게 끝난 옛 요청이 최신값을 덮지 않는다. 등급 필드는 건드리지 않는다. */
  function scheduleControlSave(hid: string, val: string, immediate = false) {
    latestControl.current[hid] = val;
    const t = controlTimers.current;
    if (t[hid]) clearTimeout(t[hid]);
    const run = () => {
      delete t[hid];
      enqueue(hid, async () => {
        const v = (latestControl.current[hid] ?? "").trim();
        const cur = hazardsRef.current.find((x) => x.id === hid)?.current_control ?? "";
        if (v !== cur) await doUpdate(hid, { current_control: v || null }, { touchLevel: false });
      });
    };
    if (immediate) run(); else t[hid] = setTimeout(run, 1000);
  }

  /** 다음 단계로 가기 전: 예약된 저장을 즉시 실행하고 모두 끝날 때까지 기다린다 */
  async function flushSaves() {
    for (const hid of Object.keys(controlTimers.current)) scheduleControlSave(hid, latestControl.current[hid] ?? "", true);
    await Promise.all(Object.values(saveChain.current));
  }

  const allow = (a?.allowable_level as RiskLevel) ?? "낮음";
  const unrated = hazards.filter((h) => !h.level);
  const exceed = hazards.filter((h) => h.level && RISK_ORDER[h.level as RiskLevel] > RISK_ORDER[allow]);

  async function next() {
    // 등급을 정하지 않은 항목이 있으면 넘어가지 않는다 (예전엔 등급 없는 항목을 그냥 통과시켰다)
    if (unrated.length > 0) {
      const first = unrated[0];
      toast.error(`아직 등급을 정하지 않은 항목이 ${unrated.length}건 있습니다.`);
      document.getElementById(`hz-${first.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      setFlashId(first.id);
      setTimeout(() => setFlashId(null), 2500);
      return;
    }
    setSaving(true);
    await flushSaves();
    if (exceed.length === 0) {
      const { data, error } = await supabase.from("assessments").update({ status: "협의중" }).eq("id", id).select("id");
      if (error || !data?.length) { toast.error(writeErrorMessage(error, "체험 기간이 종료되었거나 권한이 없어 진행할 수 없습니다.")); setSaving(false); return; }
      toast.success("허용 수준을 넘는 항목이 없습니다. 협의·공유 단계로 이동합니다.");
      navigate({ to: "/assessment/$id/share", params: { id } });
    } else {
      toast.info(`${exceed.length}건은 감소대책을 세워야 합니다.`);
      navigate({ to: "/assessment/$id/measures", params: { id }, search: { hazard: undefined } });
    }
    setSaving(false);
  }

  if (!a) return <div className="p-8 text-muted-foreground">불러오는 중...</div>;

  const todo = hazards.length === 0
    ? "위험요인이 없습니다. 2단계로 돌아가 위험요인을 고르세요"
    : unrated.length > 0
      ? `미평가 ${unrated.length}건의 등급을 선택하세요 (전체 ${hazards.length}건)`
      : exceed.length > 0
        ? `모든 항목 평가 완료 — 허용수준(${allow})을 넘는 ${exceed.length}건은 다음 단계에서 대책을 세웁니다`
        : `모든 항목 평가 완료 — 허용수준(${allow})을 넘는 항목이 없어 협의·공유로 갑니다`;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-5">
      <StepHeader current="results" assessmentId={id} workName={a.work_name} method={a.method} todo={todo} />

      <div className="rounded-md border bg-muted/30 px-4 py-3 space-y-1.5 text-base">
        <p><Term k="위험성" /> · <Term k="허용가능한위험성" compact /> = <b>{allow}</b></p>
        <ul className="text-sm text-muted-foreground list-disc pl-5">
          {METHOD_SCALE_HINT[a.method as keyof typeof METHOD_SCALE_HINT]?.map((l) => <li key={l}>{l}</li>)}
        </ul>
        <p className="text-sm text-muted-foreground">{SCALE_DISCLAIMER}</p>
        <p className="text-sm flex items-start gap-1.5 text-foreground/80"><Scale className="h-4 w-4 shrink-0 mt-0.5 text-primary" /><span><b className="text-primary">법적기준은 자동 제안(참고용)</b>입니다. 각 항목의 '수정'으로 확인·수정하세요. 최종 적용 책임은 사업장에 있습니다.</span></p>
      </div>

      <div className="space-y-3">
        {hazards.map(h => {
          const isOpen = !!open[h.id];
          const m = marks[h.id];
          const rated = !!h.level;
          const over = rated && RISK_ORDER[h.level as RiskLevel] > RISK_ORDER[allow];
          return (
          <Card key={h.id} id={`hz-${h.id}`} className={`${!rated ? "border-warning/60" : ""} ${flashId === h.id ? "ring-4 ring-warning/60" : ""}`}>
            <CardContent className="p-4 space-y-3">
            {/* 머리: 신규/재검토 · 저장 표시 · 자세히 */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={`font-medium ${h.origin === "carryover" ? "border-muted-foreground/40 text-muted-foreground" : "border-primary/50 text-primary"}`}>
                  {h.origin === "carryover" ? "재검토 (과년도)" : "신규"}
                </Badge>
                {!rated && <Badge className="bg-warning text-warning-foreground gap-1"><AlertTriangle className="h-3.5 w-3.5" />미평가</Badge>}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {m?.state === "saving" && <span className="inline-flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin" />저장 중</span>}
                {m?.state === "saved" && <span className="inline-flex items-center gap-1 text-success"><Check className="h-4 w-4" />저장됨 {m.at.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>}
                {m?.state === "error" && <span className="text-destructive">저장 실패</span>}
                <Button type="button" size="sm" variant="ghost" className="gap-1" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [h.id]: !isOpen }))}>
                  {isOpen ? <><ChevronUp className="h-5 w-5" />접기</> : <><ChevronDown className="h-5 w-5" />자세히</>}
                </Button>
              </div>
            </div>

            {/* 위험요인 이름 (펼쳤을 때만 수정 가능) */}
            {isOpen && editingId === h.id ? (
              <div className="flex gap-2">
                <Input value={editDesc} onChange={e => setEditDesc(e.target.value)} className="flex-1" aria-label="위험요인 내용" />
                <Button size="sm" variant="outline" onClick={() => saveDesc(h.id)} aria-label="저장"><Check className="h-5 w-5" /></Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} aria-label="취소"><X className="h-5 w-5" /></Button>
              </div>
            ) : (
              <div className="font-semibold text-lg leading-snug">{h.description}</div>
            )}

            {/* 현재의 안전보건조치 — 판단 근거라 항상 보이게 */}
            <div>
              <div className="text-sm mb-1"><Term k="현재안전보건조치" /></div>
              <textarea
                key={h.id}
                defaultValue={h.current_control ?? ""}
                onChange={(e) => scheduleControlSave(h.id, e.target.value)}
                onBlur={(e) => scheduleControlSave(h.id, e.target.value, true)}
                placeholder="예: 보호구 지급·착용 관리, 작업 전 안전교육 실시 등"
                rows={2}
                className="w-full px-3 py-2 rounded-md border bg-background text-base resize-y"
                aria-label="현재의 안전보건조치"
              />
            </div>

            {/* 등급 선택 */}
            <div>
              <div className="text-sm mb-1.5 font-medium">위험성 등급 {rated ? "" : <span className="text-warning">— 아직 선택하지 않았습니다</span>}</div>
              {a.method === "3단계_판단법" && (
                <div className="grid grid-cols-3 gap-2">
                  {(["하","중","상"] as const).map(v => {
                    const lvl: RiskLevel = v === "상" ? "매우높음" : v === "중" ? "보통" : "낮음";
                    const sel = h.level === lvl;
                    return <button key={v} type="button" aria-pressed={sel} onClick={() => updateHazard(h.id, { level: lvl })}
                      className={`min-h-12 py-2.5 rounded-md border-2 text-base font-semibold ${sel ? (v==="상"?"border-danger bg-danger/10 text-danger":v==="중"?"border-warning bg-warning/10 text-warning":"border-success bg-success/10 text-success") : "border-border"}`}>{v}</button>;
                  })}
                </div>
              )}

              {a.method === "5단계_판단법" && (
                <div className="grid grid-cols-5 gap-1.5">
                  {(["매우낮음","낮음","보통","높음","매우높음"] as RiskLevel[]).map(lvl => (
                    <button key={lvl} type="button" aria-pressed={h.level===lvl} onClick={() => updateHazard(h.id, { level: lvl })}
                      className={`min-h-12 py-2 rounded-md border text-sm font-medium ${h.level===lvl?"border-primary bg-primary/10 border-2":"border-border"}`}>{lvl}</button>
                  ))}
                </div>
              )}

              {a.method === "빈도강도법" && (
                <div className="space-y-2 text-base">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-28 text-sm"><Term k="가능성" compact /></span>
                    {[1,2,3,4,5].map(n => (
                      <button key={n} type="button" aria-pressed={h.likelihood===n} onClick={() => updateHazard(h.id, { likelihood: n })}
                        className={`w-11 h-11 rounded border text-base ${h.likelihood===n?"bg-primary text-primary-foreground border-primary":""}`}>{n}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-28 text-sm"><Term k="중대성" compact /></span>
                    {[1,2,3,4,5].map(n => (
                      <button key={n} type="button" aria-pressed={h.severity===n} onClick={() => updateHazard(h.id, { severity: n })}
                        className={`w-11 h-11 rounded border text-base ${h.severity===n?"bg-primary text-primary-foreground border-primary":""}`}>{n}</button>
                    ))}
                  </div>
                  {h.likelihood && h.severity && (
                    <div>
                      점수: <strong>{h.likelihood * h.severity}</strong>점 → <span className={`px-2 py-0.5 rounded text-sm ${riskLevelClass(h.level)}`}>{h.level}</span>
                    </div>
                  )}
                </div>
              )}

              {a.method === "체크리스트법" && (
                <div className="flex gap-2">
                  <button type="button" aria-pressed={h.checklist_result==="적정"} onClick={() => updateHazard(h.id, { checklist_result: "적정", level: "낮음" })}
                    className={`flex-1 min-h-12 py-2.5 rounded-md border-2 text-base ${h.checklist_result==="적정"?"border-success bg-success/10 text-success":"border-border"}`}>○ 적정</button>
                  <button type="button" aria-pressed={h.checklist_result==="보완"} onClick={() => updateHazard(h.id, { checklist_result: "보완", level: "높음" })}
                    className={`flex-1 min-h-12 py-2.5 rounded-md border-2 text-base ${h.checklist_result==="보완"?"border-danger bg-danger/10 text-danger":"border-border"}`}>× 보완</button>
                </div>
              )}

              {a.method === "OPS" && (
                <div className="space-y-3">
                  <OPSEditor h={h} onChange={(ops_data) => updateHazard(h.id, { ops_data })} />
                  <div>
                    <div className="text-sm mb-1.5">답을 보고 위험성을 직접 판단하세요</div>
                    <div className="grid grid-cols-3 gap-2">
                      {(["낮음","보통","높음"] as RiskLevel[]).map(lvl => (
                        <button key={lvl} type="button" aria-pressed={h.level===lvl} onClick={() => updateHazard(h.id, { level: lvl })}
                          className={`min-h-12 py-2 rounded-md border-2 text-base font-medium ${h.level===lvl?"border-primary bg-primary/10":"border-border"}`}>{lvl}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 법적기준 — 한 줄 상태 + 수정 (자동 제안이라 '확인 필요'를 항상 보이게) */}
            <div className="rounded-md border border-primary/30 bg-primary/[0.05] p-2.5 space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm font-semibold text-primary inline-flex items-center gap-1.5"><Scale className="h-4 w-4" />법적기준 <Badge variant="outline" className="font-normal border-primary/40 text-primary">참고용 · 담당자 확인 필요</Badge></span>
                {editingLegalId !== h.id && (
                  <Button size="sm" variant="outline" className="gap-1 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
                    onClick={() => { setEditingLegalId(h.id); setEditLegal(effectiveLegal(h)); }}>
                    <Pencil className="h-4 w-4" />확인·수정
                  </Button>
                )}
              </div>
              {editingLegalId === h.id ? (
                <div className="flex gap-2 flex-wrap">
                  <Input value={editLegal} onChange={e => setEditLegal(e.target.value)} className="flex-1 min-w-[12rem]"
                    placeholder="예: 산업안전보건기준에 관한 규칙 제32조" autoFocus aria-label="법적기준" />
                  <Button size="sm" className="gap-1" onClick={() => saveLegal(h.id)}><Check className="h-4 w-4" />저장</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingLegalId(null)} aria-label="취소"><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <div className={`text-base ${effectiveLegal(h) ? "text-foreground" : "text-muted-foreground italic"}`}>
                  {effectiveLegal(h) || "자동 매칭 없음 — '확인·수정'을 눌러 직접 입력하세요"}
                </div>
              )}
            </div>

            {/* 결과 줄 */}
            {rated && (
              <div className="flex items-center justify-between gap-2 flex-wrap text-base">
                <span className={`px-2.5 py-1 rounded font-semibold ${riskLevelClass(h.level)}`}>{h.level}</span>
                {over ? (
                  <Link to="/assessment/$id/measures" params={{ id }} search={{ hazard: h.id }}>
                    <Badge className="bg-danger text-danger-foreground cursor-pointer hover:opacity-90 text-sm py-1">허용수준({allow}) 초과 → 감소대책 필요</Badge>
                  </Link>
                ) : (
                  <Badge variant="outline" className="border-success/50 text-success gap-1 text-sm py-1">
                    <Check className="h-4 w-4" />허용 범위 · 감소대책 불필요
                  </Badge>
                )}
              </div>
            )}

            {/* 자세히: 사진 · 이름 수정 · 삭제 */}
            {isOpen && (
              <div className="pt-3 border-t space-y-3">
                <div>
                  <div className="text-sm text-muted-foreground mb-1.5">현장 사진</div>
                  <PhotoUpload assessmentId={id} hazardId={h.id} photos={h.photos ?? []} onChange={(photos) => updateHazard(h.id, { photos })} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => { setEditingId(h.id); setEditDesc(h.description); }}><Pencil className="h-4 w-4" />이름 수정</Button>
                  <Button size="sm" variant="outline" className="gap-1 text-destructive hover:text-destructive" onClick={() => deleteHazard(h.id)}><Trash2 className="h-4 w-4" />이 위험요인 삭제</Button>
                </div>
              </div>
            )}
          </CardContent></Card>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="text-base text-muted-foreground">평가 완료 <b className="text-foreground">{hazards.length - unrated.length}</b>/{hazards.length}건</span>
        <Button size="lg" onClick={next} disabled={saving || hazards.length === 0}>{saving ? "..." : "다음 단계로"}</Button>
      </div>
    </div>
  );
}

/** 핵심요인 기술법: 핵심 질문의 답을 적는다. 개수로 등급을 정하지 않는다. */
function OPSEditor({ h, onChange }: { h: any; onChange: (d: any) => void }) {
  const factors: string[] = h.ops_data?.factors ?? [];
  const [val, setVal] = useState("");
  function add() { const v = val.trim(); if (!v) return; onChange({ ...h.ops_data, factors: [...factors, v] }); setVal(""); }
  return (
    <div className="space-y-2 text-base">
      <div className="text-sm">핵심 질문의 답 — 어디에 어떤 위험이 있나 · 누가 위험한가 · 현재 조치는 · 추가 개선은</div>
      {factors.map((f, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="flex-1 bg-muted rounded px-3 py-2">{f}</span>
          <Button type="button" size="sm" variant="ghost" className="text-danger hover:text-danger" onClick={() => onChange({ ...h.ops_data, factors: factors.filter((_, j) => j !== i) })}>삭제</Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Input value={val} onChange={e=>setVal(e.target.value)} placeholder="예: 옥상 난간 없음 — 미화원 추락 위험 — 현재 조치 없음"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} aria-label="핵심 질문 답" />
        <Button type="button" variant="outline" onClick={add} disabled={!val.trim()} className="shrink-0">추가</Button>
      </div>
    </div>
  );
}
