import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SignaturePad } from "@/components/signature-pad";
import { QrCode, MessageSquare, Link2, CheckCircle2, Printer } from "lucide-react";
import { toast } from "sonner";
import { writeErrorMessage } from "@/lib/write-error";

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
  const [signFor, setSignFor] = useState<any>(null);
  const [signImg, setSignImg] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const qrRef = useRef<HTMLImageElement | null>(null);

  const confirmUrl = typeof window !== "undefined" ? `${window.location.origin}/confirm/${id}` : "";

  async function load() {
    const { data: ass } = await supabase.from("assessments").select("*").eq("id", id).maybeSingle();
    setA(ass);
    const { data: p } = await supabase.from("participants").select("*").eq("assessment_id", id);
    setParts(p ?? []);
    const { data: s } = await supabase.from("signatures").select("*").eq("assessment_id", id);
    setSigs(s ?? []);
  }
  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (confirmUrl) QRCode.toDataURL(confirmUrl, { width: 320, margin: 1 }).then(setQrUrl).catch(() => {});
  }, [confirmUrl]);

  async function addPart() {
    if (!name.trim()) return;
    const { error } = await supabase.from("participants").insert({ assessment_id: id, name, role, participation_role: "근로자" });
    if (error) toast.error(error.message); else { setName(""); setRole(""); load(); }
  }

  async function saveSignature() {
    if (!signImg || !signFor) { toast.error("서명을 입력하세요"); return; }
    const { error } = await supabase.from("signatures").insert({
      assessment_id: id,
      participant_id: signFor.id,
      signature_image: signImg,
      user_agent: navigator.userAgent,
      ip_address: "기록됨",
    });
    if (error) toast.error(error.message);
    else {
      toast.success(`${signFor.name}님의 서명이 기록되었습니다`);
      setSignFor(null);
      setSignImg(null);
      load();
    }
  }

  async function finish() {
    const { data, error } = await supabase.from("assessments").update({ status: "완료" }).eq("id", id).select("id");
    if (error || !data?.length) { toast.error(writeErrorMessage(error, "체험 기간이 종료되었거나 권한이 없어 완료할 수 없습니다.")); return; }
    toast.success("평가가 완료되었습니다");
    load();
  }

  function copyLink() {
    navigator.clipboard.writeText(confirmUrl);
    toast.success("참여자 확인 링크가 복사되었습니다");
  }

  function printQR() {
    const w = window.open("", "_blank", "width=600,height=800");
    if (!w) return;
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const workName = esc(a?.work_name ?? "");
    const qrSrc = esc(qrUrl);
    const url = esc(confirmUrl);
    w.document.write(`<html><head><title>QR 출력 — ${workName}</title></head><body style="font-family:sans-serif;text-align:center;padding:40px;">
      <h2>${workName}</h2>
      <p>참여자 확인 QR</p>
      <img src="${qrSrc}" style="width:320px;height:320px;" />
      <p style="font-size:12px;color:#666;margin-top:24px;">${url}</p>
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
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
            const sig = sigs.find(s => s.participant_id === p.id);
            return (
              <div key={p.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{p.name} <span className="text-muted-foreground text-xs ml-1">{p.role}</span></div>
                  <div className="text-xs text-muted-foreground">{p.participation_role}</div>
                  {sig && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      서명: {new Date(sig.signed_at).toLocaleString("ko-KR")}
                    </div>
                  )}
                </div>
                {sig ? (
                  <div className="flex items-center gap-2">
                    {sig.signature_image?.startsWith("data:image") && (
                      <img src={sig.signature_image} alt="서명" className="h-10 w-20 object-contain border rounded bg-white" />
                    )}
                    <span className="flex items-center gap-1 text-success text-xs"><CheckCircle2 className="h-4 w-4" />확인됨</span>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => { setSignFor(p); setSignImg(null); }}>서명하기</Button>
                )}
              </div>
            );
          })}
          {parts.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">참여자가 없습니다.</div>}
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
          <Button variant="outline" className="gap-2" onClick={() => setQrOpen(true)}><QrCode className="h-4 w-4" />QR 출력</Button>
          <Button variant="outline" className="gap-2" onClick={() => toast.info("카카오 알림톡 발송 기능 준비 중")}><MessageSquare className="h-4 w-4" />알림톡 발송</Button>
          <Button variant="outline" className="gap-2" onClick={copyLink}><Link2 className="h-4 w-4" />링크 복사</Button>
        </div>
        <p className="text-[11px] text-muted-foreground">참여자는 QR/링크로 접속해 본인 서명만 입력하면 됩니다.</p>
      </CardContent></Card>

      <div className="flex justify-between">
        <Link to="/history"><Button variant="outline">이력으로</Button></Link>
        <Button onClick={finish} disabled={a.status === "완료"}>{a.status === "완료" ? "완료됨" : "평가 완료"}</Button>
      </div>

      <Dialog open={!!signFor} onOpenChange={(o) => !o && setSignFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{signFor?.name}님 서명</DialogTitle>
          </DialogHeader>
          <SignaturePad onChange={setSignImg} />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setSignFor(null)}>취소</Button>
            <Button onClick={saveSignature} disabled={!signImg}>서명 저장</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>참여자 확인 QR</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-3">
            {qrUrl && <img ref={qrRef} src={qrUrl} alt="QR" className="w-64 h-64" />}
            <p className="text-xs text-muted-foreground break-all text-center">{confirmUrl}</p>
            <Button onClick={printQR} className="gap-2"><Printer className="h-4 w-4" />출력</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
