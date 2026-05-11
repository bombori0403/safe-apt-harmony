/**
 * 작업명 → 평가방법 자동 추천 매핑
 */
import type { AssessmentMethod } from "./types";

const map: Array<{ kw: string; method: AssessmentMethod }> = [
  { kw: "승강기", method: "체크리스트" },
  { kw: "소방", method: "체크리스트" },
  { kw: "전기설비", method: "체크리스트" },
  { kw: "정기검사", method: "체크리스트" },
  { kw: "놀이시설", method: "체크리스트" },
  { kw: "기계실", method: "3단계" },
  { kw: "청소", method: "3단계" },
  { kw: "미화", method: "3단계" },
  { kw: "일상", method: "3단계" },
  { kw: "방수", method: "OPS" },
  { kw: "외주", method: "OPS" },
  { kw: "단발", method: "OPS" },
  { kw: "변전실", method: "빈도강도" },
  { kw: "정밀", method: "빈도강도" },
  { kw: "외벽 보수", method: "빈도강도" },
  { kw: "보수공사", method: "빈도강도" },
  { kw: "신규", method: "빈도강도" },
];

export function recommendMethod(workName: string): AssessmentMethod {
  for (const { kw, method } of map) if (workName.includes(kw)) return method;
  return "5단계";
}

export const METHOD_INFO: Record<AssessmentMethod, { title: string; desc: string; usecase: string; icon: string }> = {
  "3단계": { title: "위험성 수준 3단계 판단법", desc: "상·중·하 또는 저·중·고로 직관적으로 구분", usecase: "자가관리 단지, 소규모, 일상 작업", icon: "🟢🟡🔴" },
  "5단계": { title: "위험성 수준 5단계 판단법", desc: "매우낮음~매우높음 5단계로 세분", usecase: "위탁관리 단지, 정기평가", icon: "▮▮▮▮▮" },
  "빈도강도": { title: "빈도·강도법 (KRAS 호환)", desc: "가능성 × 중대성 5×5 정량 점수", usecase: "본사 통합 관리, 단지간 비교", icon: "▦" },
  "체크리스트": { title: "체크리스트법", desc: "사전 작성 목록에 ○/× 표시", usecase: "승강기·소방·전기 정기 시설점검", icon: "✅" },
  "OPS": { title: "핵심요인 기술법 (OPS)", desc: "단계별 핵심 질문에 답변", usecase: "외주업체 단발, 1개월 미만 작업", icon: "📋" },
};
