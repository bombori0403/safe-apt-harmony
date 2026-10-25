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
import { Plus, Trash2, Search } from "lucide-react";
import { StepHeader } from "@/components/step-header";
import { Term } from "@/components/term";

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
  const [allLib, setAllLib] = useState<any[]>([]);
  const [libQuery, setLibQuery] = useState("");
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

  // 검색용: 전체 라이브러리를 한 번 불러온다(카테고리 무관 키워드 검색).
  useEffect(() => {
    supabase.from("hazard_library")
      .select("id,description,default_likelihood,default_severity,suggested_measures,category")
      .order("sort_order").then(({ data }) => setAllLib(data ?? []));
  }, []);

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

  function addCustom() {
    const v = newCustom.trim();
    if (!v) return;
    setCustom((c) => [...c, v]);
    setNewCustom("");
  }

  async function submit() {
    // 직접 입력칸에 글이 남아 있으면 자동으로 넣지 않고 물어본다 (의도치 않은 등록·유실 둘 다 방지)
    let extra = custom;
    const pending = newCustom.trim();
    if (pending) {
      const add = window.confirm(`직접 입력칸에 "${pending}"이(가) 남아 있습니다.

[확인] 위험요인으로 추가하고 계속
[취소] 추가하지 않고 계속`);
      if (add) { extra = [...custom, pending]; setCustom(extra); }
      setNewCustom("");
    }
    setSaving(true);
    // 선택 항목은 카테고리 목록·검색결과 어디서 골랐든 전체 라이브러리(allLib)에서 조회.
    const src = allLib.length ? allLib : library;
    const libSel = src.filter(l => selected[l.id]);
    const rows = [
      ...libSel.map(l => ({
        assessment_id: id, description: l.description, library_item_id: l.id,
        ...prefillRisk(assessment.method, l.default_likelihood, l.default_severity),
      })),
      ...extra.map(c => ({ assessment_id: id, description: c, legal_basis_override: suggestLegalBasis(c)?.legal_basis ?? null })),
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

  const selCount = Object.values(selected).filter(Boolean).length;

  if (!assessment) return <div className="p-8 text-muted-foreground">불러오는 중...</div>;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-5">
      <StepHeader
        current="hazards"
        assessmentId={id}
        workName={assessment.work_name}
        method={assessment.method}
        todo={selCount + custom.length > 0
          ? `선택 ${selCount}건 · 직접 입력 ${custom.length}건 — 다 골랐으면 아래 '위험성 결정 단계로'를 누르세요`
          : "이 작업에서 다칠 수 있는 요인을 목록에서 고르거나 직접 적으세요"}
      />
      <p className="text-base"><Term k="유해위험요인" /></p>

      <Card><CardContent className="p-5 space-y-4">
        <div>
          <Label>작업 카테고리</Label>
          <p className="text-sm text-muted-foreground mt-1 mb-1.5">표준 항목을 고르면 관련 유해·위험요인이 아래에 자동 제안됩니다. 목록에 없으면 직접 입력하세요.</p>
          <select value={category} onChange={e=>setCategory(e.target.value as WorkCategory)}
            className="w-full h-11 px-3 rounded-md border bg-background text-base">
            {WORK_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
          <Input
            value={customCategory}
            onChange={e=>setCustomCategory(e.target.value)}
            placeholder="목록에 없는 작업이면 직접 입력 (예: 배관 누수 보수)"
            className="mt-2"
          />
        </div>

        <div>
          <Label>공동주택 표준 유해·위험요인</Label>
          <p className="text-sm text-muted-foreground mt-1 mb-2">
            해당하는 항목을 선택하세요 (다중 선택). 선택 시 <b>위험성(빈도·강도)과 대표 감소대책, 법적기준</b>이 자동으로 채워집니다 — 다음 단계에서 수정할 수 있어요.
          </p>

          {/* 키워드 검색 — 입력하면 전체 분류에서 찾고, 비우면 위에서 고른 분류 목록을 보여줌 */}
          <div className="relative mb-2">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={libQuery} onChange={e => setLibQuery(e.target.value)}
              placeholder="키워드 검색 (예: 감전, 사다리, 미끄럼) — 전체 분류에서 찾기" className="pl-9" />
          </div>

          {(() => {
            const nq = libQuery.replace(/\s/g, "");
            const searching = nq.length > 0;
            const matched = searching
              ? allLib.filter(l => l.description?.replace(/\s/g, "").includes(nq))
              : library;
            const shown = matched.slice(0, 80);
            if (searching && matched.length === 0) {
              return <div className="text-sm text-muted-foreground py-4 text-center">‘{libQuery}’에 맞는 항목이 없어요. 아래 <b>직접 입력</b>으로 추가하세요.</div>;
            }
            return (
              <>
                {searching && (
                  <div className="text-sm text-muted-foreground mb-1.5">전체 분류에서 {matched.length}건 찾음{matched.length > 80 ? " (상위 80건 표시 — 더 구체적으로 검색)" : ""}</div>
                )}
                <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
                  {shown.map(l => (
                    <label key={l.id} className="flex items-start gap-3 p-2.5 rounded-md hover:bg-muted/40 cursor-pointer text-base">
                      <input type="checkbox" className="mt-1"
                        checked={!!selected[l.id]}
                        onChange={e => setSelected({ ...selected, [l.id]: e.target.checked })} />
                      <span className="flex-1">
                        {l.description}
                        {searching && l.category && (
                          <span className="ml-1.5 text-sm text-muted-foreground">· {CATEGORY_LABEL[l.category as WorkCategory] ?? l.category}</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </>
            );
          })()}
        </div>

        <div>
          <Label>직접 입력</Label>
          <div className="flex gap-2 mt-1">
            <Input value={newCustom} onChange={e=>setNewCustom(e.target.value)} placeholder="추가할 유해·위험요인"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} />
            <Button type="button" variant="outline" onClick={addCustom} disabled={!newCustom.trim()} className="gap-1 shrink-0">
              <Plus className="h-5 w-5" />추가
            </Button>
          </div>
          {newCustom.trim() && (
            <p className="text-sm text-muted-foreground mt-1">
              {suggestLegalBasis(newCustom)
                ? `예상 법적기준: ${suggestLegalBasis(newCustom)!.legal_basis}`
                : "일치하는 법적기준을 찾지 못했어요. 추가 후 필요하면 수동으로 보완하세요."}
            </p>
          )}
          {custom.length > 0 && (
            <ul className="mt-2 space-y-1">
              {custom.map((c, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-base bg-muted/40 rounded px-3 py-1.5">
                  <div>
                    <div>{c}</div>
                    {suggestLegalBasis(c) && (
                      <div className="text-sm text-muted-foreground mt-0.5">{suggestLegalBasis(c)!.legal_basis}</div>
                    )}
                  </div>
                  <Button type="button" size="icon" variant="ghost" aria-label="이 항목 삭제" onClick={() => setCustom(custom.filter((_, j) => j !== i))}><Trash2 className="h-5 w-5 text-danger" /></Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent></Card>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="text-base text-muted-foreground">선택 <b className="text-foreground">{selCount}</b>건 · 직접 입력 <b className="text-foreground">{custom.length}</b>건</span>
        <Button size="lg" onClick={submit} disabled={saving}>{saving?"저장 중...":"위험성 결정 단계로"}</Button>
      </div>
    </div>
  );
}
