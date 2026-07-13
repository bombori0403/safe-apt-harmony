import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AuthIllustration } from "@/components/auth-illustration";
import {
  Shield, ClipboardCheck, FileCheck2, Users, ScrollText, BadgeCheck,
  ArrowRight, Check, Sparkles,
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
    <div className="min-h-screen bg-background text-foreground antialiased">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo-mark.png" alt="안전데스크" className="w-9 h-9 rounded-xl object-cover ring-1 ring-border/60" />
            <span className="font-bold tracking-tight text-[17px]">안전데스크</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login"><Button variant="ghost" size="sm">로그인</Button></Link>
            <Link to="/signup"><Button size="sm" className="gap-1 shadow-sm">무료로 시작 <ArrowRight className="h-4 w-4" /></Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* decorative background */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 -left-32 h-[30rem] w-[30rem] rounded-full bg-primary/25 blur-[120px]" />
          <div className="absolute -top-10 right-[-8rem] h-[28rem] w-[28rem] rounded-full bg-success/20 blur-[120px]" />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(to right, oklch(0.5 0.02 250 / 0.05) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.5 0.02 250 / 0.05) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black, transparent 75%)",
              maskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black, transparent 75%)",
            }}
          />
        </div>

        <div className="max-w-6xl mx-auto px-4 pt-16 pb-14 md:pt-24 md:pb-20 grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-8 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" /> 산업안전보건법 · 중대재해처벌법 대응
            </div>
            <h1 className="text-[2.1rem] leading-[1.15] md:text-[3.25rem] md:leading-[1.1] font-extrabold tracking-tight">
              공동주택 위험성평가,
              <br />
              <span className="bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">
                클릭 몇 번
              </span>
              으로 끝내세요
            </h1>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-lg">
              관리사무소·관리업체를 위한 위험성평가 통합 플랫폼. 유해·위험요인 파악부터 감소대책,
              KRAS 양식 출력, 5년 이력 보존까지 법적 기준에 맞춰 한 곳에서 처리합니다.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link to="/signup">
                <Button size="lg" className="gap-2 h-12 px-6 text-base shadow-lg shadow-primary/25">
                  14일 무료로 시작하기 <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="h-12 px-6 text-base">로그인</Button>
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> 신용카드 불필요</span>
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> 좌석 제한 없음</span>
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> 5분 만에 세팅</span>
            </div>
          </div>

          {/* Product preview */}
          <div className="relative hidden lg:block">
            <div className="absolute -inset-6 -z-10 bg-gradient-to-br from-primary/15 to-success/15 blur-2xl rounded-[2rem]" />
            <div className="relative rounded-[1.75rem] border border-border/70 bg-card/80 backdrop-blur-sm p-3 shadow-2xl shadow-primary/10 rotate-1">
              <div className="flex items-center gap-1.5 px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-primary via-primary to-[oklch(0.3_0.14_262)] p-8">
                <AuthIllustration />
              </div>
            </div>

            {/* floating card: risk reduction */}
            <div className="absolute -left-8 top-16 rounded-xl border border-border/70 bg-card/95 backdrop-blur px-4 py-3 shadow-xl shadow-primary/10 -rotate-6">
              <div className="text-[10px] font-medium text-muted-foreground mb-1.5">위험성 감소</div>
              <div className="flex items-center gap-1.5">
                <span className="rounded-md bg-destructive/10 text-destructive text-xs font-bold px-2 py-0.5">높음</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="rounded-md bg-success/10 text-success text-xs font-bold px-2 py-0.5">낮음</span>
              </div>
            </div>

            {/* floating card: KRAS */}
            <div className="absolute -right-6 bottom-12 rounded-xl border border-border/70 bg-card/95 backdrop-blur px-4 py-3 shadow-xl shadow-success/10 rotate-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-success/10 text-success">
                  <FileCheck2 className="h-4 w-4" />
                </span>
                <div className="leading-tight">
                  <div className="text-xs font-bold">KRAS 양식 출력</div>
                  <div className="text-[10px] text-muted-foreground">공단 양식 그대로</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stat strip */}
      <section className="border-y border-border/60 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <Stat value="5가지" label="평가방법 지원" />
          <Stat value="KRAS" label="공식 양식 출력" />
          <Stat value="5년" label="이력 자동 보존" />
          <Stat value="무제한" label="단지 · 좌석" />
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        <div className="text-center mb-12 space-y-3">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            핵심 기능
          </div>
          <h2 className="text-2xl md:text-[2rem] font-bold tracking-tight">필요한 기능을 한 곳에</h2>
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

      {/* How it works */}
      <section className="border-y border-border/60 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-20">
          <div className="text-center mb-12 space-y-2">
            <h2 className="text-2xl md:text-[2rem] font-bold tracking-tight">3단계로 끝내는 위험성평가</h2>
            <p className="text-muted-foreground">복잡한 서류 작업 없이, 순서대로 입력만 하면 됩니다.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <Step n="01" title="유해·위험요인 파악"
              desc="작업 카테고리를 고르고 위험요인을 등록하면 관련 법조문이 자동으로 매칭됩니다." />
            <Step n="02" title="위험성 결정 · 감소대책"
              desc="선택한 평가방법에 맞춰 현재/개선 후 위험성을 산정하고 감소대책을 세웁니다." />
            <Step n="03" title="KRAS 양식 출력 · 보존"
              desc="공식 KRAS 양식으로 출력하고, 5년 보존 요건에 맞춰 이력이 자동 저장됩니다." />
          </div>
        </div>
      </section>

      {/* Legal trust band */}
      <section className="max-w-6xl mx-auto px-4 py-12 text-center">
        <p className="text-sm text-muted-foreground leading-relaxed">
          본 서비스는 <strong className="text-foreground">산업안전보건법 제36조</strong>,
          <strong className="text-foreground"> 고용노동부 고시 제2024-76호</strong>,
          <strong className="text-foreground"> 공동주택관리법 제32조</strong>에 근거한 위험성평가 절차를 지원합니다.
        </p>
      </section>

      {/* Final CTA */}
      <section className="max-w-6xl mx-auto px-4 pb-20 md:pb-28">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary via-primary to-[oklch(0.3_0.14_262)] text-primary-foreground px-6 py-16 md:py-20 text-center">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-success/30 blur-3xl" />
            <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          </div>
          <div className="relative space-y-5">
            <img src="/logo-mark.png" alt="" className="mx-auto w-16 h-16 rounded-2xl object-cover ring-2 ring-white/20 shadow-xl" />
            <h2 className="text-2xl md:text-[2rem] font-bold tracking-tight">오늘 바로 시작해 보세요</h2>
            <p className="text-primary-foreground/80 max-w-lg mx-auto">
              회사를 등록하면 관리자 권한으로 바로 사용할 수 있어요. 14일 무료 체험, 결제 정보 없이 시작.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Link to="/signup">
                <Button size="lg" variant="secondary" className="h-12 px-6 text-base gap-2 shadow-lg">
                  회사 등록하고 시작하기 <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="h-12 px-6 text-base bg-transparent border-white/40 text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">
                  로그인
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src="/logo-mark.png" alt="안전데스크" className="w-5 h-5 rounded object-cover" />
            <span className="font-medium text-foreground">안전데스크</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hover:text-foreground transition-colors">로그인</Link>
            <Link to="/signup" className="hover:text-foreground transition-colors">회사 가입</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="space-y-1">
      <div className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">
        {value}
      </div>
      <div className="text-xs md:text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="group relative rounded-2xl border border-border/70 bg-card p-6 space-y-3 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30">
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-success text-white shadow-sm">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-semibold text-[15px]">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="relative rounded-2xl border border-border/70 bg-card p-6 space-y-3">
      <div className="text-3xl font-extrabold bg-gradient-to-br from-primary to-success bg-clip-text text-transparent">{n}</div>
      <h3 className="font-semibold text-[15px]">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}
