import { MessageSquareText } from "lucide-react";
import { KAKAO_CHANNEL_URL } from "@/lib/contact";

/**
 * 우하단 고정 문의 버튼.
 *
 * 처음에는 사이드바 하단에 링크로 뒀는데 아무도 못 찾았다. 관리소장이
 * 평가 작성 중에 막혔을 때 바로 눈에 들어와야 하므로, 모든 화면 위에
 * 띄우고 카카오 브랜드 노란색(#FEE500)을 그대로 써서 카톡임을 즉시 알아보게 한다.
 *
 * 모바일은 하단 탭바(약 64px)와 겹치지 않도록 위로 띄운다.
 * 인쇄물에는 나오면 안 되므로 print:hidden.
 */
export function SupportFab() {
  return (
    <a
      href={KAKAO_CHANNEL_URL}
      target="_blank"
      rel="noreferrer noopener"
      aria-label="카카오톡으로 문의하기"
      className="
        fixed right-4 bottom-24 md:right-6 md:bottom-6 z-50 print:hidden
        flex items-center gap-2 rounded-full
        bg-[#FEE500] text-[#191919]
        pl-4 pr-5 py-3 md:py-3.5
        shadow-lg shadow-black/20 ring-1 ring-black/5
        font-bold text-sm
        transition-transform hover:scale-105 active:scale-95
      "
    >
      <MessageSquareText className="h-5 w-5 shrink-0" />
      <span>문의하기</span>
    </a>
  );
}
