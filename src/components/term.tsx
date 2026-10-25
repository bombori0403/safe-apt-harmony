import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GLOSSARY, METHOD_GLOSS, type TermKey } from "@/lib/glossary";
import type { AssessmentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * 용어 + 한 줄 풀이를 **상시** 보여주고, ⓘ 를 누르면 자세한 설명을 띄운다.
 * (고령 사용자는 ⓘ 안에만 숨긴 풀이를 발견하지 못한다 — GPT UX 검토 중3)
 *
 *   <Term k="중대성" />            → 중대성(강도) — 났을 때 피해의 크기 ⓘ
 *   <Term k="중대성" compact />    → 중대성(강도) ⓘ   (풀이는 ⓘ 안에만; 표 머리글처럼 좁은 곳)
 */
export function Term({ k, compact, className }: { k: TermKey; compact?: boolean; className?: string }) {
  const t = GLOSSARY[k];
  return (
    <span className={cn("inline-flex items-baseline flex-wrap gap-x-1", className)}>
      <span className="font-medium">{t.label}</span>
      {!compact && <span className="text-muted-foreground">— {t.short}</span>}
      <InfoPop title={t.label} body={t.long} source={t.source} />
    </span>
  );
}

/** 평가방법 이름 + 풀이. 배지·헤더에서 사용. */
export function MethodTerm({ method, compact, className }: { method: AssessmentMethod | string; compact?: boolean; className?: string }) {
  const m = METHOD_GLOSS[method as AssessmentMethod];
  if (!m) return <span className={className}>{method}</span>;
  return (
    <span className={cn("inline-flex items-baseline flex-wrap gap-x-1", className)}>
      <span className="font-medium">{m.title}</span>
      {!compact && <span className="text-muted-foreground">({m.short})</span>}
      <InfoPop title={m.title} body={m.long} source={m.appOnly ? "이 앱의 자체 척도" : "고시 제7조 제5항 · 안전보건공단 설명"} />
    </span>
  );
}

function InfoPop({ title, body, source }: { title: string; body: string; source?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${title} 자세한 설명`}
          className="inline-flex items-center justify-center h-7 w-7 -my-1 rounded-full text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring align-middle"
        >
          <Info className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="max-w-sm text-base leading-relaxed space-y-2" side="top">
        <div className="font-semibold">{title}</div>
        <p>{body}</p>
        {source && <p className="text-sm text-muted-foreground">근거: {source}</p>}
      </PopoverContent>
    </Popover>
  );
}
