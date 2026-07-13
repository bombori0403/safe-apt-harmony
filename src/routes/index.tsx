import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";

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
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/15">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo-mark.png" alt="안전데스크" className="w-8 h-8 rounded-lg object-cover" />
            <span className="font-semibold tracking-tight">안전데스크</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Link to="/login">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">로그인</Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="gap-1">시작하기 <ArrowRight className="h-3.5 w-3.5" /></Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-5 pt-16 pb-16 md:pt-24 md:pb-24 grid lg:grid-cols-[1fr_1.05fr] gap-14 lg:gap-16 items-center">
        <div>
          <div className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground mb-6">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-success" />
            산업안전보건법 · 중대재해처벌법 대응
          </div>
          <h1 className="text-[2.4rem] leading-[1.14] md:text-[3.4rem] md:leading-[1.08] font-bold tracking-[-0.02em] text-foreground">
            공동주택 위험성평가를
            <br />
            처음부터 끝까지,
            <br />
            <span className="relative inline-block">
              한 곳에서.
              <span aria-hidden className="absolute left-0 -bottom-0.5 h-[0.4em] w-full bg-success/25 -z-0 rounded-sm" />
            </span>
          </h1>
          <p className="mt-6 text-[1.05rem] text-muted-foreground leading-relaxed max-w-md">
            유해·위험요인 파악부터 감소대책, KRAS 양식 출력, 5년 이력 보존까지.
            관리사무소가 실제로 쓰는 절차 그대로 설계했습니다.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/signup">
              <Button size="lg" className="h-12 px-6 text-[15px] gap-2">
                14일 무료로 시작하기 <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login" className="text-[15px] font-medium text-foreground hover:text-primary inline-flex items-center gap-1 px-2 transition-colors">
              로그인 <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> 신용카드 불필요</span>
            <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> 좌석 제한 없음</span>
          </div>
        </div>

        {/* Product surface — real KRAS-style risk table */}
        <div className="relative">
          <div aria-hidden className="absolute -right-3 -top-3 h-full w-full rounded-2xl border border-border/60 bg-muted/40" />
          <div className="relative rounded-2xl border border-border/80 bg-card shadow-[0_20px_50px_-24px_oklch(0.42_0.18_262/0.35)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/70">
              <div className="flex items-center gap-2">
                <img src="/logo-mark.png" alt="" className="w-5 h-5 rounded object-cover" />
                <span className="text-[13px] font-semibold">위험성평가표</span>
              </div>
              <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">경비·보안</span>
            </div>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-[11px] text-muted-foreground border-b border-border/70">
                  <th className="text-left font-medium px-5 py-2.5 w-8">No</th>
                  <th className="text-left font-medium py-2.5">유해·위험요인</th>
                  <th className="text-center font-medium py-2.5 w-14">현재</th>
                  <th className="text-center font-medium px-5 py-2.5 w-16">개선 후</th>
                </tr>
              </thead>
              <tbody>
                <RiskRow no={1} hazard="미끄러운 바닥 통행 중 전도" cur="상" post="하" />
                <RiskRow no={2} hazard="야간 순찰 시야 불량" cur="중" post="하" />
                <RiskRow no={3} hazard="소화전 점검 중 감전" cur="상" post="중" />
                <RiskRow no={4} hazard="주차 차단기 협착" cur="중" post="하" last />
              </tbody>
            </table>
            <div className="flex items-center justify-between px-5 py-3 border-t border-border/70 bg-muted/30">
              <span className="text-[11.5px] text-muted-foreground">관련근거 자동 매칭 · 산업안전보건기준에 관한 규칙</span>
              <span className="text-[11.5px] font-semibold text-primary">KRAS 양식 출력 →</span>
            </div>
          </div>
        </div>
      </section>

      {/* Trust line */}
      <section className="border-y border-border/70 bg-muted/25">
        <div className="max-w-6xl mx-auto px-5 py-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-center text-[13px] text-muted-foreground">
          <span>산업안전보건법 제36조</span>
          <span className="hidden sm:inline text-border">·</span>
          <span>고용노동부 고시 제2024-76호</span>
          <span className="hidden sm:inline text-border">·</span>
          <span>공동주택관리법 제32조</span>
          <span className="hidden sm:inline text-border">·</span>
          <span>시행규칙 제37조 5년 보존</span>
        </div>
      </section>

      {/* Features — editorial numbered list */}
      <section className="max-w-6xl mx-auto px-5 py-20 md:py-28">
        <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-12 lg:gap-16">
          <div className="lg:sticky lg:top-28 self-start">
            <div className="text-[13px] font-semibold text-primary mb-3">핵심 기능</div>
            <h2 className="text-[1.9rem] md:text-[2.3rem] font-bold tracking-[-0.02em] leading-[1.15]">
              현장에서 바로 쓰도록
              <br />설계된 도구들
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              복잡한 안전관리 업무를 하나의 흐름으로 묶었습니다.
              입력한 내용은 법정 서식 그대로 출력되고, 요건에 맞춰 보존됩니다.
            </p>
          </div>

          <div className="divide-y divide-border/70 border-t border-border/70">
            <FeatureRow n="01" title="법정 절차 자동 지원"
              desc="빈도강도법·3단계·5단계·체크리스트·OPS 등 평가방법을 선택하면 절차에 맞춰 안내합니다." />
            <FeatureRow n="02" title="관련 법조문 자동 매칭"
              desc="유해·위험요인을 입력하면 산업안전보건기준에 관한 규칙 등 관련 법적기준이 자동으로 붙습니다." />
            <FeatureRow n="03" title="KRAS 양식 그대로 출력"
              desc="안전보건공단 KRAS 위험성평가표와 동일한 양식으로 개별·전체 이력을 인쇄·PDF 저장할 수 있습니다." />
            <FeatureRow n="04" title="아차사고 · 작업중지권"
              desc="위험성평가 외에도 아차사고 기록, 작업중지권 행사 대장 등 안전관리 업무를 함께 지원합니다." />
            <FeatureRow n="05" title="직원 협업과 5년 보존"
              desc="관리자·매니저·직원 권한과 협의·서명 확인, 시행규칙 제37조에 따른 5년 이력 보존까지." />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border/70 bg-muted/25">
        <div className="max-w-6xl mx-auto px-5 py-20 md:py-24">
          <div className="max-w-xl mb-14">
            <div className="text-[13px] font-semibold text-primary mb-3">진행 방식</div>
            <h2 className="text-[1.9rem] md:text-[2.3rem] font-bold tracking-[-0.02em] leading-[1.15]">
              세 단계면 충분합니다
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-px bg-border/70 border border-border/70 rounded-2xl overflow-hidden">
            <Step n="01" title="유해·위험요인 파악"
              desc="작업 카테고리를 고르고 위험요인을 등록하면 관련 법조문이 자동으로 매칭됩니다." />
            <Step n="02" title="위험성 결정 · 감소대책"
              desc="선택한 평가방법에 맞춰 현재/개선 후 위험성을 산정하고 감소대책을 세웁니다." />
            <Step n="03" title="KRAS 출력 · 보존"
              desc="공식 KRAS 양식으로 출력하고, 5년 보존 요건에 맞춰 이력이 자동 저장됩니다." />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-5 py-24 md:py-32">
        <div className="max-w-2xl mx-auto text-center">
          <img src="/logo-mark.png" alt="" className="mx-auto w-14 h-14 rounded-2xl object-cover mb-7" />
          <h2 className="text-[2rem] md:text-[2.6rem] font-bold tracking-[-0.02em] leading-[1.1]">
            안전관리, 오늘부터 체계적으로.
          </h2>
          <p className="mt-5 text-[1.05rem] text-muted-foreground leading-relaxed">
            회사를 등록하면 관리자 권한으로 바로 시작할 수 있습니다.
            14일 무료 체험, 결제 정보 없이.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link to="/signup">
              <Button size="lg" className="h-12 px-7 text-[15px] gap-2">
                회사 등록하고 시작하기 <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="h-12 px-7 text-[15px]">로그인</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/70">
        <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col md:flex-row items-center justify-between gap-3 text-[13px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src="/logo-mark.png" alt="안전데스크" className="w-5 h-5 rounded object-cover" />
            <span className="font-medium text-foreground">안전데스크</span>
            <span className="text-border">·</span>
            <span>공동주택 위험성평가 통합 관리</span>
          </div>
          <div className="flex items-center gap-5">
            <Link to="/login" className="hover:text-foreground transition-colors">로그인</Link>
            <Link to="/signup" className="hover:text-foreground transition-colors">회사 가입</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

const RISK: Record<string, string> = {
  상: "bg-destructive/10 text-destructive",
  중: "bg-warning/15 text-[oklch(0.45_0.11_70)]",
  하: "bg-success/10 text-[oklch(0.5_0.13_162)]",
};

function Badge({ level }: { level: string }) {
  return (
    <span className={`inline-block min-w-[26px] rounded-md px-1.5 py-0.5 text-[11px] font-bold text-center ${RISK[level]}`}>
      {level}
    </span>
  );
}

function RiskRow({ no, hazard, cur, post, last }: { no: number; hazard: string; cur: string; post: string; last?: boolean }) {
  return (
    <tr className={last ? "" : "border-b border-border/60"}>
      <td className="px-5 py-3 text-muted-foreground tabular-nums">{no}</td>
      <td className="py-3 text-foreground">{hazard}</td>
      <td className="py-3 text-center"><Badge level={cur} /></td>
      <td className="px-5 py-3 text-center"><Badge level={post} /></td>
    </tr>
  );
}

function FeatureRow({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="group grid grid-cols-[auto_1fr] gap-5 py-7">
      <div className="text-[13px] font-semibold text-muted-foreground/70 tabular-nums pt-0.5 w-8">{n}</div>
      <div>
        <h3 className="font-semibold text-[1.05rem] group-hover:text-primary transition-colors">{title}</h3>
        <p className="mt-1.5 text-[14.5px] text-muted-foreground leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="bg-card p-7 md:p-8">
      <div className="text-[13px] font-semibold text-primary tabular-nums mb-4">{n}</div>
      <h3 className="font-semibold text-[1.05rem]">{title}</h3>
      <p className="mt-2 text-[14px] text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}
