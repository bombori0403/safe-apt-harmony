import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { submitParticipantConfirmation, getConfirmInfo } from "@/lib/confirm.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignaturePad } from "@/components/signature-pad";
import { METHOD_GLOSS } from "@/lib/glossary";
import { Shield, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

/**
 * 참여자 확인 서명 — 로그인 없이 QR/링크로 여는 화면 (직원용).
 * 서명 전에 "무엇에 서명하는지"(건수·문서 버전·전체 내용 링크·목적)를 보여준다.
 */
export const Route = createFileRoute("/confirm/$id")({
  component: Confirm,
});

function Confirm() {
  const { id } = Route.useParams();
  const [a, setA] = useState<any>(null);
  const [counts, setCounts] = useState<any>(null);
  const [docVersion, setDocVersion] = useState<string | null>(null);
  const [parts, setParts] = useState<any[]>([]);
  const [pid, setPid] = useState<string>("");
  const [name, setName] = useState("");
  const [sig, setSig] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await getConfirmInfo({ data: { assessmentId: id } });
        setA(res.assessment);
        setParts(res.participants);
        setCounts(res.counts);
        setDocVersion(res.docVersion ?? null);
      } catch (e: any) {
        setError(e?.message ?? "평가 정보를 불러오지 못했습니다.");
      }
    })();
  }, [id]);

  async function submit() {
    if (!sig) { toast.error("서명을 해 주세요"); return; }
    if (!pid && !name.trim()) { toast.error("명단에서 본인을 고르거나 이름을 적어 주세요"); return; }
    if (saving) return;
    setSaving(true);
    try {
      await submitParticipantConfirmation({
        data: {
          assessmentId: id,
          participantId: pid || null,
          name: pid ? null : name.trim(),
          signatureImage: sig,
          userAgent: navigator.userAgent,
          docVersion,
        },
      });
      setDone(true);
    } catch (e: any) {
      toast.error(e.message ?? "오류");
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background to-accent/30">
        <Card className="max-w-md w-full"><CardContent className="p-8 text-center space-y-3">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="text-xl font-bold">열 수 없습니다</h1>
          <p className="text-base text-muted-foreground">{error}</p>
        </CardContent></Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background to-accent/30">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-3">
            <CheckCircle2 className="h-16 w-16 text-success mx-auto" />
            <h1 className="text-2xl font-bold">확인이 완료되었습니다</h1>
            <p className="text-base text-muted-foreground">참여 기록이 저장되었습니다. 이 창은 닫으셔도 됩니다.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const method = a ? METHOD_GLOSS[a.method as keyof typeof METHOD_GLOSS] : null;
  const selected = parts.find((p) => p.id === pid);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-accent/30 p-4 py-8">
      <div className="max-w-md mx-auto space-y-4">
        <div className="text-center">
          <Shield className="h-10 w-10 text-primary mx-auto" />
          <h1 className="text-2xl font-bold mt-2">위험성평가 참여 확인</h1>
          <p className="text-base text-muted-foreground mt-1">내용을 확인한 뒤 본인 이름을 고르고 서명해 주세요.</p>
        </div>

        {/* 무엇을 확인하는지 */}
        {a && counts && (
          <Card><CardContent className="p-4 text-base space-y-2">
            <div className="font-semibold text-lg">{a.work_name}</div>
            <div className="text-muted-foreground">{a.complex_name} · 평가일 {a.assessment_date}{method ? ` · ${method.title}` : ""}</div>
            <ul className="text-base space-y-1 pt-1">
              <li>위험요인 <b>{counts.hazards}건</b>{counts.unrated ? ` (미평가 ${counts.unrated}건)` : ""}, 감소대책 <b>{counts.measures}건</b>{counts.measuresNotDone ? ` (실행 전·중 ${counts.measuresNotDone}건)` : ""}</li>
              <li>참여자 {counts.participants}명 중 {counts.confirmed}명 확인</li>
              <li className="text-sm text-muted-foreground">문서 버전(마지막 수정): {docVersion ? new Date(docVersion).toLocaleString("ko-KR") : "-"}</li>
            </ul>
            <p className="text-sm text-muted-foreground">위험요인·대책 전체 내용은 관리사무소가 게시한 "결과 공지"나 담당자 화면에서 볼 수 있습니다. 서명 후 내용이 바뀌면 다시 확인을 요청받습니다.</p>
            <p className="text-sm text-muted-foreground pt-1">
              서명의 뜻: 이 평가의 위험요인 파악과 결정, 감소대책에 근로자로서 참여했고 위 내용을 확인했다는 기록입니다.
            </p>
          </CardContent></Card>
        )}

        <Card><CardContent className="p-4 space-y-4">
          {parts.length > 0 && (
            <div>
              <Label htmlFor="who">본인 이름을 고르세요</Label>
              <select id="who" value={pid} onChange={e=>setPid(e.target.value)}
                className="w-full h-11 px-3 rounded-md border bg-background text-base mt-1">
                <option value="">— 선택 —</option>
                {parts.map(p => <option key={p.id} value={p.id} disabled={!!p.confirmed}>{p.name}{p.role ? ` (${p.role})` : ""}{p.confirmed ? " — 확인됨" : ""}</option>)}
              </select>
              <p className="text-sm text-muted-foreground mt-1">명단에 없으면 비워 두고 아래에 이름을 적으세요.</p>
            </div>
          )}
          {!pid && (
            <div>
              <Label htmlFor="nm">{parts.length > 0 ? "이름 (명단에 없을 때)" : "이름"}</Label>
              <Input id="nm" value={name} onChange={e=>setName(e.target.value)} placeholder="홍길동" autoComplete="name" />
            </div>
          )}
          {selected?.confirmed && <p className="text-base text-warning">이미 확인한 분입니다. 다시 서명할 필요가 없습니다.</p>}
          <div>
            <Label>서명</Label>
            <p className="text-sm text-muted-foreground mb-1">손가락이나 마우스로 아래 칸에 서명하세요.</p>
            <SignaturePad onChange={setSig} />
          </div>
          <Button type="button" size="lg" onClick={submit} disabled={saving || !sig || !!selected?.confirmed} className="w-full">
            {saving ? "저장 중..." : "확인 및 제출"}
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            본 기록은 산업안전보건법 제36조 제2항에 따른 근로자 참여 증빙으로 보존됩니다.
          </p>
        </CardContent></Card>
      </div>
    </div>
  );
}
