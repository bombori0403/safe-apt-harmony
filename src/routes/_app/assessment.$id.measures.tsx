import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RISK_ORDER, riskLevelClass, type RiskLevel } from "@/lib/types";
import { toast } from "sonner";
import { Pencil, Trash2, Check, X, Printer } from "lucide-react";

const MEASURE_TYPES = ["본질적_대책", "공학적_대책", "관리적_대책", "개인보호구"] as const;
const MEASURE_STATUSES = ["대기", "진행중", "완료"] as const;

function displayMeasureType(type: string | null) {
  return type?.replace("_대책", "") ?? "-";
}

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
  const allowLevel = (a?.allowable_level ?? "낮음") as RiskLevel;

  async function load() {
    const { data: ass } = await supabase.from("assessments").select("*").eq("id", id).maybeSingle();
    setA(ass);
    const { data: h } = await supabase.from("hazards").select("*, measures(*)").eq("assessment_id", id).order("created_at", { ascending: true });
    setItems(h ?? []);
  }
  useEffect(() => { load(); }, [id]);

  function isOverAllow(level: string | null) {
    if (!level) return false;
    return RISK_ORDER[level as RiskLevel] > RISK_ORDER[allowLevel];
  }

  async function addMeasure(hid: string, payload: any) {
    const { data, error } = await supabase.from("measures").insert({ hazard_id: hid, ...payload }).select();
    if (error) { console.error(error); toast.error(error.message); return; }
    if (!data || data.length === 0) { toast.error("권한이 없어 추가할 수 없습니다"); return; }
    toast.success("대책 추가됨"); load();
  }

  async function updateMeasure(mid: string, patch: any) {
    const { data, error } = await supabase.from("measures").update(patch).eq("id", mid).select();
    if (error) { console.error(error); toast.error(error.message); return; }
    if (!data || data.length === 0) { toast.error("권한이 없어 수정할 수 없습니다"); return; }
    toast.success("저장되었습니다"); load();
  }

  async function deleteMeasure(mid: string) {
    if (!confirm("이 감소대책을 삭제하시겠습니까?")) return;
    const { data, error } = await supabase.from("measures").delete().eq("id", mid).select();
    if (error) { console.error(error); toast.error(error.message); return; }
    if (!data || data.length === 0) { toast.error("권한이 없어 삭제할 수 없습니다"); return; }
    toast.success("삭제되었습니다"); load();
  }

  async function complete() {
    await supabase.from("assessments").update({ status: "협의중" }).eq("id", id);
    navigate({ to: "/assessment/$id/share", params: { id } });
  }

  if (!a) return <div className="p-8 text-muted-foreground">불러오는 중...</div>;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">위험성 감소대책</h1>
          <p className="text-xs text-muted-foreground mt-1">감소대책은 본질적→공학적→관리적→개인보호구 순으로 우선 고려해야 합니다.</p>
        </div>
        <Link to="/assessment/$id/measures-report" params={{ id }}>
          <Button variant="outline" size="sm" className="gap-1"><Printer className="h-4 w-4" />감소대책 출력</Button>
        </Link>
      </div>

      {items.length === 0 && (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          등록된 유해·위험요인이 없습니다. 먼저 유해·위험요인을 등록하세요.
        </CardContent></Card>
      )}

      {items.map(h => (
        <Card key={h.id}><CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium">{h.description}</div>
            <div className="flex items-center gap-2">
              {isOverAllow(h.level) && <span className="px-2 py-0.5 rounded text-[10px] bg-destructive/10 text-destructive">허용수준 초과</span>}
              {h.level && <span className={`px-2 py-1 rounded text-xs ${riskLevelClass(h.level)}`}>{h.level}</span>}
            </div>
          </div>
          <MeasureForm onAdd={(p) => addMeasure(h.id, p)} />
          {h.measures?.length > 0 && (
            <div className="space-y-1.5 mt-2">
              {h.measures.map((m: any) => (
                <MeasureRow key={m.id} m={m} onUpdate={(p) => updateMeasure(m.id, p)} onDelete={() => deleteMeasure(m.id)} />
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
  const [type, setType] = useState("관리적_대책");
  const [content, setContent] = useState("");
  const [resp, setResp] = useState("");
  const [due, setDue] = useState("");
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
      <div>
        <Label className="text-xs">대책 유형</Label>
        <select value={type} onChange={e=>setType(e.target.value)} className="w-full h-9 px-2 rounded border bg-background text-sm">
          {MEASURE_TYPES.map(value => <option key={value} value={value}>{displayMeasureType(value)}</option>)}
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
        <Button size="sm" type="button" onClick={() => { if (content.trim()) { onAdd({ type, content, responsible_name: resp, due_date: due || null }); setContent(""); } }}>대책 추가</Button>
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
    return (
      <div className="bg-muted/40 rounded p-2.5 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium flex-1">[{displayMeasureType(m.type)}] {m.content}</span>
          <span className="text-xs text-muted-foreground">{m.status}</span>
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
        {m.responsible_name && <div className="text-xs text-muted-foreground mt-0.5">책임자: {m.responsible_name} · {m.due_date ?? "-"}</div>}
      </div>
    );
  }

  return (
    <div className="bg-muted/40 rounded p-2.5 text-sm space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">대책 유형</Label>
          <select value={type} onChange={e=>setType(e.target.value)} className="w-full h-9 px-2 rounded border bg-background text-sm">
            {MEASURE_TYPES.map(value => <option key={value} value={value}>{displayMeasureType(value)}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs">상태</Label>
          <select value={status} onChange={e=>setStatus(e.target.value)} className="w-full h-9 px-2 rounded border bg-background text-sm">
            {MEASURE_STATUSES.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs">대책 내용</Label>
          <Input value={content} onChange={e=>setContent(e.target.value)} className="h-9" />
        </div>
        <div>
          <Label className="text-xs">책임자</Label>
          <Input value={resp} onChange={e=>setResp(e.target.value)} className="h-9" />
        </div>
        <div>
          <Label className="text-xs">이행 예정일</Label>
          <Input type="date" value={due ?? ""} onChange={e=>setDue(e.target.value)} className="h-9" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}><X className="h-4 w-4 mr-1" />취소</Button>
        <Button size="sm" onClick={() => {
          if (!content.trim()) { toast.error("내용을 입력하세요"); return; }
          onUpdate({ type, content, responsible_name: resp, due_date: due || null, status });
          setEditing(false);
        }}><Check className="h-4 w-4 mr-1" />저장</Button>
      </div>
    </div>
  );
}
