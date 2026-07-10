import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WORK_CATEGORIES, CATEGORY_LABEL, type WorkCategory } from "@/lib/types";
import { toast } from "sonner";
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
  const [library, setLibrary] = useState<{ id: string; description: string }[]>([]);
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
    supabase.from("hazard_library").select("id,description").eq("category", category).order("sort_order").then(({ data }) => {
      setLibrary(data ?? []);
    });
  }, [category]);

  async function submit() {
    setSaving(true);
    const rows = [
      ...library.filter(l => selected[l.id]).map(l => ({ assessment_id: id, description: l.description, library_item_id: l.id })),
      ...custom.map(c => ({ assessment_id: id, description: c })),
    ];
    if (rows.length === 0) { toast.error("최소 1개 이상의 유해·위험요인을 선택하세요"); setSaving(false); return; }
    const { error } = await supabase.from("hazards").insert(rows);
    if (error) { toast.error(error.message); setSaving(false); return; }
    await supabase.from("assessments").update({ work_category: customCategory.trim() || category }).eq("id", id);
    toast.success(`${rows.length}건 추가됨. 위험성 결정 단계로 이동합니다.`);
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
          <p className="text-xs text-muted-foreground mt-1 mb-2">해당하는 항목을 선택하세요 (다중 선택)</p>
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
          {custom.length > 0 && (
            <ul className="mt-2 space-y-1">
              {custom.map((c, i) => (
                <li key={i} className="flex items-center justify-between text-sm bg-muted/40 rounded px-3 py-1.5">
                  <span>{c}</span>
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
