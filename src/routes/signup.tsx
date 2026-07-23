import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { notifyPendingSignup } from "@/lib/notify.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, ShieldCheck, Clock, Users } from "lucide-react";
import { toast } from "sonner";
import { AuthIllustration } from "@/components/auth-illustration";

export const Route = createFileRoute("/signup")({ component: Signup });

function Signup() {
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const repName = email.split("@")[0] || orgName;
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { signup_type: "org_admin", org_name: orgName, name: repName },
        },
      });
      if (error) throw error;
      const isNewSignup = (data.user?.identities?.length ?? 0) > 0;
      if (!isNewSignup) {
        toast.error("이미 가입된 이메일입니다. 로그인해주세요.");
        window.location.href = "/login";
        return;
      }
      notifyPendingSignup({ data: { orgName, repName, email } }).catch(() => {});
      if (!data.session) {
        toast.success("가입 완료! 이메일의 인증 링크를 확인해주세요.");
        window.location.href = "/login";
        return;
      }
      toast.success("14일 무료 체험이 시작되었습니다!");
      window.location.href = "/dashboard";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-[42%] relative flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-primary to-[oklch(0.3_0.14_262)] text-primary-foreground px-12 py-12">
        <div className="flex items-center gap-2.5">
          <img src="/logo-mark.png" alt="안전데스크" className="w-9 h-9 rounded-xl object-cover bg-white" />
          <span className="font-bold tracking-tight">안전데스크</span>
        </div>

        <div className="absolute inset-0 flex items-center justify-center opacity-90 pointer-events-none">
          <div className="w-[85%] max-w-md">
            <AuthIllustration />
          </div>
        </div>

        <div className="relative space-y-6">
          <h2 className="text-3xl font-bold leading-snug tracking-tight">
            이메일만 있으면
            <br />
            지금 바로 시작
          </h2>
          <p className="text-sm text-primary-foreground/80 max-w-sm leading-relaxed">
            복잡한 절차 없이 14일 무료 체험을 시작하세요. 결제 정보도, 승인 대기도 없습니다.
            체험이 끝나면 그때 정식 등록하면 됩니다.
          </p>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-2.5 text-primary-foreground/90">
              <Clock className="h-4 w-4 shrink-0" /> 가입 즉시 14일 무료 체험 · 신용카드 불필요
            </li>
            <li className="flex items-center gap-2.5 text-primary-foreground/90">
              <Users className="h-4 w-4 shrink-0" /> 직원 초대 제한 없음
            </li>
            <li className="flex items-center gap-2.5 text-primary-foreground/90">
              <ShieldCheck className="h-4 w-4 shrink-0" /> 체험 후 정식 등록 시에만 승인 절차
            </li>
          </ul>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground mb-3 shadow-lg shadow-primary/20">
              <Building2 className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">14일 무료 체험 시작</h1>
            <p className="text-sm text-muted-foreground mt-1">이메일과 단지명만 입력하면 바로 시작합니다</p>
          </div>

          <div className="mb-7 hidden lg:block">
            <h1 className="text-2xl font-bold tracking-tight">14일 무료 체험 시작</h1>
            <p className="text-sm text-muted-foreground mt-1.5">이메일과 단지/회사명만 입력하면 바로 시작합니다</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>단지 / 회사명</Label>
              <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} required maxLength={200} placeholder="○○아파트 관리사무소" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>이메일</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>비밀번호</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="h-11" />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 text-base mt-1">
              {loading ? "시작 중..." : "무료로 시작하기"}
            </Button>
          </form>
          <Link to="/login" className="block text-center mt-4 text-sm text-primary hover:underline">로그인으로 돌아가기</Link>

          <p className="text-[11px] text-center text-muted-foreground mt-6">
            가입 시 즉시 14일 체험이 시작됩니다 · 결제 정보 불필요
          </p>
          <p className="text-[11px] text-center text-muted-foreground mt-2">
            가입을 진행하면{" "}
            <Link to="/privacy" className="underline hover:text-foreground">개인정보처리방침</Link>에
            동의하는 것으로 간주됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
