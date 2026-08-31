// 법령 개정 공지. 법이 바뀌면 여기에 한 줄 추가하면 대시보드에 배너로 뜬다.
// (자동 감지는 하지 않음 — 사장님이 알려주면 매핑 수정 + 여기 추가 + 배포)
export interface LawNotice { id: string; date: string; from: string; to: string; note?: string }

export const LAW_NOTICES: LawNotice[] = [
  // 예시(실제 개정 생기면 주석 풀고 채우기):
  // { id: "2026-rule32", date: "2026-01-02", from: "산업안전보건기준에 관한 규칙 제32조", to: "제34조", note: "보호구 지급 조항 이동" },
];
