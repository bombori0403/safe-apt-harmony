import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, ClipboardCheck, Users, FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { AuthIllustration } from "@/components/auth-illustration";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.href = "/dashboard";
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      window.location.href = "/dashboard";
    } catch (err) {
      const message =
        err instanceof Error && err.message === "Invalid login credentials"
          ? "이메일 또는 비밀번호가 맞지 않습니다. 데스크탑 저장 비밀번호를 지우고 직접 입력하거나, 아래에서 비밀번호를 재설정해 주세요."
          : err instanceof Error
            ? err.message
            : "오류가 발생했습니다";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function sendPasswordReset() {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      toast.error("비밀번호를 재설정할 이메일을 먼저 입력해 주세요.");
      return;
    }
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("비밀번호 재설정 메일을 보냈습니다. 메일함을 확인해 주세요.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "재설정 메일 발송에 실패했습니다");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-[42%] relative flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-primary to-[oklch(0.3_0.14_262)] text-primary-foreground px-12 py-12">
        <Link to="/" className="flex items-center gap-2.5 relative z-10 w-fit">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/15">
            <Shield className="h-5 w-5" />
          </div>
          <span className="font-bold tracking-tight">위험성평가-리스크데스크</span>
        </Link>

        <div className="absolute inset-0 flex items-center justify-center opacity-90 pointer-events-none">
          <div className="w-[85%] max-w-md">
            <AuthIllustration />
          </div>
        </div>

        <div className="relative space-y-6">
          <h2 className="text-3xl font-bold leading-snug tracking-tight">
            공동주택 위험성평가,
            <br />
            체계적으로 관리하세요
          </h2>
          <p className="text-sm text-primary-foreground/80 max-w-sm leading-relaxed">
            산업안전보건법과 공동주택관리법 기준에 맞춰 평가·승인·기록을 한 곳에서 처리하는 통합 플랫폼입니다.
          </p>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-2.5 text-primary-foreground/90">
              <ClipboardCheck className="h-4 w-4 shrink-0" /> 법정 위험성평가 절차 자동 지원
            </li>
            <li className="flex items-center gap-2.5 text-primary-foreground/90">
              <Users className="h-4 w-4 shrink-0" /> 관리자·직원 협업 및 승인 워크플로우
            </li>
            <li className="flex items-center gap-2.5 text-primary-foreground/90">
              <FileCheck2 className="h-4 w-4 shrink-0" /> 감사 대응용 이력·리포트 자동 생성
            </li>
          </ul>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden text-center">
            <Link to="/" className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground mb-3 shadow-lg shadow-primary/20">
              <Shield className="h-7 w-7" />
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">위험성평가-리스크데스크</h1>
            <p className="text-sm text-muted-foreground mt-1">공동주택 위험성평가 통합 관리 플랫폼</p>
          </div>

          <div className="mb-7 hidden lg:block">
            <h1 className="text-2xl font-bold tracking-tight">로그인</h1>
            <p className="text-sm text-muted-foreground mt-1.5">계정 정보를 입력해 계속하세요</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw">비밀번호</Label>
              <Input
                id="pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="current-password"
                className="h-11"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 text-base mt-1">
              {loading ? "처리 중..." : "로그인"}
            </Button>
          </form>

          <Button
            type="button"
            variant="link"
            disabled={resetLoading}
            onClick={sendPasswordReset}
            className="mt-1 w-full"
          >
            {resetLoading ? "메일 발송 중..." : "비밀번호 재설정 메일 받기"}
          </Button>

          <div className="mt-6 pt-5 border-t space-y-2 text-center">
            <p className="text-xs text-muted-foreground">우리 회사를 처음 등록하시나요?</p>
            <Link to="/signup" className="block text-sm font-medium text-primary hover:underline">
              회사 대표 회원가입 →
            </Link>
            <p className="text-[11px] text-muted-foreground">
              직원이라면 관리자에게 받은 초대 링크로 가입하세요.
            </p>
          </div>

          <p className="text-[11px] text-center text-muted-foreground mt-8 leading-relaxed">
            본 서비스는 산업안전보건법 제36조, 고용노동부 고시 제2024-76호,
            <br />
            공동주택관리법 제32조에 근거한 위험성평가 절차를 지원합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
