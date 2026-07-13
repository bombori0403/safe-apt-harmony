import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AuthIllustration } from "@/components/auth-illustration";
import {
  Shield, ClipboardCheck, FileCheck2, Users, ScrollText, BadgeCheck, ArrowRight, Check,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.href = "/dashboard";
    });
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary text-primary-foreground">
              <Shield className="h-5 w-5" />
            </div>
            <span className="font-bold tracking-tight">안전데스크</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login"><Button variant="ghost" size="sm">로그인</Button></Link>
            <Link to="/signup"><Button size="sm" className="gap-1">무료로 시작 <ArrowRight className="h-4 w-4" /></Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-24 grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border bg-accent/40 px-3 py-1 text-xs font-medium text-accent-foreground">
              <BadgeCheck className="h-3.5 w-3.5" /> 산업안전보건법 · 중대재해처벌법 대응
            </div>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight">
              공동주택 위험성평가,<br />
              <span className="text-primary">클릭 몇 번</span>으로 끝내세요
            </h1>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-lg">
              관리사무소·관리업체를 위한 위험성평가 통합 플랫폼. 유해·위험요인 파악부터 감소대책,
              KRAS 양식 출력, 5년 이력 보존까지 법적 기준에 맞춰 한 곳에서 처리합니다.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link to="/signup"><Button size="lg" className="gap-2 h-12 px-6 text-base">14일 무료로 시작하기 <ArrowRight className="h-4 w-4" /></Button></Link>
              <Link to="/login"><Button size="lg" variant="outline" className="h-12 px-6 text-base">로그인</Button></Link>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
              <Check className="h-3.5 w-3.5 text-primary" /> 신용카드 불필요 · 좌석 제한 없음
            </p>
          </div>

          <div className="hidden lg:block">
            <div className="relative rounded-3xl bg-gradient-to-br from-primary via-primary to-[oklch(0.3_0.14_262)] p-10 shadow-2xl shadow-primary/20">
              <div className="w-full">
                <AuthIllustration />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pain / why now */}
      <section className="border-y bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 py-12 text-center space-y-3">
          <h2 className="text-xl md:text-2xl font-bold">위험성평가, 더 이상 서류 부담으로 미루지 마세요</h2>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            산업안전보건법 제36조에 따라 모든 사업장은 위험성평가를 실시·기록·보존해야 합니다.
            중대재해처벌법 시행으로 관리 부실 시 책임이 커진 만큼, 체계적인 관리가 필수입니다.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-16 md:py-20">
        <div className="text-center mb-12 space-y-2">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">필요한 기능을 한 곳에</h2>
          <p className="text-muted-foreground">현장에서 바로 쓸 수 있도록 설계했습니다.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          <Feature icon={ClipboardCheck} title="법정 절차 자동 지원"
            desc="빈도강도법·3단계·5단계·체크리스트·OPS 등 평가방법을 선택하면 절차에 맞춰 안내합니다." />
          <Feature icon={ScrollText} title="관련 법조문 자동 매칭"
            desc="유해·위험요인을 입력하면 산업안전보건기준에 관한 규칙 등 관련 법적기준이 자동으로 붙습니다." />
          <Feature icon={FileCheck2} title="KRAS 양식 그대로 출력"
            desc="안전보건공단 KRAS 위험성평가표와 동일한 양식으로 개별·전체 이력을 인쇄·PDF 저장할 수 있습니다." />
          <Feature icon={Users} title="직원 협업 · 승인"
            desc="관리자·매니저·직원 권한과 초대 링크, 협의·서명 확인까지 팀 단위로 관리합니다." />
          <Feature icon={BadgeCheck} title="아차사고 · 작업중지권"
            desc="위험성평가 외에도 아차사고 기록, 작업중지권 행사 대장 등 안전관리 업무를 함께 지원합니다." />
          <Feature icon={Shield} title="5년 이력 보존"
            desc="시행규칙 제37조에 따른 5년 보존 요건에 맞춰 평가 이력을 안전하게 저장합니다." />
        </div>
      </section>

      {/* Legal trust band */}
      <section className="border-y bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground leading-relaxed">
            본 서비스는 <strong className="text-foreground">산업안전보건법 제36조</strong>,
            <strong className="text-foreground"> 고용노동부 고시 제2024-76호</strong>,
            <strong className="text-foreground"> 공동주택관리법 제32조</strong>에 근거한 위험성평가 절차를 지원합니다.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        <div className="rounded-3xl bg-gradient-to-br from-primary via-primary to-[oklch(0.3_0.14_262)] text-primary-foreground px-6 py-14 md:py-16 text-center space-y-5">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">오늘 바로 시작해 보세요</h2>
          <p className="text-primary-foreground/80 max-w-lg mx-auto">
            회사를 등록하면 관리자 권한으로 바로 사용할 수 있어요. 14일 무료 체험, 결제 정보 없이 시작.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link to="/signup"><Button size="lg" variant="secondary" className="h-12 px-6 text-base gap-2">회사 등록하고 시작하기 <ArrowRight className="h-4 w-4" /></Button></Link>
            <Link to="/login"><Button size="lg" variant="outline" className="h-12 px-6 text-base bg-transparent border-white/40 text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">로그인</Button></Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">안전데스크</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hover:text-foreground">로그인</Link>
            <Link to="/signup" className="hover:text-foreground">회사 가입</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border bg-card p-6 space-y-3 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}
