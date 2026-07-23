import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WORK_CATEGORIES, CATEGORY_LABEL, scoreToRiskLevel, type WorkCategory, type RiskLevel } from "@/lib/types";
import { suggestLegalBasis } from "@/lib/legal-basis-keywords";
import { toast } from "sonner";
import { writeErrorMessage } from "@/lib/write-error";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/assessment/$id/hazards")({
  component: Hazards,
});

function Hazards() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState<any>(null);
  const [category, setCategory] = useState<WorkCategory>("승강기_점검정비");
  const [customCategory, setCustomCategory] = useState("");
  const [library, setLibrary] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [custom, setCustom] = useState<string[]>([]);
  const [newCustom, setNewCustom] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("assessments").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      setAssessment(data);
      if (data?.work_category) {
        if ((WORK_CATEGORIES as string[]).includes(data.work_category)) {
          setCategory(data.work_category as WorkCategory);
        } else {
          setCustomCategory(data.work_category);
        }
      }
    });
  }, [id]);

  useEffect(() => {
    supabase.from("hazard_library")
      .select("id,description,default_likelihood,default_severity,suggested_measures")
      .eq("category", category).order("sort_order").then(({ data }) => {
        setLibrary(data ?? []);
      });
  }, [category]);

  // 라이브러리 기본 빈도·강도(빈도강도법 기준)를 평가방법에 맞는 위험성으로 환산해 미리 채운다.
  function prefillRisk(method: string, l?: number | null, s?: number | null): Record<string, any> {
    if (!l || !s) return {};
    const base = scoreToRiskLevel(l * s) as RiskLevel;
    if (method === "빈도강도법") return { likelihood: l, severity: s, level: base, level_standardized: base };
    if (method === "5단계_판단법") return { level: base, level_standardized: base };
    if (method === "3단계_판단법") {
      const lvl: RiskLevel = base === "높음" || base === "매우높음" ? "매우높음" : base === "보통" ? "보통" : "낮음";
      return { level: lvl, level_standardized: lvl };
    }
    return {}; // 체크리스트/OPS 등은 사용자가 직접 판단
  }

  async function submit() {
    setSaving(true);
    const libSel = library.filter(l => selected[l.id]);
    const rows = [
      ...libSel.map(l => ({
        assessment_id: id, description: l.description, library_item_id: l.id,
        ...prefillRisk(assessment.method, l.default_likelihood, l.default_severity),
      })),
      ...custom.map(c => ({ assessment_id: id, description: c, legal_basis_override: suggestLegalBasis(c)?.legal_basis ?? null })),
    ];
    if (rows.length === 0) {
      // 재검토 등으로 이미 위험요인이 등록돼 있으면 추가 없이 다음 단계로 진행
      const { count } = await supabase.from("hazards").select("id", { count: "exact", head: true }).eq("assessment_id", id);
      if ((count ?? 0) > 0) {
        await supabase.from("assessments").update({ work_category: customCategory.trim() || category }).eq("id", id);
        navigate({ to: "/assessment/$id/results", params: { id } });
        return;
      }
      toast.error("최소 1개 이상의 유해·위험요인을 선택하세요"); setSaving(false); return;
    }
    const { data: inserted, error } = await supabase.from("hazards").insert(rows).select("id, library_item_id");
    if (error) { toast.error(writeErrorMessage(error)); setSaving(false); return; }

    // 라이브러리 대표 감소대책을 초기 대책으로 자동 생성
    const measureRows: any[] = [];
    for (const h of inserted ?? []) {
      if (!h.library_item_id) continue;
      const lib = libSel.find(l => l.id === h.library_item_id);
      const sm = Array.isArray(lib?.suggested_measures) ? lib.suggested_measures : [];
      for (const m of sm) {
        if (m && String(m).trim()) measureRows.push({ hazard_id: h.id, content: String(m).trim(), type: "관리적_대책", status: "대기" });
      }
    }
    let measuresOk = 0;
    if (measureRows.length) {
      const { error: me } = await supabase.from("measures").insert(measureRows);
      if (me) console.error("감소대책 자동등록 실패:", me);
      else measuresOk = measureRows.length;
    }

    await supabase.from("assessments").update({ work_category: customCategory.trim() || category }).eq("id", id);
    const mMsg = measuresOk ? ` · 감소대책 ${measuresOk}건 자동 등록` : "";
    toast.success(`${rows.length}건 추가됨${mMsg}. 위험성 결정 단계로 이동합니다.`);
    navigate({ to: "/assessment/$id/results", params: { id } });
  }

  if (!assessment) return <div className="p-8 text-muted-foreground">불러오는 중...</div>;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-5">
      <div>
        <div className="text-sm text-muted-foreground">{assessment.work_name} · {assessment.method}</div>
        <h1 className="text-2xl font-bold mt-1">유해·위험요인 파악</h1>
      </div>

      <Card><CardContent className="p-5 space-y-4">
        <div>
          <Label>작업 카테고리</Label>
          <p className="text-xs text-muted-foreground mt-1 mb-1.5">표준 항목을 고르면 관련 유해·위험요인이 아래에 자동 제안됩니다. 목록에 없으면 직접 입력하세요.</p>
          <select value={category} onChange={e=>setCategory(e.target.value as WorkCategory)}
            className="w-full h-10 px-3 rounded-md border bg-background text-sm">
            {WORK_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
          <Input
            value={customCategory}
            onChange={e=>setCustomCategory(e.target.value)}
            placeholder="목록에 없는 작업이면 직접 입력 (예: 배관 누수 보수)"
            className="h-10 mt-2"
          />
        </div>

        <div>
          <Label>공동주택 표준 유해·위험요인</Label>
          <p className="text-xs text-muted-foreground mt-1 mb-2">
            해당하는 항목을 선택하세요 (다중 선택). 선택 시 <b>위험성(빈도·강도)과 대표 감소대책, 법적기준</b>이 자동으로 채워집니다 — 다음 단계에서 수정할 수 있어요.
          </p>
          <div className="space-y-1.5">
            {library.map(l => (
              <label key={l.id} className="flex items-start gap-2 p-2.5 rounded-md hover:bg-muted/40 cursor-pointer text-sm">
                <input type="checkbox" className="mt-0.5"
                  checked={!!selected[l.id]}
                  onChange={e => setSelected({ ...selected, [l.id]: e.target.checked })} />
                <span>{l.description}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <Label>직접 입력</Label>
          <div className="flex gap-2 mt-1">
            <Input value={newCustom} onChange={e=>setNewCustom(e.target.value)} placeholder="추가할 유해·위험요인" />
            <Button type="button" variant="outline" onClick={() => { if (newCustom.trim()) { setCustom([...custom, newCustom.trim()]); setNewCustom(""); } }}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {newCustom.trim() && (
            <p className="text-xs text-muted-foreground mt-1">
              {suggestLegalBasis(newCustom)
                ? `예상 법적기준: ${suggestLegalBasis(newCustom)!.legal_basis}`
                : "일치하는 법적기준을 찾지 못했어요. 추가 후 필요하면 수동으로 보완하세요."}
            </p>
          )}
          {custom.length > 0 && (
            <ul className="mt-2 space-y-1">
              {custom.map((c, i) => (
                <li key={i} className="flex items-center justify-between text-sm bg-muted/40 rounded px-3 py-1.5">
                  <div>
                    <div>{c}</div>
                    {suggestLegalBasis(c) && (
                      <div className="text-[11px] text-muted-foreground mt-0.5">{suggestLegalBasis(c)!.legal_basis}</div>
                    )}
                  </div>
                  <button type="button" onClick={() => setCustom(custom.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5 text-danger" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent></Card>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={saving}>{saving?"저장 중...":"위험성 결정 단계로"}</Button>
      </div>
    </div>
  );
}
