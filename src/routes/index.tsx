import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.href = "/dashboard";
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.href = "/dashboard";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "오류가 발생했습니다");
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
          <h1 className="text-2xl font-bold tracking-tight">위험성평가-리스크데스크</h1>
          <p className="text-sm text-muted-foreground mt-1">공동주택 위험성평가 통합 관리 플랫폼</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">로그인</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label htmlFor="email">이메일</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="pw">비밀번호</Label>
                <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-11 text-base">
                {loading ? "처리 중..." : "로그인"}
              </Button>
            </form>

            <div className="mt-5 pt-4 border-t space-y-2 text-center">
              <p className="text-xs text-muted-foreground">우리 회사를 처음 등록하시나요?</p>
              <Link to="/signup" className="block text-sm font-medium text-primary hover:underline">
                회사 대표 회원가입 →
              </Link>
              <p className="text-[11px] text-muted-foreground">
                직원이라면 관리자에게 받은 초대 링크로 가입하세요.
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-[11px] text-center text-muted-foreground mt-6 leading-relaxed">
          본 서비스는 산업안전보건법 제36조, 고용노동부 고시 제2024-76호,<br />
          공동주택관리법 제32조에 근거한 위험성평가 절차를 지원합니다.
        </p>
      </div>
    </div>
  );
}
