import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/invite/$token")({ component: Invite });

// 초대 정보의 권한값(영문 enum)을 화면용 한글로. 모르는 값은 그대로 보여준다.
const ROLE_LABEL: Record<string, string> = { admin: "관리자", manager: "매니저", member: "직원" };

function Invite() {
  const { token } = Route.useParams();
  const [info, setInfo] = useState<{ valid: boolean; email?: string | null; org?: string; role?: string; reason?: string; isLink?: boolean } | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("validate_invitation", { _token: token });
      if (error || !data || data.length === 0) {
        setInfo({ valid: false, reason: "초대 정보를 불러올 수 없습니다." });
        return;
      }
      const r: any = data[0];
      setInfo({ valid: r.valid, email: r.email, org: r.organization_name, role: r.role, reason: r.reason, isLink: r.is_link });
    })();
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!info?.valid) return;
    const useEmail = info.isLink ? email.trim() : info.email;
    if (!useEmail) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: useEmail,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { signup_type: "invite", invitation_token: token, name },
        },
      });
      if (error) throw error;
      toast.success("가입 완료!");
      window.location.href = "/dashboard";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "가입에 실패했습니다");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-br from-background to-accent/30">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground mb-3 shadow-lg shadow-primary/20">
            <UserPlus className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">초대 수락</h1>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-xl">직원 가입</CardTitle></CardHeader>
          <CardContent>
            {!info && <div className="text-sm text-muted-foreground">초대 확인 중...</div>}
            {info && !info.valid && (
              <div className="space-y-3">
                <div className="text-sm text-destructive">{info.reason ?? "유효하지 않은 초대입니다."}</div>
                <Link to="/login" className="block text-sm text-primary hover:underline">로그인으로 이동</Link>
              </div>
            )}
            {info?.valid && (
              <form onSubmit={submit} className="space-y-3">
                <div className="rounded-md bg-muted/50 p-3 text-base space-y-1">
                  <div><span className="text-muted-foreground">소속:</span> <span className="font-medium">{info.org}</span></div>
                  <div><span className="text-muted-foreground">역할:</span> <span className="font-medium">{ROLE_LABEL[info.role ?? ""] ?? info.role}</span></div>
                  {info.email && !info.isLink && (
                    <div><span className="text-muted-foreground">이메일:</span> <span className="font-medium">{info.email}</span></div>
                  )}
                </div>
                <div>
                  <Label htmlFor="invite-name">이름 <span className="text-muted-foreground font-normal">(평가 참여 확인에 쓰이니 실명으로)</span></Label>
                  <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoComplete="name" />
                </div>
                {info.isLink && (
                  <div>
                    <Label>이메일</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                )}
                <div>
                  <Label htmlFor="invite-pw">비밀번호 <span className="text-muted-foreground font-normal">(6자 이상)</span></Label>
                  <div className="relative">
                    <Input id="invite-pw" type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                      required minLength={6} autoComplete="new-password" className="pr-12" />
                    {/* 고령 사용자는 가린 비밀번호를 틀리게 치는 일이 잦다 — 보기 토글 제공 */}
                    <button type="button" onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? "비밀번호 숨기기" : "비밀번호 보기"} aria-pressed={showPw}
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground">
                      {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full h-11">
                  {loading ? "처리 중..." : "가입하기"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
