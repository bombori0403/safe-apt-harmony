import { useState } from "react";
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

export function ScreenshotsSection() {
  const [active, setActive] = useState<string>(SCREENSHOTS[0].id);
  const shot = SCREENSHOTS.find((s) => s.id === active) ?? SCREENSHOTS[0];

  return (
    <section className="border-y border-border/60 bg-muted/30">
      <div className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        <SectionHeading
          eyebrow="실제 화면"
          title="말보다 화면을 보시는 게 빠릅니다"
          sub="아래는 실제 안전데스크 화면입니다. 샘플 단지 데이터로 채워 두었습니다."
        />

        {/* 탭 — 모바일에서는 가로 스크롤 */}
        <div className="-mx-4 px-4 mb-6 overflow-x-auto">
          <div className="flex gap-2 w-max mx-auto">
            {SCREENSHOTS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActive(s.id)}
                aria-pressed={s.id === active}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  s.id === active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-card border border-border/70 text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.tab}
              </button>
            ))}
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
