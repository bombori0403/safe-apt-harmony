import { useEffect, useState } from "react";
import { RELATED_APPS } from "@/lib/related-apps";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, X, Sparkles } from "lucide-react";

/**
 * 설치된 PWA(홈화면 단독 실행)에서 바깥 링크를 새 탭(_blank)으로 열면
 * 안드로이드가 크롬 커스텀탭을 요구해, 크롬이 없는 폰에선 "크롬 설치" 안내만 뜨고 안 열린다.
 * 이미 정상 동작 중인 현재 창에서 이동시키면 별도 브라우저 없이 그대로 열린다(뒤로가기로 복귀).
 * 일반 브라우저에선 기본 동작(새 탭) 유지.
 */
function openExternal(e: { preventDefault(): void; currentTarget: HTMLAnchorElement }) {
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (standalone) {
    e.preventDefault();
    window.location.href = e.currentTarget.href;
  }
}

/**
 * "함께 쓰면 좋은 도구" — 관련 업무 앱 크로스링크. url 있는 항목만 노출, 새 탭.
 * variant="card": 넓은 카드(대시보드 등). variant="sidebar": 사이드바 하단 광고형(어두운 톤 컴팩트).
 */
export function RelatedApps({ variant = "card" }: { variant?: "card" | "sidebar" | "topbar" | "float" }) {
  const apps = RELATED_APPS.filter((a) => a.url);
  if (apps.length === 0) return null;

  if (variant === "float") return <FloatPromo apps={apps} />;

  if (variant === "topbar") {
    return (
      <div className="relative overflow-hidden flex flex-wrap items-center gap-2 justify-end px-4 py-1.5 bg-gradient-to-r from-primary/10 via-transparent to-primary/10">
        <div aria-hidden className="promo-shimmer pointer-events-none absolute inset-y-0 -left-1/3 w-1/4 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        <span className="relative hidden sm:flex items-center gap-1 text-[11px] font-bold text-primary mr-0.5">
          <Sparkles className="h-3.5 w-3.5" />함께 쓰는 도구
        </span>
        {apps.map((a) => (
          <a key={a.name} href={a.url} target="_blank" rel="noreferrer noopener" onClick={openExternal}
            className="promo-card relative inline-flex items-center gap-2 rounded-lg border-2 border-primary/50 bg-primary/10 pl-2.5 pr-3 py-1 hover:bg-primary/20 transition-colors">
            <span className="promo-emoji text-base leading-none shrink-0">{a.emoji}</span>
            <span className="text-left leading-tight min-w-0">
              <span className="block text-[12px] font-semibold text-primary truncate">{a.name}</span>
              <span className="block text-[10px] text-muted-foreground truncate">{a.desc}</span>
            </span>
            <ExternalLink className="h-3.5 w-3.5 text-primary/70 shrink-0" />
          </a>
        ))}
        <span className="relative text-[9px] px-1.5 py-px rounded-full bg-primary text-white font-bold">AD</span>
      </div>
    );
  }

  if (variant === "sidebar") {
    return (
      <div className="promo-card relative m-2 overflow-hidden rounded-xl p-2 bg-gradient-to-br from-primary/25 via-sidebar-accent/50 to-primary/10">
        {/* 빛 스침 효과 */}
        <div aria-hidden className="promo-shimmer pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        <div className="relative flex items-center justify-between px-1 pb-1.5">
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/70">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />함께 쓰는 도구
          </span>
          <span className="text-[9px] px-1.5 py-px rounded-full bg-primary/80 text-white font-semibold">AD</span>
        </div>
        <div className="relative space-y-0.5">
          {apps.map((a) => (
            <a key={a.name} href={a.url} target="_blank" rel="noreferrer noopener" onClick={openExternal}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/10 text-sidebar-foreground/90 transition-colors">
              <span className="promo-emoji text-lg leading-none shrink-0">{a.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold truncate">{a.name}</span>
                <span className="block text-[10px] text-sidebar-foreground/55 truncate">{a.desc}</span>
              </span>
              <ExternalLink className="h-3 w-3 opacity-50 shrink-0" />
            </a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">함께 쓰면 좋은 시설·안전 도구</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {apps.map((a) => (
          <a key={a.name} href={a.url} target="_blank" rel="noreferrer noopener" onClick={openExternal} className="block">
            <Card className="hover:border-primary/50 transition-colors">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="text-2xl leading-none shrink-0">{a.emoji}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm">{a.name}</span>
                    {a.tag && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{a.tag}</span>}
                    <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{a.desc}</p>
                </div>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
}

/** 우측 상단 고정 광고 카드. 어두운 카드+애니메이션으로 밝은 본문 위에서 눈에 띔. 접기(X) 기억. */
function FloatPromo({ apps }: { apps: typeof RELATED_APPS }) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try { setCollapsed(localStorage.getItem("rl_promo_collapsed") === "1"); } catch { /* ignore */ }
  }, []);
  function setC(v: boolean) {
    setCollapsed(v);
    try { localStorage.setItem("rl_promo_collapsed", v ? "1" : "0"); } catch { /* ignore */ }
  }

  if (collapsed) {
    return (
      <button type="button" onClick={() => setC(false)}
        className="promo-card fixed top-3 right-3 z-40 inline-flex items-center gap-1.5 rounded-full bg-sidebar text-sidebar-foreground px-3 py-2 text-xs font-semibold shadow-lg ring-1 ring-primary/50">
        <Sparkles className="promo-emoji h-3.5 w-3.5 text-primary" />함께 쓰는 도구
      </button>
    );
  }

  return (
    <div className="promo-card fixed top-3 right-3 z-40 w-56 overflow-hidden rounded-xl bg-sidebar text-sidebar-foreground shadow-xl ring-1 ring-primary/50">
      <div aria-hidden className="promo-shimmer pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <div className="relative flex items-center justify-between px-3 pt-2 pb-1">
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/70">
          <Sparkles className="h-3 w-3 text-primary" />함께 쓰는 도구
        </span>
        <div className="flex items-center gap-1">
          <span className="text-[9px] px-1.5 py-px rounded-full bg-primary/80 text-white font-semibold">AD</span>
          <button type="button" onClick={() => setC(true)} aria-label="접기" className="text-sidebar-foreground/50 hover:text-sidebar-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="relative space-y-0.5 p-1.5 pt-0">
        {apps.map((a) => (
          <a key={a.name} href={a.url} target="_blank" rel="noreferrer noopener" onClick={openExternal}
            className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-white/10 text-sidebar-foreground/90 transition-colors">
            <span className="promo-emoji text-lg leading-none shrink-0">{a.emoji}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold truncate">{a.name}</span>
              <span className="block text-[10px] text-sidebar-foreground/55 truncate">{a.desc}</span>
            </span>
            <ExternalLink className="h-3 w-3 opacity-50 shrink-0" />
          </a>
        ))}
      </div>
    </div>
  );
}
