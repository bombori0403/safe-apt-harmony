// TBM(작업 전 안전미팅) 아파트 특화 프리셋.
// 미화·경비·시설 직원이 매일 수행하는 작업의 대표 유해위험요인·대책.

export type TbmHazardPreset = { hazard: string; measure: string };

export const TBM_HAZARD_PRESETS: TbmHazardPreset[] = [
  { hazard: "고소작업(전등·간판 교체) 중 추락", measure: "안전발판·사다리 고정, 2인 1조 작업" },
  { hazard: "바닥 물기·결빙으로 미끄러짐", measure: "미끄럼 주의 표지, 즉시 제거, 미끄럼방지 신발" },
  { hazard: "예초 작업 중 비산물·베임", measure: "보안경·안면보호구·정강이보호대 착용, 반경 내 접근금지" },
  { hazard: "지하 기계실·저수조 밀폐공간 질식", measure: "환기·산소농도 측정 후 진입, 감시인 배치" },
  { hazard: "제설 작업 중 낙상·근골격계", measure: "미끄럼방지 장화, 허리 보호, 교대 작업" },
  { hazard: "쓰레기·재활용 수거 중 베임·감염", measure: "장갑 착용, 날카로운 물건 주의, 손 위생" },
  { hazard: "전기 작업 중 감전", measure: "차단기 차단·검전 확인, 절연장갑 착용" },
  { hazard: "중량물 운반 중 협착·요통", measure: "운반구 사용, 2인 이상 분담, 올바른 자세" },
  { hazard: "차량 이동 구역 작업 중 충돌", measure: "안전조끼 착용, 라바콘·유도 표지 설치" },
  { hazard: "폭염·한파 중 온열·한랭 질환", measure: "그늘·휴식 확보, 수분 섭취, 작업시간 조정" },
];

export const HEALTH_CHECKS: { key: "fever" | "alcohol" | "drug" | "ppe"; label: string; badWhenTrue: boolean }[] = [
  { key: "fever", label: "발열/컨디션 이상", badWhenTrue: true },
  { key: "alcohol", label: "음주 상태", badWhenTrue: true },
  { key: "drug", label: "졸음 유발 약물 복용", badWhenTrue: true },
  { key: "ppe", label: "보호구 착용", badWhenTrue: false },
];

export const ATTENDEE_ROLES = ["미화", "경비", "시설", "관리", "기타"];
