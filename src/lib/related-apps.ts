// 리스크로그에서 소개하는 관련 업무 도구(크로스링크). 여기만 수정하면 화면에 반영.
// url이 비어 있으면 카드가 노출되지 않는다(주소 확정 전 자리만 잡아둠).
export type RelatedApp = {
  name: string;
  desc: string;
  url: string;       // 웹 주소(없으면 숨김). 데스크톱 앱은 다운로드/소개 페이지 주소.
  emoji: string;
  tag?: string;      // 예: "웹앱", "데스크톱 앱"
};

export const RELATED_APPS: RelatedApp[] = [
  {
    name: "장비이력카드",
    desc: "장비 이력·점검주기·QR 관리",
    url: "https://equipment-history.pages.dev/#/app",
    emoji: "🗂️",
    tag: "웹앱",
  },
  {
    name: "블러웍스",
    desc: "CCTV 얼굴·번호판 모자이크",
    url: "https://blurworks.vercel.app/",
    emoji: "🎞️",
    tag: "웹",
  },
];
