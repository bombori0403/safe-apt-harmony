import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { getCurrentUserContext } from "@/lib/user-context";

export const Route = createFileRoute("/_app/work-stop-records")({
  component: WorkStopRecords,
});

function WorkStopRecords() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [userRowId, setUserRowId] = useState("");
  const [complexes, setComplexes] = useState<{id:string;name:string}[]>([]);
  const [complexId, setComplexId] = useState("");

  const [exercisedAt, setExercisedAt] = useState(new Date().toISOString().slice(0,16));
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [workDesc, setWorkDesc] = useState("");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState("작업중단");
  const [resultDetail, setResultDetail] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    getCurrentUserContext(user.id).then(async ({ userId, complexId: ctx }) => {
      if (userId) setUserRowId(userId);
      const { data: members } = await supabase.from("complex_members").select("complex_id").eq("user_id", userId ?? "");
      const ids = [...new Set((members ?? []).map((m:any)=>m.complex_id).filter(Boolean))];
      const { data: list } = ids.length
        ? await supabase.from("complexes").select("id,name").in("id", ids)
        : { data: [] };
      setComplexes(list ?? []);
      setComplexId(ctx ?? list?.[0]?.id ?? "");
    });
  }, [user]);

  useEffect(() => { load(); }, []);
  async function load() {
    const { data } = await (supabase as any).from("work_stop_records").select("*").order("exercised_at", { ascending: false });
    setItems(data ?? []);
  }

  async function submit() {
    if (!complexId) { toast.error("단지를 선택해주세요"); return; }
    if (!name || !workDesc || !reason) { toast.error("필수 항목을 입력해주세요"); return; }
    setSaving(true);
    const { error } = await (supabase as any).from("work_stop_records").insert({
      complex_id: complexId,
      reported_by: userRowId || null,
      exercised_at: new Date(exercisedAt).toISOString(),
      exerciser_name: name,
      exerciser_position: position || null,
      work_description: workDesc,
      stop_reason: reason,
      result,
      result_detail: resultDetail || null,
      reflected_in_assessment: false,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("등록되었습니다");
    setOpen(false);
    setName(""); setPosition(""); setWorkDesc(""); setReason(""); setResultDetail("");
    load();
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">작업중지권 행사 기록</h1>
          <p className="text-sm text-muted-foreground mt-1">산업안전보건법 제52조에 따른 작업중지권 행사 이력입니다.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/work-stop-right"><Button variant="outline" size="sm">법령 안내</Button></Link>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gap-1.5"><Plus className="h-4 w-4"/>신규 등록</Button></DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>작업중지권 행사 등록</DialogTitle></DialogHeader>
              <div className="space-y-3">
                {complexes.length > 1 && (
                  <div>
                    <Label>단지</Label>
                    <select value={complexId} onChange={e=>setComplexId(e.target.value)} className="w-full h-10 px-3 rounded-md border bg-background text-sm mt-1">
                      {complexes.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <Label>행사 일시</Label>
                  <Input type="datetime-local" value={exercisedAt} onChange={e=>setExercisedAt(e.target.value)} className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>행사자 성명</Label><Input value={name} onChange={e=>setName(e.target.value)} className="mt-1" /></div>
                  <div><Label>직책</Label><Input value={position} onChange={e=>setPosition(e.target.value)} className="mt-1" /></div>
                </div>
                <div><Label>작업 내용</Label><Textarea value={workDesc} onChange={e=>setWorkDesc(e.target.value)} rows={2} className="mt-1" /></div>
                <div><Label>중지 사유</Label><Textarea value={reason} onChange={e=>setReason(e.target.value)} rows={3} className="mt-1" placeholder="급박한 위험 요인을 구체적으로 작성" /></div>
                <div>
                  <Label>처리 결과</Label>
                  <div className="flex gap-2 mt-1">
                    {["작업중단","작업재개"].map(r=>(
                      <button key={r} type="button" onClick={()=>setResult(r)}
                        className={`flex-1 py-2 rounded-md border text-sm ${result===r?"bg-primary text-primary-foreground border-primary":"bg-background"}`}>{r}</button>
                    ))}
                  </div>
                </div>
                <div><Label>결과 상세</Label><Textarea value={resultDetail} onChange={e=>setResultDetail(e.target.value)} rows={2} className="mt-1" /></div>
                <Button onClick={submit} disabled={saving} className="w-full">{saving?"등록 중...":"등록"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">등록된 기록이 없습니다.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {items.map((it:any)=>(
            <Card key={it.id}>
              <CardContent className="p-4 flex gap-3">
                <div className="p-2 rounded-md bg-warning/15 text-warning h-fit"><ShieldAlert className="h-4 w-4"/></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{new Date(it.exercised_at).toLocaleString("ko-KR")}</span>
                    <span>· {it.exerciser_name}{it.exerciser_position ? ` (${it.exerciser_position})` : ""}</span>
                    <span className={`ml-auto px-2 py-0.5 rounded text-[11px] ${it.result==="작업재개"?"bg-success/15 text-success":"bg-warning/15 text-warning"}`}>{it.result}</span>
                  </div>
                  <div className="mt-1 text-sm font-medium">{it.work_description}</div>
                  <div className="mt-1 text-xs text-muted-foreground line-clamp-2">사유: {it.stop_reason}</div>
                  {it.result_detail && <div className="mt-1 text-xs">결과: {it.result_detail}</div>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
