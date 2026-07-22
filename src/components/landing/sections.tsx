import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  AUDIENCES, COMPARISON, FAQS, LEGAL_DUTIES, REAL_CASES, RISK_FACTS, SOURCES,
} from "./landing-data";
import { Building2, Check, Gavel, Scale, ShieldAlert, Users2, X } from "lucide-react";

/** 섹션 제목 묶음. 페이지 전체에서 제목 리듬을 하나로 맞춘다. */
export function SectionHeading({
  eyebrow, title, sub, tone = "default",
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="text-center mb-12 space-y-3">
      {eyebrow && (
        <div
          className={
            tone === "danger"
              ? "inline-flex items-center gap-1.5 rounded-full border border-danger/25 bg-danger/10 px-3 py-1 text-xs font-semibold text-danger"
              : "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1 text-xs font-medium text-muted-foreground"
          }
        >
          {eyebrow}
        </div>
      )}
      <h2 className="text-2xl md:text-[2rem] font-bold tracking-tight text-balance">{title}</h2>
      {sub && <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">{sub}</p>}
    </div>
  );
}

/* ── 섹션 2: 법이 요구하는 것 ─────────────────────────────────────────── */

export function LegalDutiesSection() {
  const icons = [Scale, ShieldAlert, Gavel];
  return (
    <section className="max-w-6xl mx-auto px-4 py-16 md:py-24">
      <SectionHeading
        eyebrow="법이 요구하는 것"
        title="위험성평가는 선택이 아닙니다"
        sub="관리사무소도 근로자를 사용하는 사업장입니다. 법은 세 가지를 요구합니다."
      />
      <div className="grid md:grid-cols-3 gap-5">
        {LEGAL_DUTIES.map((d, i) => {
          const Icon = icons[i];
          return (
            <div key={d.law} className="rounded-2xl border border-border/70 bg-card p-6 space-y-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-success text-white shadow-sm">
                <Icon className="h-5 w-5" />
              </div>
              <div className="inline-flex rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                {d.law}
              </div>
              <h3 className="font-semibold text-[15px]">{d.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{d.desc}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── 섹션 3: 우리 단지도 대상입니다 (손실 회피) ────────────────────────── */

export function RiskSection() {
  return (
    <section className="border-y border-danger/15 bg-danger/[0.04]">
      <div className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        <SectionHeading
          tone="danger"
          eyebrow="우리 단지도 대상입니다"
          title="“설마 우리한테 그런 일이”"
          sub="이미 아파트 관리 현장에서 벌어진 일입니다."
        />

        <div className="grid md:grid-cols-3 gap-5 mb-12">
          {RISK_FACTS.map((f) => (
            <div key={f.stat} className="rounded-2xl border border-danger/20 bg-card p-6 space-y-2">
              <div className="text-2xl md:text-[1.75rem] font-extrabold tracking-tight text-danger">{f.stat}</div>
              <div className="text-sm font-semibold">{f.label}</div>
              <p className="text-sm text-muted-foreground leading-relaxed pt-1">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border/70 bg-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border/70 bg-muted/40">
            <h3 className="font-bold text-[15px]">실제로 처벌까지 간 사례</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              단지명·업체명은 밝히지 않았습니다. 판결과 언론 보도로 확인된 사건이며, 출처는 아래에 있습니다.
            </p>
          </div>
          <ul className="divide-y divide-border/70">
            {REAL_CASES.map((c) => (
              <li key={c.when} className="px-6 py-5 space-y-2.5">
                <div className="grid gap-2 sm:grid-cols-[7.5rem_1fr_auto] sm:items-center sm:gap-4">
                  <div className="text-xs font-semibold text-muted-foreground">
                    {c.when}
                    <div className="font-normal">{c.where}</div>
                  </div>
                  <div className="text-sm">{c.what}</div>
                  <div
                    className={`justify-self-start sm:justify-self-end rounded-lg px-3 py-1.5 text-xs font-bold ${
                      c.severe ? "bg-danger/10 text-danger" : "bg-warning/15 text-warning-foreground"
                    }`}
                  >
                    {c.result}
                  </div>
                </div>
                {/* 함께 처벌받은 사람들 — 형량을 정확히 적어야 신뢰가 유지된다 */}
                <p className="text-xs text-muted-foreground leading-relaxed sm:pl-[8.5rem]">{c.sub}</p>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-center text-sm md:text-base text-muted-foreground mt-10 max-w-2xl mx-auto leading-relaxed">
          사고가 났을 때 가장 먼저 확인하는 서류가 <strong className="text-foreground">위험성평가 기록</strong>입니다.
          <br className="hidden sm:block" />
          기록이 없으면, 하지 않은 것으로 봅니다.
        </p>
      </div>
    </section>
  );
}

/* ── 섹션 4: 지금 방식 vs 안전데스크 ──────────────────────────────────── */

export function ComparisonSection() {
  return (
    <section className="max-w-6xl mx-auto px-4 py-16 md:py-24">
      <SectionHeading
        eyebrow="무엇이 달라지나"
        title="해야 하는 걸 몰라서가 아닙니다"
        sub="시간이 없고, 서식이 복잡하고, 물어볼 사람이 없어서입니다."
      />

      <div className="rounded-2xl border border-border/70 bg-card overflow-hidden">
        {/* 데스크톱 헤더 — 모바일에서는 각 카드가 스스로를 설명한다 */}
        <div className="hidden md:grid md:grid-cols-[10rem_1fr_1fr] bg-muted/40 border-b border-border/70 text-sm font-bold">
          <div className="px-5 py-3.5" />
          <div className="px-5 py-3.5 text-muted-foreground">지금 방식</div>
          <div className="px-5 py-3.5 text-primary">안전데스크</div>
        </div>

        <div className="divide-y divide-border/70">
          {COMPARISON.map((row) => (
            <div key={row.aspect} className="md:grid md:grid-cols-[10rem_1fr_1fr] md:items-stretch">
              <div className="px-5 pt-5 pb-2 md:py-5 text-sm font-bold md:bg-muted/20 md:border-r md:border-border/70">
                {row.aspect}
              </div>
              <div className="px-5 py-2 md:py-5 flex items-start gap-2.5 md:border-r md:border-border/70">
                <X className="h-4 w-4 shrink-0 mt-0.5 text-danger" />
                <span className="text-sm text-muted-foreground leading-relaxed">{row.before}</span>
              </div>
              <div className="px-5 pt-2 pb-5 md:py-5 flex items-start gap-2.5">
                <Check className="h-4 w-4 shrink-0 mt-0.5 text-success" />
                <span className="text-sm leading-relaxed">{row.after}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── 섹션 8: 누가 쓰나 ────────────────────────────────────────────────── */

export function AudienceSection() {
  const icons = [Building2, Users2, ShieldAlert];
  return (
    <section className="max-w-6xl mx-auto px-4 py-16 md:py-24">
      <SectionHeading
        eyebrow="이런 분들이 씁니다"
        title="맡은 자리에 따라 필요한 것이 다릅니다"
      />
      <div className="grid md:grid-cols-3 gap-5">
        {AUDIENCES.map((a, i) => {
          const Icon = icons[i];
          return (
            <div key={a.who} className="rounded-2xl border border-border/70 bg-card p-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="leading-tight">
                  <div className="font-bold">{a.who}</div>
                  <div className="text-xs text-muted-foreground">{a.sub}</div>
                </div>
              </div>
              <ul className="space-y-2.5">
                {a.points.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-sm leading-relaxed">
                    <Check className="h-4 w-4 shrink-0 mt-0.5 text-success" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── 섹션 9: 만든 사람 ────────────────────────────────────────────────── */

export function TrustSection() {
  return (
    <section className="border-y border-border/60 bg-muted/30">
      <div className="max-w-3xl mx-auto px-4 py-16 md:py-20 text-center space-y-5">
        <img src="/logo-mark.png" alt="" className="mx-auto w-14 h-14 rounded-2xl object-cover ring-1 ring-border/60" />
        <h2 className="text-2xl md:text-[2rem] font-bold tracking-tight">현직 시설관리자가 만들었습니다</h2>
        <p className="text-muted-foreground leading-relaxed">
          공동주택 현장에서 직접 위험성평가 서류를 만들며 겪은 불편에서 시작했습니다.
          공단 서식을 내려받아 한글로 짜맞추고, 조문을 하나하나 찾아 붙이고, 작년 파일을 뒤지던 일을
          없애려고 만든 도구입니다. 컨설팅 회사가 아니라, 같은 일을 하는 사람이 만들었습니다.
        </p>
        <div className="grid sm:grid-cols-3 gap-4 pt-4 text-left">
          {[
            { t: "회사 단위 데이터 분리", d: "다른 회사의 자료에는 접근할 수 없습니다." },
            { t: "권한 분리", d: "관리자·매니저·직원별로 보이는 범위가 나뉩니다." },
            { t: "5년 보관", d: "법정 3년 보존기간을 넘겨 보관합니다." },
          ].map((x) => (
            <div key={x.t} className="rounded-xl border border-border/70 bg-card p-4">
              <div className="text-sm font-semibold mb-1">{x.t}</div>
              <div className="text-xs text-muted-foreground leading-relaxed">{x.d}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── 섹션 10: FAQ ─────────────────────────────────────────────────────── */

export function FaqSection() {
  return (
    <section className="max-w-3xl mx-auto px-4 py-16 md:py-24">
      <SectionHeading eyebrow="자주 묻는 질문" title="궁금하실 만한 것들" />
      <Accordion type="single" collapsible className="w-full">
        {FAQS.map((f, i) => (
          <AccordionItem key={f.q} value={`faq-${i}`}>
            <AccordionTrigger className="text-left text-[15px] font-semibold">{f.q}</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

/* ── 출처 각주 ────────────────────────────────────────────────────────── */

export function SourcesNote() {
  return (
    <section className="max-w-3xl mx-auto px-4 pb-12">
      <div className="rounded-xl border border-border/60 bg-muted/30 px-5 py-4 space-y-2">
        <div className="text-xs font-semibold text-muted-foreground">근거 및 출처</div>
        <ul className="space-y-1">
          {SOURCES.map((s) => (
            <li key={s.href}>
              <a
                href={s.href}
                target="_blank"
                rel="noreferrer noopener"
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-muted-foreground/80 leading-relaxed pt-1">
          본 페이지의 법령 안내는 이해를 돕기 위한 것으로 법률 자문이 아닙니다.
          개별 사업장의 의무 적용 여부는 관할 고용노동청 또는 전문가의 확인을 받으시기 바랍니다.
        </p>
      </div>
    </section>
  );
}
