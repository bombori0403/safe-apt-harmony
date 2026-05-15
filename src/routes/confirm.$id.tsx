import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { submitParticipantConfirmation, getConfirmInfo } from "@/lib/confirm.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignaturePad } from "@/components/signature-pad";
import { Shield, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { submitParticipantConfirmation } from "@/lib/confirm.functions";

export const Route = createFileRoute("/confirm/$id")({
  component: Confirm,
});

function Confirm() {
  const { id } = Route.useParams();
  const [a, setA] = useState<any>(null);
  const [parts, setParts] = useState<any[]>([]);
  const [pid, setPid] = useState<string>("");
  const [name, setName] = useState("");
  const [sig, setSig] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: ass } = await supabase.from("assessments").select("work_name,assessment_date,method").eq("id", id).maybeSingle();
      setA(ass);
      const { data: p } = await supabase.from("participants").select("id,name,role").eq("assessment_id", id);
      setParts(p ?? []);
    })();
  }, [id]);

  async function submit() {
    setSaving(true);
    try {
      if (!sig) { toast.error("서명을 입력하세요"); return; }
      if (!pid && !name.trim()) { toast.error("이름을 입력하거나 명단에서 선택하세요"); return; }
      await submitParticipantConfirmation({
        data: {
          assessmentId: id,
          participantId: pid || null,
          name: pid ? null : name.trim(),
          signatureImage: sig,
          userAgent: navigator.userAgent,
        },
      });
      setDone(true);
    } catch (e: any) {
      toast.error(e.message ?? "오류");
    } finally {
      setSaving(false);
    }
  }


  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background to-accent/30">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-3">
            <CheckCircle2 className="h-16 w-16 text-success mx-auto" />
            <h1 className="text-xl font-bold">확인이 완료되었습니다</h1>
            <p className="text-sm text-muted-foreground">참여 기록이 정상적으로 저장되었습니다.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-accent/30 p-4 py-8">
      <div className="max-w-md mx-auto space-y-4">
        <div className="text-center">
          <Shield className="h-10 w-10 text-primary mx-auto" />
          <h1 className="text-xl font-bold mt-2">위험성평가 참여 확인</h1>
        </div>

        {a && (
          <Card><CardContent className="p-4 text-sm space-y-1">
            <div><span className="text-muted-foreground">작업명: </span><span className="font-medium">{a.work_name}</span></div>
            <div><span className="text-muted-foreground">평가일: </span>{a.assessment_date}</div>
            <div><span className="text-muted-foreground">방법: </span>{a.method}</div>
          </CardContent></Card>
        )}

        <Card><CardContent className="p-4 space-y-4">
          {parts.length > 0 && (
            <div>
              <Label>본인 선택</Label>
              <select value={pid} onChange={e=>setPid(e.target.value)}
                className="w-full h-10 px-3 rounded-md border bg-background text-sm mt-1">
                <option value="">— 명단에 없으면 비워두고 아래에 이름 입력 —</option>
                {parts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.role ?? "근로자"})</option>)}
              </select>
            </div>
          )}
          {!pid && (
            <div>
              <Label>이름 (명단에 없을 때)</Label>
              <Input value={name} onChange={e=>setName(e.target.value)} placeholder="홍길동" />
            </div>
          )}
          <div>
            <Label>서명</Label>
            <SignaturePad onChange={setSig} />
          </div>
          <Button onClick={submit} disabled={saving || !sig} className="w-full h-11">
            {saving ? "저장 중..." : "확인 및 제출"}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            본 기록은 산업안전보건법 제36조 제2항에 따른 근로자 참여 증빙으로 보존됩니다.
          </p>
        </CardContent></Card>
      </div>
    </div>
  );
}
