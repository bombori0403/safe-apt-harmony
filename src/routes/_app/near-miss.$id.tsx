import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/near-miss/$id")({
  component: NearMissDetail,
});

function NearMissDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<any>(null);
  const [countermeasure, setCountermeasure] = useState("");
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);
  async function load() {
    const { data } = await (supabase as any).from("near_miss").select("*").eq("id", id).maybeSingle();
    setItem(data);
    setCountermeasure(data?.countermeasure ?? "");
    setCompleted(!!data?.countermeasure_completed);
  }

  async function save() {
    setSaving(true);
    const { error } = await (supabase as any).from("near_miss").update({
      countermeasure: countermeasure || null,
      countermeasure_completed: completed,
    }).eq("id", id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("저장되었습니다");
    load();
  }

  async function remove() {
    if (!confirm("삭제하시겠습니까?")) return;
    const { error } = await (supabase as any).from("near_miss").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("삭제되었습니다");
    navigate({ to: "/near-miss" });
  }

  if (!item) return <div className="p-8 text-muted-foreground">불러오는 중...</div>;

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-4">
      <Link to="/near-miss"><Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4"/>목록</Button></Link>
      <h1 className="text-2xl font-bold">아차사고 상세</h1>

      <Card><CardContent className="p-5 space-y-3 text-sm">
        <Row label="발생 일시" value={new Date(item.occurred_at).toLocaleString("ko-KR")} />
        <Row label="장소" value={`${item.location_category ?? "-"}${item.location_detail ? " · "+item.location_detail : ""}`} />
        <Row label="유형" value={item.incident_type ?? "-"} />
        <Row label="예상 피해" value={item.potential_severity ?? "-"} />
        <div>
          <div className="text-xs text-muted-foreground">사고 경위</div>
          <p className="mt-1 whitespace-pre-wrap">{item.situation}</p>
        </div>
        {item.photos?.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">사진</div>
            <div className="flex flex-wrap gap-2">
              {item.photos.map((u:string,i:number)=>(
                <a key={i} href={u} target="_blank" rel="noreferrer">
                  <img src={u} alt="" className="w-24 h-24 object-cover rounded border" />
                </a>
              ))}
            </div>
          </div>
        )}
      </CardContent></Card>

      <Card><CardContent className="p-5 space-y-3">
        <h2 className="font-semibold">재발 방지 조치</h2>
        <div>
          <Label>조치 내용</Label>
          <Textarea value={countermeasure} onChange={e=>setCountermeasure(e.target.value)} rows={4} className="mt-1" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={completed} onChange={e=>setCompleted(e.target.checked)} />
          조치 완료
        </label>
        <div className="flex gap-2">
          <Button onClick={save} disabled={saving}>{saving?"저장 중...":"저장"}</Button>
          <Button variant="outline" onClick={remove} className="text-destructive">삭제</Button>
        </div>
      </CardContent></Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex border-b pb-2">
      <span className="w-24 text-muted-foreground text-xs">{label}</span>
      <span className="flex-1 font-medium">{value}</span>
    </div>
  );
}
