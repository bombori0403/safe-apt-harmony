// 안전보건교육 아파트 특화 프리셋. 유형을 고르면 법적 근거와 표준 내용이 안내된다.
// 근거: 산업안전보건법 제29조 및 시행규칙 별표(교육시간). 실제 시간은 업종·직종에 따라
// 다르므로 안내는 참고용이며, 화면에 "정확성은 담당자 확인 필요"로 고지한다.

export type EducationPreset = {
  category: string;
  legalBasis: string;
  guide: string;
  defaultMinutes: number;
};

export const EDUCATION_PRESETS: EducationPreset[] = [
  {
    category: "정기",
    legalBasis: "산업안전보건법 제29조 제1항 (근로자 정기 안전보건교육)",
    guide: "사무직 외 근로자 매반기 6시간 이상(관리감독자 연 16시간). 경비·미화 등 현장 근로자 대상 정기 실시.",
    defaultMinutes: 360,
  },
  {
    category: "채용시",
    legalBasis: "산업안전보건법 제29조 제2항 (채용 시 교육)",
    guide: "신규 채용 근로자에게 배치 전 실시. 일반 8시간(단시간·기간제 등은 별도 기준).",
    defaultMinutes: 480,
  },
  {
    category: "작업내용변경시",
    legalBasis: "산업안전보건법 제29조 제2항 (작업내용 변경 시 교육)",
    guide: "작업내용이 바뀔 때 실시. 일반 2시간 이상.",
    defaultMinutes: 120,
  },
  {
    category: "특별",
    legalBasis: "산업안전보건법 제29조 제3항 (특별교육)",
    guide: "밀폐공간·고소작업 등 위험작업 종사 근로자 대상. 16시간(단기간 작업은 2시간).",
    defaultMinutes: 120,
  },
  {
    category: "기타",
    legalBasis: "자체 교육(법정 외)",
    guide: "관리주체 자체 안전교육·간담회 등.",
    defaultMinutes: 60,
  },
];

export const EDU_METHODS = ["집합", "온라인", "외부"] as const;
