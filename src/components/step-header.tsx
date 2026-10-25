import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { ASSESSMENT_STEPS, stepRoute, type AssessmentStepKey } from "@/lib/assessment-steps";
import { MethodTerm } from "@/components/term";
import { cn } from "@/lib/utils";

/**
 * 평가 작성 화면 공통 머리글.
 *   평가 작성 3/5 · 위험성 결정            ← 범위 이름 + 번호 + 단계명 (새 평가 마법사의 1/5 와 헷갈리지 않게 범위 명시)
 *   [1 사전준비] [2 위험요인] [3 결정] …    ← 지난 단계는 링크, 다음 단계는 흐리게
 *   지금 할 일: 미평가 2건의 등급을 선택하세요   ← 한 문장
 */
export function StepHeader({
  current,
  assessmentId,
  title,
  workName,
  method,
  todo,
  className,
}: {
  current: AssessmentStepKey;
  assessmentId: string;
  /** h1 로 쓸 화면 이름 (기본: 단계명) */
  title?: string;
  workName?: string | null;
  method?: string | null;
  /** "지금 할 일" 한 문장. 비우면 표시하지 않음 */
  todo?: string | null;
  className?: string;
}) {
  const idx = ASSESSMENT_STEPS.findIndex((s) => s.key === current);
  const cur = ASSESSMENT_STEPS[idx];
  const next = ASSESSMENT_STEPS[idx + 1];

  return (
    <header className={cn("space-y-3", className)}>
      <div>
        <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-2">
          <span className="font-semibold text-primary">평가 작성 {cur.n}/{ASSESSMENT_STEPS.length}</span>
          {workName && <span>· {workName}</span>}
          {method && <span>· <MethodTerm method={method} compact /></span>}
        </div>
        <h1 className="text-2xl font-bold mt-1">{title ?? cur.label}</h1>
      </div>

      <ol className="flex gap-1" aria-label="평가 작성 단계">
        {ASSESSMENT_STEPS.map((s, i) => {
          const done = i < idx;
          const active = i === idx;
          const inner = (
            <>
              <span
                className={cn(
                  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                  active ? "bg-primary text-primary-foreground" : done ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="h-4 w-4" /> : s.n}
              </span>
              <span className={cn("hidden sm:inline text-sm truncate", active ? "font-semibold" : "text-muted-foreground")}>{s.short}</span>
            </>
          );
          const cls = cn(
            "flex-1 min-w-0 flex items-center gap-1.5 rounded-md px-1.5 py-1.5 border-b-4",
            active ? "border-primary" : done ? "border-success/60" : "border-muted",
          );
          return (
            <li key={s.key} className="flex-1 min-w-0" aria-current={active ? "step" : undefined}>
              {done ? (
                <Link to={stepRoute(s.key) as any} params={{ id: assessmentId } as any} search={{} as any} className={cn(cls, "hover:bg-muted/50")} title={`${s.n}단계 ${s.label}로 돌아가기`}>
                  {inner}
                </Link>
              ) : (
                <div className={cls}>{inner}</div>
              )}
            </li>
          );
        })}
      </ol>

      {(todo || next) && (
        <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-base flex flex-wrap items-center gap-x-3 gap-y-1">
          {todo && <span><span className="font-semibold text-primary">지금 할 일:</span> {todo}</span>}
          {next && <span className="text-sm text-muted-foreground">다음 단계: {next.label}</span>}
        </div>
      )}
    </header>
  );
}
