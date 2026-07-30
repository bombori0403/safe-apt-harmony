// 공동주택(아파트) 공용시설 안전점검 체크리스트 프리셋.
// 스마플의 "샘플 라이브러리"에 대응하되, 제조업 공정이 아니라 아파트 관리사무소가
// 실제로 점검하는 공용시설 항목으로 구성했다. 관리소장이 빈 화면에서 항목을
// 직접 타이핑하지 않도록 카테고리를 고르면 표준 항목이 채워진다.
// 근거: 공동주택관리법 시행규칙(안전점검) + 승강기/소방/전기/저수조 관련 개별법.

export type InspectionPreset = {
  category: string;
  cycle: string; // 권장 주기(안내용)
  items: string[];
};

export const INSPECTION_PRESETS: InspectionPreset[] = [
  {
    category: "승강기",
    cycle: "월 1회",
    items: [
      "운행 중 이상 소음·진동 여부",
      "비상통화장치(인터폰) 정상 작동",
      "출입문 개폐 정상 동작",
      "카 내부 조명·환기 정상",
      "안전검사 합격증·점검표 게시 상태",
      "기계실 출입통제 및 정리정돈",
    ],
  },
  {
    category: "소방시설",
    cycle: "월 1회",
    items: [
      "소화기 압력게이지 정상·비치 위치 확인",
      "옥내소화전 개폐 및 호스 상태",
      "유도등·비상조명 점등 상태",
      "방화문 폐쇄 상태(고임목 등 개방 방치 없음)",
      "비상구·피난통로 적치물 없음",
      "자동화재탐지설비 수신기 정상 표시",
    ],
  },
  {
    category: "전기실·기계실",
    cycle: "월 1회",
    items: [
      "누전차단기 동작 시험",
      "배전반 주변 적치물·가연물 없음",
      "절연장갑 등 보호구 비치·상태",
      "출입통제 및 관계자 외 출입금지 표지",
      "환기 상태 및 누수·결로 여부",
      "비상연락처 게시",
    ],
  },
  {
    category: "저수조",
    cycle: "반기 1회 + 연 2회 청소",
    items: [
      "맨홀 잠금장치 상태(무단 개방 방지)",
      "주변 오염원·해충 유입 차단",
      "저수조 외관 균열·누수 여부",
      "사다리·안전난간 견고성",
      "밀폐공간 경고 표지 부착",
      "수질 육안 확인(이물질·이취)",
    ],
  },
  {
    category: "놀이터",
    cycle: "분기 1회",
    items: [
      "기구 유격·파손·볼트 풀림 여부",
      "바닥 충격흡수재 상태",
      "모서리·돌출부 마감 상태",
      "이물질·위생(동물 배설물 등) 상태",
      "안전점검표·이용수칙 게시",
    ],
  },
  {
    category: "지하주차장",
    cycle: "월 1회",
    items: [
      "조명 조도 및 점등 상태",
      "바닥 미끄럼·결빙·누수 여부",
      "소화기·소화전 비치 상태",
      "진입로 높이제한·유도 표지",
      "CCTV·비상벨 작동 여부",
    ],
  },
  {
    category: "옥상·외벽",
    cycle: "분기 1회",
    items: [
      "옥상 난간 견고성·부식 여부",
      "옥상 출입문 잠금 상태",
      "배수구·우수관 막힘 여부",
      "외벽 균열·마감재 탈락 여부",
      "피뢰설비 외관 상태",
    ],
  },
  {
    category: "공용부(계단·복도)",
    cycle: "월 1회",
    items: [
      "바닥 미끄럼·파손 여부",
      "조명 점등 및 조도",
      "계단·복도 적치물 없음",
      "난간·손잡이 견고성",
      "결로·누수·곰팡이 여부",
    ],
  },
  {
    category: "제설·수목(계절)",
    cycle: "수시",
    items: [
      "제설제·장비 비치 및 상태",
      "빙판 위험구간 표지·조치",
      "고사목·처진 가지 위험 여부",
      "예초 작업 보호구 비치",
    ],
  },
];

export const INSPECTION_TYPES = ["정기", "수시", "일일", "순회", "직접"] as const;

export const RECURRENCE_OPTIONS: { value: string; label: string }[] = [
  { value: "none", label: "반복 안 함(1회성)" },
  { value: "weekly", label: "매주" },
  { value: "monthly", label: "매월" },
  { value: "quarterly", label: "매분기" },
  { value: "yearly", label: "매년" },
];

// 반복 주기 → 다음 예정일 계산
export function nextScheduledDate(from: Date, recurrence: string): Date | null {
  const d = new Date(from);
  switch (recurrence) {
    case "weekly": d.setDate(d.getDate() + 7); return d;
    case "monthly": d.setMonth(d.getMonth() + 1); return d;
    case "quarterly": d.setMonth(d.getMonth() + 3); return d;
    case "yearly": d.setFullYear(d.getFullYear() + 1); return d;
    default: return null;
  }
}
