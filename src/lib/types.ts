export type AssessmentMethod = "3단계" | "5단계" | "빈도강도" | "체크리스트" | "OPS";
export type RiskLevel = "매우낮음" | "낮음" | "보통" | "높음" | "매우높음";
export type AssessmentType = "최초평가" | "정기평가" | "수시평가";
export type AssessmentStatus = "작성중" | "협의중" | "완료";
export type MeasureType = "본질적" | "공학적" | "관리적" | "개인보호구";
export type WorkCategory =
  | "승강기 점검·정비"
  | "기계실·보일러실 작업"
  | "전기실·변전실 작업"
  | "옥상·외벽 작업"
  | "어린이 놀이시설 점검"
  | "지하주차장·환기설비 작업"
  | "소방시설 점검"
  | "조경·외부 작업"
  | "청소·미화·일반 사무";

export const WORK_CATEGORIES: WorkCategory[] = [
  "승강기 점검·정비",
  "기계실·보일러실 작업",
  "전기실·변전실 작업",
  "옥상·외벽 작업",
  "어린이 놀이시설 점검",
  "지하주차장·환기설비 작업",
  "소방시설 점검",
  "조경·외부 작업",
  "청소·미화·일반 사무",
];

export const RISK_LEVELS: RiskLevel[] = ["매우낮음", "낮음", "보통", "높음", "매우높음"];

export const RISK_ORDER: Record<RiskLevel, number> = {
  매우낮음: 1, 낮음: 2, 보통: 3, 높음: 4, 매우높음: 5,
};

export function riskLevelClass(level?: RiskLevel | null) {
  switch (level) {
    case "매우높음":
    case "높음":
      return "risk-high";
    case "보통":
      return "risk-mid";
    case "낮음":
    case "매우낮음":
      return "risk-low";
    default:
      return "bg-muted text-muted-foreground";
  }
}
