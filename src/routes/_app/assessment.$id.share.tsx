import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { QrCode, MessageSquare, Link2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/assessment/$id/share")({
  component: Share,
});

function Share() {
  const { id } = Route.useParams();
  const [a, setA] = useState<any>(null);
  const [parts, setParts] = useState<any[]>([]);
  const [sigs, setSigs] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");

  async function load() {
    const { data: ass } = await supabase.from("assessments").select("*").eq("id", id).maybeSingle();
    setA(ass);
    const { data: p } = await supabase.from("participants").select("*").eq("assessment_id", id);
    setParts(p ?? []);
    const { data: s } = await supabase.from("signatures").select("*").eq("assessment_id", id);
    setSigs(s ?? []);
  }
  useEffect(() => { load(); }, [id]);

  async function addPart() {
    if (!name.trim()) return;
    const { error } = await supabase.from("participants").insert({ assessment_id: id, name, role, participation_role: "근로자" });
    if (error) toast.error(error.message); else { setName(""); setRole(""); load(); }
  }

  async function markConfirmed(pid: string) {
    const ua = navigator.userAgent;
    const { error } = await supabase.from("signatures").insert({
      assessment_id: id, participant_id: pid,
      signature_image: "data:signed",
      user_agent: ua,
      ip_address: "기록됨",
    });
    if (error) toast.error(error.message); else { toast.success("확인 기록됨"); load(); }
  }

  async function finish() {
    await supabase.from("assessments").update({ status: "완료" }).eq("id", id);
    toast.success("평가가 완료되었습니다");
  }

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/assessment/${id}/share`);
    toast.success("공유 링크 복사됨");
  }

  if (!a) return <div className="p-8 text-muted-foreground">불러오는 중...</div>;

  const confirmedIds = new Set(sigs.map(s => s.participant_id));
  const rate = parts.length === 0 ? 0 : Math.round((confirmedIds.size / parts.length) * 100);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold">협의·공유</h1>
        <p className="text-xs text-muted-foreground mt-1">
          본 전자기록은 산업안전보건법 제36조 제2항에 따른 근로자 참여 기록으로 보존됩니다.
        </p>
      </div>

      <Card><CardContent className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><div className="text-xs text-muted-foreground">평가일</div><div className="font-medium">{a.assessment_date}</div></div>
          <div><div className="text-xs text-muted-foreground">작업명</div><div className="font-medium">{a.work_name}</div></div>
          <div><div className="text-xs text-muted-foreground">방법</div><div className="font-medium">{a.method}</div></div>
          <div><div className="text-xs text-muted-foreground">상태</div><div className="font-medium">{a.status}</div></div>
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">참여자 확인 ({confirmedIds.size}/{parts.length})</h2>
          <Badge variant="outline">{rate}%</Badge>
        </div>
        <div className="h-2 bg-muted rounded overflow-hidden">
          <div className="h-full bg-success transition-all" style={{ width: `${rate}%` }} />
        </div>

        <div className="divide-y mt-2">
          {parts.map(p => {
            const ok = confirmedIds.has(p.id);
            return (
              <div key={p.id} className="py-2.5 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{p.name} <span className="text-muted-foreground text-xs ml-1">{p.role}</span></div>
                  <div className="text-xs text-muted-foreground">{p.participation_role}</div>
                </div>
                {ok ? (
                  <span className="flex items-center gap-1 text-success text-xs"><CheckCircle2 className="h-4 w-4" />확인됨</span>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => markConfirmed(p.id)}>확인 기록</Button>
                )}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-2 pt-3 border-t">
          <Input value={name} onChange={e=>setName(e.target.value)} placeholder="이름" />
          <Input value={role} onChange={e=>setRole(e.target.value)} placeholder="직책" />
          <Button onClick={addPart}>참여자 추가</Button>
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-5 space-y-3">
        <h2 className="font-semibold">공유 방식</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Button variant="outline" className="gap-2" onClick={() => toast.info("QR 출력 기능 준비 중")}><QrCode className="h-4 w-4" />QR 출력</Button>
          <Button variant="outline" className="gap-2" onClick={() => toast.info("카카오 알림톡 발송 기능 준비 중")}><MessageSquare className="h-4 w-4" />알림톡 발송</Button>
          <Button variant="outline" className="gap-2" onClick={copyLink}><Link2 className="h-4 w-4" />공유 링크 복사</Button>
        </div>
      </CardContent></Card>

      <div className="flex justify-between">
        <Link to="/history"><Button variant="outline">이력으로</Button></Link>
        <Button onClick={finish}>평가 완료</Button>
      </div>
    </div>
  );
}
