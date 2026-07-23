// 세대수 구간 정액제 — 안전데스크 요금 단일 진실 소스(single source of truth).
// 결제 금액 계산, /activate 결제 화면, 랜딩 요금표가 모두 이 파일을 참조한다.
//
// 과금 모델: 총 결제액 = 각 단지의 세대수 구간 단가 합산.
//   - 단지마다 자기 세대수가 속한 구간의 단가를 적용한다.
//   - 월 단가 = 연간 ÷ 10 (연납 시 2개월치 할인 → 연납 유도).
//   - 결제한 단지 수/규모가 등록 상한. 단지 추가 시 해당 구간 단가만큼 추가결제.

// 결제 공개 여부. 현재는 토스 "테스트 키"가 배포돼 있어, 실키(사업자 가맹) 전까지는
// 플랫폼 관리자에게만 결제를 허용한다(실고객이 무료로 자가 활성화하는 것 방지).
// 실키로 전환하면 이 값을 true로 바꾸면 전체 공개된다.
export const PAYMENTS_PUBLIC = false;

// 단지당 기본 제공 사진 저장용량. 초과 시 추가 요금(협의). 실사용이 이보다 훨씬 낮아 여유가 크며,
// 비정상 대용량 방지·계약상 근거 성격이다. 값 변경은 여기 한 곳만 수정하면 된다.
export const STORAGE_LIMIT_PER_COMPLEX_BYTES = 1 * 1024 * 1024 * 1024; // 1GB
export const STORAGE_LIMIT_PER_COMPLEX_LABEL = "1GB";
// 저장용량 초과 안내 문구(사용량 화면·가입 고지에서 공통 사용).
export const STORAGE_OVERAGE_NOTICE =
  `단지당 사진 저장용량 ${STORAGE_LIMIT_PER_COMPLEX_LABEL}이 기본 제공됩니다. 초과 시 추가 요금이 발생할 수 있으며, 초과가 예상되면 사전에 안내드립니다.`;

export type BillingCycle = "annual" | "monthly";

export interface PricingTier {
  id: string;
  label: string;                 // 표시용: "~300세대"
  minHouseholds: number;         // 하한 (이상, 포함)
  maxHouseholds: number | null;  // 상한 (이하, 포함). null = 무제한
  annual: number;                // 연간 단지당 단가(원)
  monthly: number;               // 월 단지당 단가(원)
}

// ⚠️ 금액을 바꿀 땐 여기만 수정하면 전체에 반영된다.
export const PRICING_TIERS: PricingTier[] = [
  { id: "t1", label: "~300세대",        minHouseholds: 0,    maxHouseholds: 300,  annual: 60000,  monthly: 6000 },
  { id: "t2", label: "301~500세대",     minHouseholds: 301,  maxHouseholds: 500,  annual: 100000, monthly: 10000 },
  { id: "t3", label: "501~1,000세대",   minHouseholds: 501,  maxHouseholds: 1000, annual: 150000, monthly: 15000 },
  { id: "t4", label: "1,001~2,000세대", minHouseholds: 1001, maxHouseholds: 2000, annual: 250000, monthly: 25000 },
  { id: "t5", label: "2,001세대~",      minHouseholds: 2001, maxHouseholds: null, annual: 350000, monthly: 35000 },
];

/** 세대수가 속한 구간을 찾는다. 값이 없거나 음수면 최저 구간 처리. */
export function tierForHouseholds(households: number | null | undefined): PricingTier {
  const h = Math.max(0, Math.floor(households ?? 0));
  return (
    PRICING_TIERS.find(
      (t) => h >= t.minHouseholds && (t.maxHouseholds == null || h <= t.maxHouseholds),
    ) ?? PRICING_TIERS[0]
  );
}

/** 단일 단지의 결제 단가(원). */
export function priceForHouseholds(households: number | null | undefined, cycle: BillingCycle): number {
  const t = tierForHouseholds(households);
  return cycle === "annual" ? t.annual : t.monthly;
}

/** 여러 단지의 세대수 배열 → 총 결제액(원). */
export function totalPrice(householdCounts: Array<number | null | undefined>, cycle: BillingCycle): number {
  return householdCounts.reduce<number>((sum, h) => sum + priceForHouseholds(h, cycle), 0);
}

/** 단지별 단가 내역 + 합계 (결제 화면 명세용). */
export interface PriceLine {
  label: string;        // 단지명 등 호출부가 채움
  households: number;
  tierLabel: string;
  unit: number;         // 해당 단지 단가(원)
}
export function priceBreakdown(
  complexes: Array<{ name?: string; household_count?: number | null }>,
  cycle: BillingCycle,
): { lines: PriceLine[]; total: number } {
  const lines = complexes.map((c) => {
    const t = tierForHouseholds(c.household_count);
    return {
      label: c.name ?? "",
      households: Math.max(0, Math.floor(c.household_count ?? 0)),
      tierLabel: t.label,
      unit: cycle === "annual" ? t.annual : t.monthly,
    };
  });
  return { lines, total: lines.reduce((s, l) => s + l.unit, 0) };
}

/** 원화 표기: 60000 → "60,000원". */
export function formatKRW(won: number): string {
  return `${Math.round(won).toLocaleString("ko-KR")}원`;
}
