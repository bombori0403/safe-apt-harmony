/**
 * 우하단 문의 버튼(SupportFab) 위에서 좌우로 왔다갔다 하는 마스코트 비버.
 *
 * 순수 장식이라 pointer-events-none + aria-hidden으로 둔다. 문의 버튼과 겹치는
 * 자리이므로 클릭을 가로채면 안 되고, 스크린리더가 읽을 내용도 없다.
 * z-40 — 문의 버튼(z-50)보다 뒤에 깔려야 버튼이 항상 위로 보인다.
 *
 * transform이 서로 덮어쓰지 않도록 걷기(translateX) · 통통(translateY) · 방향전환
 * (scaleX)을 각각 다른 엘리먼트에 나눠 건다. 한 엘리먼트에 몰면 마지막 애니메이션만
 * 적용된다.
 *
 * 관리소장이 하루 종일 켜두는 화면이라 움직임은 느리고 작게. 멀미·산만함을 호소하는
 * 사용자를 위해 prefers-reduced-motion이면 정지한 채 서 있기만 한다(styles.css).
 */
export function MascotBuddy() {
  return (
    <div
      aria-hidden="true"
      className="
        pointer-events-none select-none print:hidden
        fixed z-40 right-4 md:right-6
        bottom-[9.5rem] md:bottom-[5.25rem]
      "
    >
      <span className="mascot-walk block">
        <span className="mascot-bob block">
          <img
            src="/logo-mark.png"
            alt=""
            draggable={false}
            className="mascot-face block h-11 w-11 md:h-12 md:w-12 rounded-full drop-shadow-md"
          />
        </span>
      </span>
    </div>
  );
}
