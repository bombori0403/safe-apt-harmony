import { Link } from "@tanstack/react-router";
import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRICING_TIERS, formatKRW, totalPrice } from "@/lib/pricing";
import { SectionHeading } from "./sections";

// 랜딩 요금 섹션. 금액은 src/lib/pricing.ts(단일 소스)에서 가져오므로
// 요금을 바꾸려면 pricing.ts만 수정하면 이 표도 자동 반영된다.
export function PricingSection() {
  const exampleTotal = totalPrice([250, 800, 1500], "annual"); // 6만+15만+25만

  return (
    <section id="pricing" className="max-w-6xl mx-auto px-4 py-16 md:py-24">
      <SectionHeading
        eyebrow="요금"
        title="맡은 단지의 세대수만큼만"
        sub="단지별로 세대수 구간에 따라 정액입니다. 직원(좌석)은 무제한이고, 여러 단지는 각 단지 요금을 각각 적용해 더합니다(세대수를 합산해 하나의 구간으로 계산하지 않습니다)."
      />

      <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card">
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="bg-muted/40 text-muted-foreground">
              <th className="text-left font-medium px-5 py-3">단지 세대수</th>
              <th className="text-right font-medium px-5 py-3">연간 (단지당)</th>
              <th className="text-right font-medium px-5 py-3">월 (단지당)</th>
              <th className="text-right font-medium px-5 py-3">사진 저장</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {PRICING_TIERS.map((t) => (
              <tr key={t.id} className="transition-colors hover:bg-muted/20">
                <td className="px-5 py-4 font-medium">{t.label}</td>
                <td className="px-5 py-4 text-right">
                  <span className="font-semibold">{formatKRW(t.annual)}</span>
                  <span className="text-muted-foreground font-normal"> / 년</span>
                </td>
                <td className="px-5 py-4 text-right text-muted-foreground">
                  {formatKRW(t.monthly)} / 월
                </td>
                <td className="px-5 py-4 text-right text-muted-foreground">{t.storageGB}GB</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> 14일 무료 체험 (결제 정보 불필요)</span>
        <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> 직원(좌석) 무제한</span>
        <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> 연간 결제 시 2개월 할인</span>
        <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> 부가세 포함</span>
        <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> 사진 저장 세대수 구간별 기본 제공 (초과 시 추가요금)</span>
      </div>

      <div className="mt-6 rounded-2xl border border-border/70 bg-muted/20 p-5 md:p-6">
        <div className="text-sm font-semibold mb-1">예시 · 여러 단지를 맡은 위탁관리업체</div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          250세대 + 800세대 + 1,500세대 단지를 운영한다면{" "}
          <b className="text-foreground">연 {formatKRW(exampleTotal)}</b>{" "}
          (각 6만 + 15만 + 25만원). <b className="text-foreground">단지마다 각자의 세대수 구간 요금이 적용</b>되며,
          세대수를 모두 합쳐(2,550세대) 하나의 상위 구간으로 계산하지 않습니다. 단지를 추가하면 그 단지의 구간 요금만 더해집니다.
        </p>
      </div>

      <div className="mt-8 text-center">
        <Link to="/signup">
          <Button size="lg" className="gap-2 h-12 px-6 text-base shadow-lg shadow-primary/25">
            14일 무료로 시작하기 <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <p className="text-xs text-muted-foreground mt-3">요금·도입 문의는 카카오톡으로 편하게 남겨주세요.</p>
      </div>
    </section>
  );
}
