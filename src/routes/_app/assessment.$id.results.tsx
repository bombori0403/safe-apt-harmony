import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { Pencil, Trash2, Check, X, Scale } from "lucide-react";

// 표시용 법적기준: 사용자 수정값 > 라이브러리 > 자동 제안 순.
function effectiveLegal(h: any): string {
  return h.legal_basis_override || h.hazard_library?.legal_basis || suggestLegalBasis(h.description ?? "")?.legal_basis || "";
}

export const Route = createFileRoute("/_app/assessment/$id/results")({
  component: Results,
});

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

  async function saveLegal(hid: string) {
    const val = editLegal.trim();
    const { data, error } = await supabase.from("hazards").update({ legal_basis_override: val || null }).eq("id", hid).select();
    if (error) { console.error(error); toast.error(writeErrorMessage(error)); return; }
    if (!data || data.length === 0) { toast.error("권한이 없어 수정할 수 없습니다"); return; }
    toast.success("법적기준이 저장되었습니다");
    setEditingLegalId(null);
    await load();
  }

  async function saveDesc(hid: string) {
    if (!editDesc.trim()) { toast.error("내용을 입력하세요"); return; }
    const { data, error } = await supabase.from("hazards").update({ description: editDesc.trim() }).eq("id", hid).select();
    if (error) { console.error(error); toast.error(writeErrorMessage(error)); return; }
    if (!data || data.length === 0) { toast.error("권한이 없어 수정할 수 없습니다"); return; }
    toast.success("저장되었습니다");
    setEditingId(null);
    await load();
  }

  async function deleteHazard(hid: string) {
    if (!confirm("이 유해·위험요인을 삭제하시겠습니까? 관련 감소대책도 함께 삭제됩니다.")) return;
    const { error: mErr } = await supabase.from("measures").delete().eq("hazard_id", hid);
    if (mErr) { console.error(mErr); toast.error(writeErrorMessage(mErr)); return; }
    const { data, error } = await supabase.from("hazards").delete().eq("id", hid).select();
    if (error) { console.error(error); toast.error(writeErrorMessage(error)); return; }
    if (!data || data.length === 0) { toast.error("권한이 없어 삭제할 수 없습니다"); return; }
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
        <p className="text-sm text-muted-foreground">위험성 결정은 매니저 이상만 사용할 수 있습니다.</p>
        <Link to="/assessment/$id" params={{ id }}><Button variant="outline" size="sm">돌아가기</Button></Link>
      </div>
    );
  }

  function standardize(method: string, level?: RiskLevel | null, likelihood?: number, severity?: number, ops_data?: any): RiskLevel | null {
    if (method === "빈도강도법" && likelihood && severity) {
      return scoreToRiskLevel(likelihood * severity);
    }
    if (method === "OPS") {
      const n = ops_data?.factors?.length ?? 0;
      if (n >= 3) return "높음";
      if (n === 2) return "보통";
      if (n === 1) return "낮음";
      return null;
    }
    return level ?? null;
  }

  async function updateHazard(hid: string, patch: any) {
    const merged = { ...patch };
    const h = hazards.find(x => x.id === hid);
    const lvl = standardize(a.method, patch.level ?? h.level, patch.likelihood ?? h.likelihood, patch.severity ?? h.severity, patch.ops_data ?? h.ops_data);
    if (lvl) { merged.level = merged.level ?? lvl; merged.level_standardized = lvl; }
    await supabase.from("hazards").update(merged).eq("id", hid);
    await load();
  }

  async function next() {
    setSaving(true);
    const allow = (a.allowable_level as RiskLevel) ?? "낮음";
    const exceed = hazards.filter(h => h.level && RISK_ORDER[h.level as RiskLevel] > RISK_ORDER[allow]);
    if (exceed.length === 0) {
      const { data, error } = await supabase.from("assessments").update({ status: "협의중" }).eq("id", id).select("id");
      if (error || !data?.length) { toast.error(writeErrorMessage(error, "체험 기간이 종료되었거나 권한이 없어 진행할 수 없습니다.")); setSaving(false); return; }
      toast.success("허용 수준 초과 항목이 없습니다. 협의·공유 단계로 이동합니다.");
      navigate({ to: "/assessment/$id/share", params: { id } });
    } else {
      toast.info(`${exceed.length}건의 항목이 감소대책 수립이 필요합니다.`);
      navigate({ to: "/assessment/$id/measures", params: { id } });
    }
    setSaving(false);
  }

  if (!a) return <div className="p-8 text-muted-foreground">불러오는 중...</div>;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-5">
      <div>
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="secondary">{a.method}</Badge>
          <span className="text-muted-foreground">{a.work_name}</span>
        </div>
        <h1 className="text-2xl font-bold mt-2">위험성 결정</h1>
        <p className="text-xs text-muted-foreground mt-1">
          위험성 결정 시 '낮음' 이상에 대해서는 위험성 감소대책을 수립해야 합니다. (고용노동부 지침)
        </p>
        <div className="mt-2 flex items-start gap-2 rounded-md border border-primary/30 bg-primary/[0.05] px-3 py-2 text-xs text-foreground/80">
          <Scale className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
          <span>각 항목의 <b className="text-primary">법적기준(법령)은 자동 매칭된 참고용 제안</b>이며 정확성을 보장하지 않습니다. 담당자가 반드시 확인하고, 맞지 않으면 <b>'수정' 버튼</b>으로 직접 고쳐 주세요. 최종 적용 책임은 사업장에 있습니다.</span>
        </div>
      </div>

      <div className="space-y-3">
        {hazards.map(h => (
          <Card key={h.id}><CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              {editingId === h.id ? (
                <div className="flex-1 flex gap-2">
                  <Input value={editDesc} onChange={e => setEditDesc(e.target.value)} className="h-9" />
                  <Button size="sm" variant="outline" onClick={() => saveDesc(h.id)}><Check className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <>
                  <div className="font-medium flex-1">{h.description}</div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setEditingId(h.id); setEditDesc(h.description); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => deleteHazard(h.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </>
              )}
            </div>

            {/* 법적기준 — 자동 매칭된 제안. 확인 후 맞지 않으면 직접 수정. */}
            <div className="rounded-md border border-primary/30 bg-primary/[0.05] p-2.5">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-semibold text-primary flex items-center gap-1.5 flex-wrap">
                  <Scale className="h-3.5 w-3.5 shrink-0" />
                  법적기준
                  <Badge variant="outline" className="text-[10px] font-normal border-primary/40 text-primary">자동 제안 · 확인/수정</Badge>
                </span>
                {editingLegalId !== h.id && (
                  <Button size="sm" variant="outline" className="h-7 px-2.5 gap-1 text-xs shrink-0 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
                    onClick={() => { setEditingLegalId(h.id); setEditLegal(effectiveLegal(h)); }}>
                    <Pencil className="h-3 w-3" />수정
                  </Button>
                )}
              </div>
              {editingLegalId === h.id ? (
                <div className="flex gap-2">
                  <Input value={editLegal} onChange={e => setEditLegal(e.target.value)} className="h-9 text-sm flex-1"
                    placeholder="예: 산업안전보건기준에 관한 규칙 제32조" autoFocus />
                  <Button size="sm" className="h-9 px-3 gap-1" onClick={() => saveLegal(h.id)}><Check className="h-4 w-4" />저장</Button>
                  <Button size="sm" variant="ghost" className="h-9 px-2" onClick={() => setEditingLegalId(null)}><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <div className={`text-sm ${effectiveLegal(h) ? "text-foreground" : "text-muted-foreground italic"}`}>
                  {effectiveLegal(h) || "자동 매칭 없음 — ‘수정’을 눌러 직접 입력하세요"}
                </div>
              )}
            </div>

            {a.method === "3단계_판단법" && (
              <div className="grid grid-cols-3 gap-2">
                {(["하","중","상"] as const).map(v => {
                  const lvl: RiskLevel = v === "상" ? "매우높음" : v === "중" ? "보통" : "낮음";
                  const sel = h.level === lvl;
                  return <button key={v} onClick={() => updateHazard(h.id, { level: lvl })}
                    className={`py-2.5 rounded-md border-2 text-sm font-semibold ${sel ? (v==="상"?"border-danger bg-danger/10 text-danger":v==="중"?"border-warning bg-warning/10 text-warning":"border-success bg-success/10 text-success") : "border-border"}`}>{v}</button>;
                })}
              </div>
            )}

            {a.method === "5단계_판단법" && (
              <div className="grid grid-cols-5 gap-1.5">
                {(["매우낮음","낮음","보통","높음","매우높음"] as RiskLevel[]).map(lvl => (
                  <button key={lvl} onClick={() => updateHazard(h.id, { level: lvl })}
                    className={`py-2 rounded-md border text-xs font-medium ${h.level===lvl?"border-primary bg-primary/10":"border-border"}`}>{lvl}</button>
                ))}
              </div>
            )}

            {a.method === "빈도강도법" && (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-16 text-muted-foreground">가능성</span>
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => updateHazard(h.id, { likelihood: n })}
                      className={`w-9 h-9 rounded border ${h.likelihood===n?"bg-primary text-primary-foreground border-primary":""}`}>{n}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-16 text-muted-foreground">중대성</span>
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => updateHazard(h.id, { severity: n })}
                      className={`w-9 h-9 rounded border ${h.severity===n?"bg-primary text-primary-foreground border-primary":""}`}>{n}</button>
                  ))}
                </div>
                {h.likelihood && h.severity && (
                  <div className="text-sm">
                    점수: <strong>{h.likelihood * h.severity}</strong>점 → <span className={`px-2 py-0.5 rounded text-xs ${riskLevelClass(h.level)}`}>{h.level}</span>
                  </div>
                )}
              </div>
            )}

            {a.method === "체크리스트법" && (
              <div className="flex gap-2">
                <button onClick={() => updateHazard(h.id, { checklist_result: "적정", level: "낮음" })}
                  className={`flex-1 py-2.5 rounded-md border-2 ${h.checklist_result==="적정"?"border-success bg-success/10 text-success":"border-border"}`}>○ 적정</button>
                <button onClick={() => updateHazard(h.id, { checklist_result: "보완", level: "높음" })}
                  className={`flex-1 py-2.5 rounded-md border-2 ${h.checklist_result==="보완"?"border-danger bg-danger/10 text-danger":"border-border"}`}>× 보완</button>
              </div>
            )}

            {a.method === "OPS" && (
              <OPSEditor h={h} onChange={(ops_data) => updateHazard(h.id, { ops_data })} />
            )}

            <div className="pt-2 border-t">
              <div className="text-xs text-muted-foreground mb-1.5">현장 사진</div>
              <PhotoUpload
                assessmentId={id}
                hazardId={h.id}
                photos={h.photos ?? []}
                onChange={(photos) => updateHazard(h.id, { photos })}
              />
            </div>

            {h.level && (
              <div className="flex items-center justify-between text-sm">
                <span className={`px-2 py-1 rounded font-medium ${riskLevelClass(h.level)}`}>{h.level}</span>
                {RISK_ORDER[h.level as RiskLevel] > RISK_ORDER[(a.allowable_level ?? "낮음") as RiskLevel] && (
                  <Link to="/assessment/$id/measures" params={{ id }} search={{ hazard: h.id }}>
                    <Badge className="bg-danger text-danger-foreground cursor-pointer hover:opacity-90">감소대책 수립 필요 →</Badge>
                  </Link>
                )}
              </div>
            )}
          </CardContent></Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={next} disabled={saving}>{saving?"...":"다음 단계로"}</Button>
      </div>
    </div>
  );
}

function OPSEditor({ h, onChange }: { h: any; onChange: (d: any) => void }) {
  const factors: string[] = h.ops_data?.factors ?? [];
  const [val, setVal] = useState("");
  return (
    <div className="space-y-2 text-sm">
      <div className="text-xs text-muted-foreground">핵심 위험요인 (최대 3개)</div>
      {factors.map((f, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="flex-1 bg-muted rounded px-2 py-1">{f}</span>
          <button onClick={() => onChange({ ...h.ops_data, factors: factors.filter((_, j) => j !== i) })} className="text-danger text-xs">삭제</button>
        </div>
      ))}
      {factors.length < 3 && (
        <div className="flex gap-2">
          <input value={val} onChange={e=>setVal(e.target.value)} placeholder="핵심 위험요인 입력"
            className="flex-1 h-9 px-3 rounded border bg-background text-sm" />
          <Button size="sm" variant="outline" onClick={() => { if (val.trim()) { onChange({ ...h.ops_data, factors: [...factors, val.trim()] }); setVal(""); } }}>추가</Button>
        </div>
      )}
    </div>
  );
}
