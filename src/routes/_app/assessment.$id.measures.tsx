import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RISK_ORDER, riskLevelClass, type RiskLevel } from "@/lib/types";
import { toast } from "sonner";
import { Pencil, Trash2, Check, X } from "lucide-react";

export const Route = createFileRoute("/_app/assessment/$id/measures")({
  component: Measures,
});

function Measures() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [a, setA] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);

  async function load() {
    const { data: ass } = await supabase.from("assessments").select("*").eq("id", id).maybeSingle();
    setA(ass);
    const { data: h } = await supabase.from("hazards").select("*, measures(*)").eq("assessment_id", id);
    const allow = (ass?.allowable_level ?? "낮음") as RiskLevel;
    setItems((h ?? []).filter((x: any) => x.level && RISK_ORDER[x.level as RiskLevel] > RISK_ORDER[allow]));
  }
  useEffect(() => { load(); }, [id]);

  async function addMeasure(hid: string, payload: any) {
    const { error } = await supabase.from("measures").insert({ hazard_id: hid, ...payload });
    if (error) toast.error(error.message); else { toast.success("대책 추가됨"); load(); }
  }

  async function updateMeasure(mid: string, patch: any) {
    const { error } = await supabase.from("measures").update(patch).eq("id", mid);
    if (error) { toast.error(error.message); return; }
    toast.success("저장되었습니다"); load();
  }

  async function deleteMeasure(mid: string) {
    if (!confirm("이 감소대책을 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("measures").delete().eq("id", mid);
    if (error) { toast.error(error.message); return; }
    toast.success("삭제되었습니다"); load();
  }

  async function complete() {
    await supabase.from("assessments").update({ status: "협의중" }).eq("id", id);
    navigate({ to: "/assessment/$id/share", params: { id } });
  }

  if (!a) return <div className="p-8 text-muted-foreground">불러오는 중...</div>;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold">위험성 감소대책</h1>
        <p className="text-xs text-muted-foreground mt-1">감소대책은 본질적→공학적→관리적→개인보호구 순으로 우선 고려해야 합니다.</p>
      </div>

      {items.length === 0 && (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          허용 수준 초과 항목이 없습니다.
        </CardContent></Card>
      )}

      {items.map(h => (
        <Card key={h.id}><CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium">{h.description}</div>
            <span className={`px-2 py-1 rounded text-xs ${riskLevelClass(h.level)}`}>{h.level}</span>
          </div>
          <MeasureForm onAdd={(p) => addMeasure(h.id, p)} />
          {h.measures?.length > 0 && (
            <div className="space-y-1.5 mt-2">
              {h.measures.map((m: any) => (
                <div key={m.id} className="bg-muted/40 rounded p-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">[{m.measure_type}] {m.content}</span>
                    <span className="text-xs text-muted-foreground">{m.status}</span>
                  </div>
                  {m.responsible_name && <div className="text-xs text-muted-foreground mt-0.5">책임자: {m.responsible_name} · {m.due_date}</div>}
                </div>
              ))}
            </div>
          )}
        </CardContent></Card>
      ))}

      <div className="flex justify-end">
        <Button onClick={complete}>협의·공유 단계로</Button>
      </div>
    </div>
  );
}

function MeasureForm({ onAdd }: { onAdd: (p: any) => void }) {
  const [type, setType] = useState("관리적");
  const [content, setContent] = useState("");
  const [resp, setResp] = useState("");
  const [due, setDue] = useState("");
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
      <div>
        <Label className="text-xs">대책 유형</Label>
        <select value={type} onChange={e=>setType(e.target.value)} className="w-full h-9 px-2 rounded border bg-background text-sm">
          <option>본질적</option><option>공학적</option><option>관리적</option><option>개인보호구</option>
        </select>
      </div>
      <div>
        <Label className="text-xs">책임자</Label>
        <Input value={resp} onChange={e=>setResp(e.target.value)} className="h-9" />
      </div>
      <div className="md:col-span-2">
        <Label className="text-xs">대책 내용</Label>
        <Input value={content} onChange={e=>setContent(e.target.value)} className="h-9" placeholder="예: 안전난간 설치, 작업절차서 비치" />
      </div>
      <div>
        <Label className="text-xs">이행 예정일</Label>
        <Input type="date" value={due} onChange={e=>setDue(e.target.value)} className="h-9" />
      </div>
      <div className="flex items-end">
        <Button size="sm" type="button" onClick={() => { if (content.trim()) { onAdd({ measure_type: type, content, responsible_name: resp, due_date: due || null }); setContent(""); } }}>대책 추가</Button>
      </div>
    </div>
  );
}
