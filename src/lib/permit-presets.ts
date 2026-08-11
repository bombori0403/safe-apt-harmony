// 작업허가서(위험작업 허가) 아파트 특화 프리셋.
// 작업 유형을 고르면 착수 전 점검 체크리스트가 채워지고, 밀폐·화기는 가스측정이 필수.
// 근거: 산업안전보건기준에 관한 규칙(밀폐공간 산소·유해가스 측정 제619조 등, 화기작업,
// 추락방지, 정전작업 LOTO). 관리사무소 자체작업·용역작업 공통 사용.

export type PermitPreset = {
  type: string;
  gasRequired: boolean;
  examples: string;
  checklist: string[];
};

export const PERMIT_PRESETS: PermitPreset[] = [
  {
    type: "고소작업",
    gasRequired: false,
    examples: "옥상 방수, 외벽·간판, 전등 교체, 가지치기",
    checklist: [
      "안전모·안전대(안전고리) 착용",
      "사다리·작업발판 고정 및 상태 양호",
      "2인 1조 작업 및 하부 통제(출입금지)",
      "강풍·우천 등 기상 조건 확인",
      "고소작업대/로프 등 장비 점검 완료",
    ],
  },
  {
    type: "밀폐공간",
    gasRequired: true,
    examples: "저수조·정화조·집수정·맨홀 내부 작업",
    checklist: [
      "작업 전·중 산소 및 유해가스 농도 측정",
      "충분한 환기(송풍기) 실시",
      "외부 감시인 배치 및 연락체계 확보",
      "구조용 장비(안전벨트·구명줄·송기마스크) 비치",
      "출입 인원 대장 작성",
      "밀폐공간 경고 표지 게시",
    ],
  },
  {
    type: "화기작업",
    gasRequired: true,
    examples: "용접·용단·그라인더 등 불꽃 발생 작업",
    checklist: [
      "소화기·소화설비 비치",
      "주변 가연물 제거 또는 불연 덮개",
      "불티 비산방지막(방화포) 설치",
      "화기감시자 배치(작업 중·작업 후)",
      "작업 종료 후 30분 이상 잔불 확인",
      "가연성 가스 농도 측정",
    ],
  },
  {
    type: "전기작업",
    gasRequired: false,
    examples: "배전반·수배전 설비, 정전 작업",
    checklist: [
      "정전 후 검전기로 무전압 확인",
      "차단기 잠금·표지(LOTO) 조치",
      "절연장갑·절연화 등 보호구 착용",
      "우천·습윤 환경 작업 금지",
      "2인 이상 작업 및 감시",
    ],
  },
  {
    type: "중량물·양중",
    gasRequired: false,
    examples: "크레인·호이스트, 대형 설비 반입",
    checklist: [
      "양중 장비 점검 및 정격하중 확인",
      "유자격자 운전 및 신호수 배치",
      "하부·이동경로 출입통제",
      "결속(줄걸이) 상태 확인",
      "악천후 시 작업 중지 기준 확인",
    ],
  },
  {
    type: "기타",
    gasRequired: false,
    examples: "직접 항목을 구성",
    checklist: [
      "작업 위험요인 파악 및 대책 수립",
      "보호구 착용",
      "주변 통제 및 표지",
    ],
  },
];

export const GAS_FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "o2", label: "산소 O₂ (%)", hint: "적정 18~23.5%" },
  { key: "lel", label: "가연성가스 LEL (%)", hint: "10% 미만" },
  { key: "h2s", label: "황화수소 H₂S (ppm)", hint: "10ppm 미만" },
  { key: "co", label: "일산화탄소 CO (ppm)", hint: "30ppm 미만" },
];

// 가스측정은 회차 배열([{o2,lel,h2s,co,measuredAt,measuredBy}, ...])로 저장한다.
// 구버전은 단일 객체로 저장돼 있어, 읽을 때 항상 배열로 정규화한다(밀폐공간은 작업 전+주기적 4회 이상 권장).
export function toGasRows(gas: any): Record<string, string>[] {
  if (Array.isArray(gas)) return gas as Record<string, string>[];
  if (gas && typeof gas === "object" && Object.keys(gas).length) return [gas as Record<string, string>];
  return [];
}
// 한 회차가 모든 가스값을 채웠는지(승인·완료 검증용)
export function gasRowComplete(m: Record<string, string>): boolean {
  return GAS_FIELDS.every((f) => (m?.[f.key] ?? "").toString().trim() !== "");
}
