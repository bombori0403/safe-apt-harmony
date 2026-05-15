import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listTeam, createInvitation, revokeInvitation, updateMemberRole, removeMember, createInviteLink } from "@/lib/team.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Trash2, UserPlus, QrCode } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";

export const Route = createFileRoute("/_app/team")({ component: TeamPage });

function TeamPage() {
  const navigate = useNavigate();
  const fetchTeam = useServerFn(listTeam);
  const invite = useServerFn(createInvitation);
  const revoke = useServerFn(revokeInvitation);
  const updateRole = useServerFn(updateMemberRole);
  const removeFn = useServerFn(removeMember);
  const makeLink = useServerFn(createInviteLink);

  const [data, setData] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "manager" | "member">("member");
  const [loading, setLoading] = useState(false);
  const [qrLink, setQrLink] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetchTeam();
      setData(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "권한이 없습니다.");
      navigate({ to: "/dashboard" });
    }
  }
  useEffect(() => { load(); }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await invite({ data: { email, role } });
      const link = `${window.location.origin}/invite/${res.token}`;
      await navigator.clipboard.writeText(link).catch(() => {});
      setQrLink(link);
      toast.success("초대 링크가 복사되었습니다. QR로도 공유 가능합니다.");
      setEmail("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "초대 발송 실패");
    } finally {
      setLoading(false);
    }
  }

  if (!data) return <div className="p-8 text-muted-foreground">불러오는 중...</div>;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold">직원 관리</h1>
        <p className="text-sm text-muted-foreground mt-1">
          멤버 {data.members.length}명 · 대기 초대 {data.invitations.filter((i: any) => i.status === "pending").length}건
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-4 w-4" />새 직원 초대</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label>이메일</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label>권한</Label>
              <select value={role} onChange={(e) => setRole(e.target.value as any)} className="w-full h-10 px-3 rounded-md border bg-background text-sm">
                <option value="member">일반</option>
                <option value="manager">매니저</option>
                <option value="admin">관리자</option>
              </select>
            </div>
            <Button type="submit" disabled={loading}>{loading ? "처리..." : "초대 링크 생성"}</Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2">생성된 링크가 자동 복사되고 QR 코드가 표시됩니다. 직원이 핸드폰으로 스캔하면 바로 가입 페이지로 이동합니다.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">직원 목록</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {data.members.map((m: any) => (
              <div key={m.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-muted-foreground">{m.email} · {m.role ?? "직책 미지정"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={m.org_role}
                    onChange={async (e) => {
                      try { await updateRole({ data: { userId: m.id, role: e.target.value as any } }); toast.success("권한 변경됨"); load(); }
                      catch (err) { toast.error(err instanceof Error ? err.message : "실패"); }
                    }}
                    className="h-9 px-2 rounded border bg-background text-sm"
                  >
                    <option value="member">일반</option>
                    <option value="manager">매니저</option>
                    <option value="admin">관리자</option>
                  </select>
                  <Button variant="outline" size="sm" onClick={async () => {
                    if (!confirm(`${m.name} 직원을 삭제할까요?`)) return;
                    try { await removeFn({ data: { userId: m.id } }); toast.success("삭제됨"); load(); }
                    catch (err) { toast.error(err instanceof Error ? err.message : "실패"); }
                  }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">초대 내역</CardTitle></CardHeader>
        <CardContent className="p-0">
          {data.invitations.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">초대 내역이 없습니다.</div>
          ) : (
            <div className="divide-y">
              {data.invitations.map((i: any) => (
                <div key={i.id} className="p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div>
                    <div className="font-medium">{i.email}</div>
                    <div className="text-xs text-muted-foreground">권한: {i.role} · 만료: {new Date(i.expires_at).toLocaleDateString("ko-KR")}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={i.status === "pending" ? "default" : "secondary"}>{i.status}</Badge>
                    {i.status === "pending" && (
                      <>
                        <Button variant="outline" size="sm" onClick={async () => {
                          await navigator.clipboard.writeText(`${window.location.origin}/invite/${i.token}`);
                          toast.success("링크 복사됨");
                        }}><Copy className="h-3.5 w-3.5" /></Button>
                        <Button variant="outline" size="sm" onClick={() => {
                          setQrLink(`${window.location.origin}/invite/${i.token}`);
                        }}><QrCode className="h-3.5 w-3.5" /></Button>
                        <Button variant="outline" size="sm" onClick={async () => {
                          await revoke({ data: { id: i.id } }); toast.success("취소됨"); load();
                        }}>취소</Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!qrLink} onOpenChange={(o) => !o && setQrLink(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>초대 QR 코드</DialogTitle>
            <DialogDescription>직원이 핸드폰 카메라로 스캔하면 가입 페이지로 이동합니다.</DialogDescription>
          </DialogHeader>
          {qrLink && (
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 bg-white rounded-lg border">
                <QRCodeSVG value={qrLink} size={220} level="M" />
              </div>
              <div className="w-full">
                <div className="text-[11px] text-muted-foreground break-all bg-muted p-2 rounded">{qrLink}</div>
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={async () => {
                await navigator.clipboard.writeText(qrLink);
                toast.success("링크 복사됨");
              }}><Copy className="h-3.5 w-3.5 mr-1" />링크 복사</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
