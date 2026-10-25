/**
 * 위험성평가 작성 5단계 — 화면마다 "지금 몇 단계인지"를 같은 번호로 보여주기 위한 단일 정의.
 * 사전준비(새 평가 마법사)는 1단계 안의 화면들이다 (마법사 자체 진행률은 그 화면이 따로 표시).
 */
export const ASSESSMENT_STEPS = [
  { n: 1, key: "prepare", label: "사전준비", short: "기본정보·방법·기준" },
  { n: 2, key: "hazards", label: "유해·위험요인 파악", short: "위험요인 고르기" },
  { n: 3, key: "results", label: "위험성 결정", short: "등급 정하기" },
  { n: 4, key: "measures", label: "감소대책 수립·실행", short: "대책 세우기" },
  { n: 5, key: "share", label: "협의·공유", short: "참여 확인·서명" },
] as const;

export type AssessmentStepKey = (typeof ASSESSMENT_STEPS)[number]["key"];

export function stepRoute(key: AssessmentStepKey): string {
  switch (key) {
    case "prepare": return "/assessment/$id";
    case "hazards": return "/assessment/$id/hazards";
    case "results": return "/assessment/$id/results";
    case "measures": return "/assessment/$id/measures";
    case "share": return "/assessment/$id/share";
  }
}
