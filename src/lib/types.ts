export type AssessmentMethod = "3단계_판단법" | "5단계_판단법" | "빈도강도법" | "체크리스트법" | "OPS";
export type RiskLevel = "매우낮음" | "낮음" | "보통" | "높음" | "매우높음";
export type AssessmentType = "최초평가" | "정기평가" | "수시평가";
export type AssessmentStatus = "작성중" | "협의중" | "완료";
export type MeasureType = "본질적_대책" | "공학적_대책" | "관리적_대책" | "개인보호구";
export type WorkCategory =
  | "승강기_점검정비"
  | "기계실_보일러실"
  | "전기실_변전실"
  | "옥상_외벽"
  | "어린이놀이시설"
  | "지하주차장_환기"
  | "소방시설"
  | "조경_외부작업"
  | "청소_미화_사무"
  | "경비_보안"
  | "주차관리";

export const WORK_CATEGORIES: WorkCategory[] = [
  "승강기_점검정비",
  "기계실_보일러실",
  "전기실_변전실",
  "옥상_외벽",
  "어린이놀이시설",
  "지하주차장_환기",
  "소방시설",
  "조경_외부작업",
  "청소_미화_사무",
  "경비_보안",
  "주차관리",
];

export const CATEGORY_LABEL: Record<WorkCategory, string> = {
  "승강기_점검정비": "승강기 점검·정비",
  "기계실_보일러실": "기계실·보일러실",
  "전기실_변전실": "전기실·변전실",
  "옥상_외벽": "옥상·외벽 작업",
  "어린이놀이시설": "어린이 놀이시설",
  "지하주차장_환기": "지하주차장·환기설비",
  "소방시설": "소방시설",
  "조경_외부작업": "조경·외부 작업",
  "청소_미화_사무": "청소·미화·사무",
  "경비_보안": "경비·보안",
  "주차관리": "주차관리",
};

export const METHOD_LABEL: Record<AssessmentMethod, string> = {
  "3단계_판단법": "3단계 판단법",
  "5단계_판단법": "5단계 판단법",
  "빈도강도법": "빈도·강도법",
  "체크리스트법": "체크리스트법",
  "OPS": "OPS",
};

export const ASSESSMENT_METHODS: AssessmentMethod[] = ["3단계_판단법","5단계_판단법","빈도강도법","체크리스트법","OPS"];

export const RISK_LEVELS: RiskLevel[] = ["매우낮음", "낮음", "보통", "높음", "매우높음"];

export const RISK_ORDER: Record<string, number> = {
  매우낮음: 1, 낮음: 2, 보통: 3, 높음: 4, 매우높음: 5,
  // 3단계(상/중/하)·체크리스트(적정/보완) 값도 허용수준 비교에 대응
  하: 2, 중: 3, 상: 5,
  적정: 2, 보완: 4,
};

export function scoreToRiskLevel(score: number): RiskLevel {
  if (score <= 4) return "매우낮음";
  if (score <= 8) return "낮음";
  if (score <= 12) return "보통";
  if (score <= 16) return "높음";
  return "매우높음";
}

export function riskLevelClass(level?: string | null) {
  switch (level) {
    case "매우높음":
    case "높음":
    case "상":
      return "risk-high";
    case "보통":
    case "중":
      return "risk-mid";
    case "낮음":
    case "매우낮음":
    case "하":
      return "risk-low";
    default:
      return "bg-muted text-muted-foreground";
  }
}
