import { useEffect, useRef, useState } from "react";
import { ImageIcon } from "lucide-react";
import { SCREENSHOTS } from "./landing-data";
import { SectionHeading } from "./sections";

/**
 * Mac-style browser chrome around a screenshot. Falls back to a labelled
 * placeholder when the PNG isn't in public/shots/ yet, so the page never
 * shows a broken-image icon while captures are still being collected.
 */
export function BrowserFrame({
  src, alt, className = "", priority = false,
}: { src: string; alt: string; className?: string; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`rounded-2xl border border-border/70 bg-card shadow-2xl shadow-primary/10 overflow-hidden ${className}`}>
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border/60 bg-muted/50">
        <span className="h-2.5 w-2.5 rounded-full bg-destructive/50" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-success/50" />
        <span className="ml-3 truncate text-[10px] text-muted-foreground">안전데스크</span>
      </div>
      {failed ? (
        <div className="aspect-[16/10] flex flex-col items-center justify-center gap-2 bg-muted/30 text-muted-foreground">
          <ImageIcon className="h-7 w-7 opacity-50" />
          <span className="text-xs px-6 text-center">{alt}</span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          onError={() => setFailed(true)}
          className="w-full block"
        />
      )}
    </div>
  );
}

/** 자동 전환 간격. 진행 표시줄 애니메이션도 이 값을 따라간다. */
const AUTOPLAY_MS = 3000;

export function ScreenshotsSection() {
  const [active, setActive] = useState<string>(SCREENSHOTS[0].id);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(false);
  // 직접 눌렀을 때 타이머를 처음부터 다시 돌리기 위한 값
  const [restart, setRestart] = useState(0);
  const sectionRef = useRef<HTMLElement | null>(null);
  const shot = SCREENSHOTS.find((s) => s.id === active) ?? SCREENSHOTS[0];

  // 화면 밖에 있을 때는 돌리지 않는다. 보이지도 않는 사이에 6장이 다 지나가면
  // 정작 스크롤해서 왔을 때 어디쯤인지 알 수 없다.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (paused || !inView) return;
    // 화면 움직임에 민감한 사용자는 자동 전환을 끈다
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const timer = setInterval(() => {
      setActive((cur) => {
        const i = SCREENSHOTS.findIndex((s) => s.id === cur);
        return SCREENSHOTS[(i + 1) % SCREENSHOTS.length].id;
      });
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [paused, inView, restart]);

  const select = (id: string) => {
    setActive(id);
    setRestart((n) => n + 1); // 방금 고른 화면에 온전히 5초를 준다
  };

  const autoplaying = inView && !paused;

  return (
    <section ref={sectionRef} className="border-y border-border/60 bg-muted/30">
      {/* 진행 표시줄용. 활성 탭이 바뀔 때마다 remount 되어 애니메이션이 처음부터 다시 돈다. */}
      <style>{`
        @keyframes shot-progress { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @media (prefers-reduced-motion: reduce) { .shot-progress { animation: none !important; } }
      `}</style>

      <div
        className="max-w-6xl mx-auto px-4 py-16 md:py-24"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        <SectionHeading
          eyebrow="실제 화면"
          title="말보다 화면을 보시는 게 빠릅니다"
          sub="아래는 실제 안전데스크 화면입니다. 샘플 단지 데이터로 채워 두었습니다."
        />

        {/* 탭 — 모바일에서는 가로 스크롤 */}
        <div className="-mx-4 px-4 mb-6 overflow-x-auto">
          <div className="flex gap-2 w-max mx-auto">
            {SCREENSHOTS.map((s) => {
              const on = s.id === active;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => select(s.id)}
                  aria-pressed={on}
                  className={`relative overflow-hidden whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    on
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-card border border-border/70 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.tab}
                  {on && autoplaying && (
                    <span
                      key={`${active}-${restart}`}
                      aria-hidden
                      className="shot-progress absolute inset-x-0 bottom-0 h-0.5 origin-left bg-primary-foreground/50"
                      style={{ animation: `shot-progress ${AUTOPLAY_MS}ms linear forwards` }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid lg:grid-cols-[1.6fr_1fr] gap-8 items-center">
          <BrowserFrame src={shot.src} alt={shot.title} />
          <div className="space-y-3">
            <h3 className="text-xl md:text-2xl font-bold tracking-tight">{shot.title}</h3>
            <p className="text-muted-foreground leading-relaxed">{shot.desc}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
