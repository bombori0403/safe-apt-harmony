import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AudienceSection, ComparisonSection, FaqSection, LegalDutiesSection,
  RiskSection, SectionHeading, SourcesNote, TrustSection,
} from "@/components/landing/sections";
import { BrowserFrame, ScreenshotsSection } from "@/components/landing/screenshots-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { KAKAO_CHANNEL_URL } from "@/components/landing/landing-data";
import {
  Shield, ClipboardCheck, FileCheck2, Users, ScrollText, BadgeCheck,
  ArrowRight, Check, Sparkles, MessageCircle,
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
            <a href="#pricing" className="hidden sm:inline-flex px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">요금</a>
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

        <div className="max-w-6xl mx-auto px-4 pt-16 pb-14 md:pt-24 md:pb-20 grid lg:grid-cols-[1fr_1.05fr] gap-12 lg:gap-10 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" /> 산업안전보건법 · 중대재해처벌법 대응
            </div>
            <h1 className="text-[2rem] leading-[1.2] md:text-[2.9rem] md:leading-[1.15] font-extrabold tracking-tight text-balance">
              작년 위험성평가 서류,
              <br />
              지금 <span className="bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">꺼내실 수 있습니까?</span>
            </h1>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-lg">
              공동주택 관리사무소를 위한 위험성평가 플랫폼. 유해·위험요인 파악부터 감소대책,
              KRAS 공식 양식 출력, 이력 보존까지 법이 요구하는 절차대로 한 곳에서 끝냅니다.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link to="/signup">
                <Button size="lg" className="gap-2 h-12 px-6 text-base shadow-lg shadow-primary/25">
                  14일 무료로 시작하기 <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <KakaoButton size="lg" variant="outline" />
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> 신용카드 불필요</span>
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> 좌석 제한 없음</span>
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> 5분 만에 세팅</span>
            </div>
          </div>

          {/* 실제 KRAS 출력물 — 이 페이지에서 가장 먼저 보여줘야 할 증거 */}
          <div className="relative">
            <div aria-hidden className="absolute -inset-6 -z-10 bg-gradient-to-br from-primary/15 to-success/15 blur-2xl rounded-[2rem]" />
            <BrowserFrame
              src="/shots/shot-kras.png"
              alt="안전보건공단 KRAS 양식으로 출력된 위험성평가표"
              className="rotate-1"
              priority
            />
            <div className="absolute -left-3 sm:-left-6 bottom-8 rounded-xl border border-border/70 bg-card/95 backdrop-blur px-4 py-3 shadow-xl shadow-success/10 -rotate-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-success/10 text-success">
                  <FileCheck2 className="h-4 w-4" />
                </span>
                <div className="leading-tight">
                  <div className="text-xs font-bold">공단 KRAS 양식 그대로</div>
                  <div className="text-[10px] text-muted-foreground">인쇄 · PDF 저장</div>
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
          <Stat value="5년" label="이력 보관 (법정 3년)" />
          <Stat value="무제한" label="직원 좌석" />
        </div>
      </section>

      {/* 2. 법이 요구하는 것 */}
      <LegalDutiesSection />

      {/* 3. 우리 단지도 대상입니다 */}
      <RiskSection />

      {/* 4. 지금 방식 vs 안전데스크 */}
      <ComparisonSection />

      {/* 5. 실제 화면 */}
      <ScreenshotsSection />

      {/* 6. How it works */}
      <section className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        <SectionHeading
          eyebrow="사용 방법"
          title="3단계로 끝내는 위험성평가"
          sub="복잡한 서류 작업 없이, 순서대로 입력만 하면 됩니다."
        />
        <div className="grid md:grid-cols-3 gap-6">
          <Step n="01" title="유해·위험요인 파악"
            desc="작업 카테고리를 고르고 위험요인을 등록하면 관련 법조문이 자동으로 매칭됩니다." />
          <Step n="02" title="위험성 결정 · 감소대책"
            desc="선택한 평가방법에 맞춰 현재/개선 후 위험성을 산정하고 감소대책을 세웁니다." />
          <Step n="03" title="KRAS 양식 출력 · 보존"
            desc="공식 KRAS 양식으로 출력하고, 법정 보존 요건에 맞춰 이력이 자동 저장됩니다." />
        </div>
      </section>

      {/* 7. Features */}
      <section className="border-y border-border/60 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-24">
          <SectionHeading
            eyebrow="핵심 기능"
            title="필요한 기능을 한 곳에"
            sub="현장에서 바로 쓸 수 있도록 설계했습니다."
          />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            <Feature icon={ClipboardCheck} title="법정 절차 자동 지원"
              desc="빈도강도법·3단계·5단계·체크리스트·OPS 등 평가방법을 선택하면 절차에 맞춰 안내합니다." />
            <Feature icon={ScrollText} title="관련 법조문 자동 매칭 · 확인 후 수정"
              desc="유해·위험요인을 입력하면 산업안전보건기준에 관한 규칙 등 관련 법적기준이 자동으로 제안됩니다. 제안된 조문은 담당자가 확인하고, 맞지 않으면 직접 수정할 수 있습니다." />
            <Feature icon={FileCheck2} title="KRAS 양식 그대로 출력"
              desc="안전보건공단 KRAS 위험성평가표와 동일한 양식으로 개별·전체 이력을 인쇄·PDF 저장할 수 있습니다." />
            <Feature icon={Users} title="직원 협업 · 승인"
              desc="관리자·매니저·직원 권한과 초대 링크, 협의·서명 확인까지 팀 단위로 관리합니다." />
            <Feature icon={BadgeCheck} title="아차사고 · 작업중지권"
              desc="위험성평가 외에도 아차사고 기록, 작업중지권 행사 대장 등 안전관리 업무를 함께 지원합니다." />
            <Feature icon={Shield} title="이력 5년 보관"
              desc="시행규칙 제37조의 법정 보존기간 3년을 넘겨, 자체 규정 기준 5년간 안전하게 보관합니다." />
          </div>
        </div>
      </section>

      {/* 8. 요금 */}
      <PricingSection />

      {/* 9. 누가 쓰나 */}
      <AudienceSection />

      {/* 9. 만든 사람 */}
      <TrustSection />

      {/* 10. FAQ */}
      <FaqSection />

      {/* 11. Final CTA */}
      <section className="max-w-6xl mx-auto px-4 pb-16 md:pb-20">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary via-primary to-[oklch(0.3_0.14_262)] text-primary-foreground px-6 py-16 md:py-20 text-center">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-success/30 blur-3xl" />
            <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          </div>
          <div className="relative space-y-5">
            <img src="/logo-mark.png" alt="" className="mx-auto w-16 h-16 rounded-2xl object-cover ring-2 ring-white/20 shadow-xl" />
            <h2 className="text-2xl md:text-[2rem] font-bold tracking-tight text-balance">
              올해 위험성평가, 이번 주에 끝내세요
            </h2>
            <p className="text-primary-foreground/80 max-w-lg mx-auto leading-relaxed">
              회사를 등록하면 관리자 권한으로 바로 사용할 수 있습니다.
              14일 무료 체험, 결제 정보 없이 시작하세요.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Link to="/signup">
                <Button size="lg" variant="secondary" className="h-12 px-6 text-base gap-2 shadow-lg">
                  회사 등록하고 시작하기 <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <KakaoButton size="lg" variant="outline" onDark />
            </div>
            <p className="text-xs text-primary-foreground/70 pt-1">
              도입 상담 · 여러 단지 운영 문의는 카카오톡으로 편하게 남겨주세요.
            </p>
          </div>
        </div>
      </section>

      {/* 출처 */}
      <SourcesNote />

      {/* Footer */}
      <footer className="border-t border-border/60">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src="/logo-mark.png" alt="안전데스크" className="w-5 h-5 rounded object-cover" />
            <span className="font-medium text-foreground">안전데스크</span>
          </div>
          <div className="flex items-center gap-4">
            <a href={KAKAO_CHANNEL_URL} target="_blank" rel="noreferrer noopener" className="hover:text-foreground transition-colors">문의</a>
            <Link to="/privacy" className="hover:text-foreground transition-colors">개인정보처리방침</Link>
            <Link to="/login" className="hover:text-foreground transition-colors">로그인</Link>
            <Link to="/signup" className="hover:text-foreground transition-colors">회사 가입</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** 카카오톡 채널 문의 버튼. 새 창으로 열리며 페이지 곳곳에서 재사용된다. */
function KakaoButton({
  size = "default", variant = "outline", onDark = false,
}: {
  size?: "default" | "lg";
  variant?: "outline" | "secondary";
  onDark?: boolean;
}) {
  return (
    <a href={KAKAO_CHANNEL_URL} target="_blank" rel="noreferrer noopener">
      <Button
        size={size}
        variant={variant}
        className={
          onDark
            ? "h-12 px-6 text-base gap-2 bg-transparent border-white/40 text-primary-foreground hover:bg-white/10 hover:text-primary-foreground"
            : "h-12 px-6 text-base gap-2"
        }
      >
        <MessageCircle className="h-4 w-4" /> 카카오톡 문의
      </Button>
    </a>
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
