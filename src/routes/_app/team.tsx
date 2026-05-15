import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listTeam, createInvitation, revokeInvitation, updateMemberRole, removeMember, createInviteLink, assignMemberComplex } from "@/lib/team.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Trash2, UserPlus, QrCode } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { buildInviteLink } from "@/lib/app-url";

export const Route = createFileRoute("/_app/team")({ component: TeamPage });

function TeamPage() {
  const navigate = useNavigate();
  const fetchTeam = useServerFn(listTeam);
  const invite = useServerFn(createInvitation);
  const revoke = useServerFn(revokeInvitation);
  const updateRole = useServerFn(updateMemberRole);
  const removeFn = useServerFn(removeMember);
  const makeLink = useServerFn(createInviteLink);
  const assignComplex = useServerFn(assignMemberComplex);

  const [data, setData] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "manager" | "member">("member");
  const [complexId, setComplexId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [qrLink, setQrLink] = useState<string | null>(null);

  // For admin manager-QR
  const [mgrComplexId, setMgrComplexId] = useState<string>("");

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

  const isAdmin = data?.me?.role === "admin";
  const isManager = data?.me?.role === "manager";

  const complexById = useMemo(() => {
    const m = new Map<string, string>();
    (data?.complexes ?? []).forEach((c: any) => m.set(c.id, c.name));
    return m;
  }, [data]);

  const userComplexMap = useMemo(() => {
    const m = new Map<string, { id: string; name: string }>();
    (data?.memberComplexes ?? []).forEach((r: any) => {
      if (r.complexes) m.set(r.user_id, { id: r.complexes.id, name: r.complexes.name });
    });
    return m;
  }, [data]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: any = { email, role };
      if (isManager) payload.role = "member";
      if (role === "manager" && complexId) payload.complexId = complexId;
      const res = await invite({ data: payload });
      const link = buildInviteLink(res.token);
      await navigator.clipboard.writeText(link).catch(() => {});
      setQrLink(link);
      toast.success("초대 링크가 복사되었습니다.");
      setEmail("");
      setComplexId("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "초대 실패");
    } finally {
      setLoading(false);
    }
  }

  async function makeQr(targetRole: "admin" | "manager" | "member", cxId?: string) {
    try {
      const payload: any = { role: targetRole, expiresInDays: 30, label: targetRole === "admin" ? "관리자" : targetRole === "manager" ? "매니저" : "일반" };
      if (targetRole === "manager") {
        if (!cxId) { toast.error("단지를 먼저 선택하세요."); return; }
        payload.complexId = cxId;
        payload.label = `${complexById.get(cxId) ?? "단지"} 매니저`;
      }
      const res = await makeLink({ data: payload });
      const link = buildInviteLink(res.token);
      await navigator.clipboard.writeText(link).catch(() => {});
      setQrLink(link);
      toast.success("링크 생성됨 (복사됨)");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "실패");
    }
  }

  if (!data) return <div className="p-8 text-muted-foreground">불러오는 중...</div>;

  const myComplexName = isManager && data.me.complexId ? complexById.get(data.me.complexId) : null;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold">직원 관리</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAdmin && <>관리자 · 멤버 {data.members.length}명 · 대기 초대 {data.invitations.filter((i: any) => i.status === "pending").length}건</>}
          {isManager && <>매니저 ({myComplexName ?? "단지 미배정"}) · 본인 단지 일반 직원만 초대 가능</>}
        </p>
      </div>

      {isManager && !data.me.complexId && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">
            소속 단지가 배정되지 않았습니다. 관리자에게 단지 배정을 요청하세요.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-4 w-4" />이메일로 직원 초대</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label>이메일</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {isAdmin && (
              <>
                <div>
                  <Label>권한</Label>
                  <select value={role} onChange={(e) => setRole(e.target.value as any)} className="w-full h-10 px-3 rounded-md border bg-background text-sm">
                    <option value="member">일반</option>
                    <option value="manager">매니저</option>
                    <option value="admin">관리자</option>
                  </select>
                </div>
                {role === "manager" && (
                  <div>
                    <Label>단지</Label>
                    <select value={complexId} onChange={(e) => setComplexId(e.target.value)} required className="w-full h-10 px-3 rounded-md border bg-background text-sm">
                      <option value="">단지 선택...</option>
                      {data.complexes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
              </>
            )}
            {isManager && <Badge variant="secondary" className="h-10 px-3 flex items-center">일반 (본인 단지)</Badge>}
            <Button type="submit" disabled={loading || (isManager && !data.me.complexId)}>{loading ? "처리..." : "초대 링크 생성"}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><QrCode className="h-4 w-4" />권한별 QR 초대 링크 (다회용 · 30일)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isAdmin && (
            <>
              <div>
                <p className="text-xs text-muted-foreground mb-2">관리자 / 일반 QR (단지 무관)</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => makeQr("admin")}><QrCode className="h-3.5 w-3.5 mr-1" />관리자 QR</Button>
                  <Button variant="outline" size="sm" onClick={() => makeQr("member")}><QrCode className="h-3.5 w-3.5 mr-1" />일반 QR</Button>
                </div>
              </div>
              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground mb-2">매니저 QR (단지별 — 가입 시 해당 단지 매니저로 자동 배정. 기존 매니저는 일반으로 강등됨)</p>
                <div className="flex flex-wrap gap-2 items-end">
                  <select value={mgrComplexId} onChange={(e) => setMgrComplexId(e.target.value)} className="h-9 px-3 rounded-md border bg-background text-sm">
                    <option value="">단지 선택...</option>
                    {data.complexes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <Button variant="outline" size="sm" onClick={() => makeQr("manager", mgrComplexId)} disabled={!mgrComplexId}>
                    <QrCode className="h-3.5 w-3.5 mr-1" />매니저 QR 만들기
                  </Button>
                </div>
              </div>
            </>
          )}
          {isManager && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">
                일반 직원 QR — 가입한 사람은 자동으로 <b>{myComplexName ?? "본인 단지"}</b>에 소속됩니다.
              </p>
              <Button variant="outline" size="sm" onClick={() => makeQr("member")} disabled={!data.me.complexId}>
                <QrCode className="h-3.5 w-3.5 mr-1" />일반 직원 QR 만들기
              </Button>
            </div>
          )}

          {data.invitations.filter((i: any) => i.is_link && i.status !== "revoked").length > 0 && (
            <div className="mt-4 divide-y border rounded-md">
              {data.invitations.filter((i: any) => i.is_link && i.status !== "revoked").map((i: any) => (
                <div key={i.id} className="p-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div>
                    <div className="font-medium">{i.label ?? i.role} <Badge variant="secondary" className="ml-1">{i.role}</Badge>{i.complex_id && <span className="ml-1 text-xs text-muted-foreground">{complexById.get(i.complex_id)}</span>}</div>
                    <div className="text-xs text-muted-foreground">
                      사용 {i.used_count}{i.max_uses ? ` / ${i.max_uses}` : ""}회 · 만료 {new Date(i.expires_at).toLocaleDateString("ko-KR")}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => setQrLink(buildInviteLink(i.token))}><QrCode className="h-3.5 w-3.5" /></Button>
                    <Button variant="outline" size="sm" onClick={async () => {
                      await navigator.clipboard.writeText(buildInviteLink(i.token));
                      toast.success("링크 복사됨");
                    }}><Copy className="h-3.5 w-3.5" /></Button>
                    {(isAdmin || i.invited_by === data.me.id) && (
                      <Button variant="outline" size="sm" onClick={async () => {
                        if (!confirm("이 링크를 비활성화할까요?")) return;
                        await revoke({ data: { id: i.id } }); toast.success("비활성화됨"); load();
                      }}>비활성화</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader><CardTitle className="text-base">직원 목록</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {data.members.map((m: any) => {
                const cx = userComplexMap.get(m.id);
                return (
                  <div key={m.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{m.name} <Badge variant="outline" className="ml-1 text-xs">{m.org_role}</Badge></div>
                      <div className="text-xs text-muted-foreground">{m.email} · 단지: {cx?.name ?? "미지정"}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={cx?.id ?? ""}
                        onChange={async (e) => {
                          try { await assignComplex({ data: { userId: m.id, complexId: e.target.value || null } }); toast.success("단지 변경됨"); load(); }
                          catch (err) { toast.error(err instanceof Error ? err.message : "실패"); }
                        }}
                        className="h-9 px-2 rounded border bg-background text-sm"
                      >
                        <option value="">단지 미지정</option>
                        {data.complexes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
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
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {isManager && (
        <Card>
          <CardHeader><CardTitle className="text-base">우리 단지 직원</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {data.members.filter((m: any) => userComplexMap.get(m.id)?.id === data.me.complexId).map((m: any) => (
                <div key={m.id} className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{m.name} <Badge variant="outline" className="ml-1 text-xs">{m.org_role}</Badge></div>
                    <div className="text-xs text-muted-foreground">{m.email}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">초대 내역</CardTitle></CardHeader>
        <CardContent className="p-0">
          {data.invitations.filter((i: any) => !i.is_link).length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">이메일 초대 내역이 없습니다.</div>
          ) : (
            <div className="divide-y">
              {data.invitations.filter((i: any) => !i.is_link).map((i: any) => (
                <div key={i.id} className="p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div>
                    <div className="font-medium">{i.email}</div>
                    <div className="text-xs text-muted-foreground">권한: {i.role}{i.complex_id ? ` · ${complexById.get(i.complex_id)}` : ""} · 만료: {new Date(i.expires_at).toLocaleDateString("ko-KR")}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={i.status === "pending" ? "default" : "secondary"}>{i.status}</Badge>
                    {i.status === "pending" && (
                      <>
                        <Button variant="outline" size="sm" onClick={async () => {
                          await navigator.clipboard.writeText(buildInviteLink(i.token));
                          toast.success("링크 복사됨");
                        }}><Copy className="h-3.5 w-3.5" /></Button>
                        <Button variant="outline" size="sm" onClick={() => setQrLink(buildInviteLink(i.token))}><QrCode className="h-3.5 w-3.5" /></Button>
                        {(isAdmin || i.invited_by === data.me.id) && (
                          <Button variant="outline" size="sm" onClick={async () => {
                            await revoke({ data: { id: i.id } }); toast.success("취소됨"); load();
                          }}>취소</Button>
                        )}
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
