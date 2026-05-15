import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/invite/$token")({ component: Invite });

function Invite() {
  const { token } = Route.useParams();
  const [info, setInfo] = useState<{ valid: boolean; email?: string; org?: string; role?: string; reason?: string } | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("validate_invitation", { _token: token });
      if (error || !data || data.length === 0) {
        setInfo({ valid: false, reason: "초대 정보를 불러올 수 없습니다." });
        return;
      }
      const r = data[0];
      setInfo({ valid: r.valid, email: r.email, org: r.organization_name, role: r.role, reason: r.reason });
    })();
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!info?.valid || !info.email) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: info.email,
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
                <Link to="/" className="block text-sm text-primary hover:underline">로그인으로 이동</Link>
              </div>
            )}
            {info?.valid && (
              <form onSubmit={submit} className="space-y-3">
                <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
                  <div><span className="text-muted-foreground">조직:</span> <span className="font-medium">{info.org}</span></div>
                  <div><span className="text-muted-foreground">권한:</span> <span className="font-medium">{info.role}</span></div>
                  <div><span className="text-muted-foreground">이메일:</span> <span className="font-medium">{info.email}</span></div>
                </div>
                <div>
                  <Label>이름</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
                </div>
                <div>
                  <Label>비밀번호</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
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
