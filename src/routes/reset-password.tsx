import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPassword,
});

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setReady(Boolean(data.session));
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("비밀번호가 서로 다릅니다.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.");
      await supabase.auth.signOut({ scope: "local" });
      window.location.href = "/";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "비밀번호 변경에 실패했습니다");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-br from-background to-accent/30">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground mb-3 shadow-lg shadow-primary/20">
            <Shield className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">비밀번호 재설정</h1>
          <p className="text-sm text-muted-foreground mt-1">새 비밀번호를 입력해 주세요</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">새 비밀번호 설정</CardTitle>
          </CardHeader>
          <CardContent>
            {!ready ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  재설정 메일의 링크로 다시 접속해 주세요. 링크가 만료됐다면 로그인 화면에서 재설정
                  메일을 다시 요청할 수 있습니다.
                </p>
                <Button asChild className="w-full">
                  <Link to="/">로그인 화면으로</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <div>
                  <Label htmlFor="new-password">새 비밀번호</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <Label htmlFor="confirm-password">새 비밀번호 확인</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full h-11 text-base">
                  {loading ? "변경 중..." : "비밀번호 변경"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
