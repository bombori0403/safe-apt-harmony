import { AlertCircle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 저장 상태를 "지속 표시"하는 띠. 1.5초 토스트가 아니라 폼 상단에 계속 붙어 있어
 * 고령 사용자가 "지금 내 입력이 어디에 있는가"를 언제든 확인할 수 있게 한다.
 *
 * 세 가지를 구분한다 (법령 검토·UX 검토 공통 지적):
 *   draft  — 이 기기에 임시 저장됨 (localStorage, 공식 기록 아님)
 *   saved  — 서버에 저장됨 (공식 기록)
 *   error  — 저장 실패 (재시도 버튼)
 */
export type SaveState = "idle" | "draft" | "saving" | "saved" | "error";

function hhmm(d: Date | null | undefined) {
  if (!d) return "";
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

export function SaveStatus({
  state,
  savedAt,
  draftAt,
  errorText,
  onRetry,
  className,
}: {
  state: SaveState;
  /** 서버 저장 시각 */
  savedAt?: Date | null;
  /** 기기 임시 저장 시각 */
  draftAt?: Date | null;
  errorText?: string;
  onRetry?: () => void;
  className?: string;
}) {
  if (state === "idle") return null;

  const base = "flex items-center gap-2 rounded-md px-3 py-2 text-sm";
  if (state === "saving") {
    return (
      <div role="status" aria-live="polite" className={cn(base, "bg-muted text-muted-foreground", className)}>
        <Loader2 className="h-5 w-5 animate-spin shrink-0" />
        저장 중…
      </div>
    );
  }
  if (state === "saved") {
    return (
      <div role="status" aria-live="polite" className={cn(base, "bg-success/10 text-success", className)}>
        <CheckCircle2 className="h-5 w-5 shrink-0" />
        서버에 저장됨{savedAt ? ` · ${hhmm(savedAt)}` : ""}
      </div>
    );
  }
  if (state === "error") {
    return (
      <div role="alert" className={cn(base, "bg-destructive/10 text-destructive", className)}>
        <AlertCircle className="h-5 w-5 shrink-0" />
        <span className="flex-1">{errorText || "저장하지 못했습니다. 입력은 이 기기에 남아 있습니다."}</span>
        {onRetry && (
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            다시 시도
          </Button>
        )}
      </div>
    );
  }
  // draft
  return (
    <div role="status" aria-live="polite" className={cn(base, "bg-muted text-muted-foreground", className)}>
      <Clock className="h-5 w-5 shrink-0" />
      이 기기에 임시 저장됨{draftAt ? ` · ${hhmm(draftAt)}` : ""} (아직 서버에는 저장되지 않음)
    </div>
  );
}

/**
 * 이전에 쓰다 만 내용이 있을 때 맨 위에 띄우는 배너.
 * "이어서 쓰기 / 새로 쓰기" 두 버튼뿐 — 결정 하나.
 */
export function DraftBanner({
  at,
  onResume,
  onDiscard,
  className,
}: {
  at?: Date | null;
  onResume: () => void;
  onDiscard: () => void;
  className?: string;
}) {
  return (
    <div
      role="region"
      aria-label="작성 중이던 내용"
      className={cn(
        "rounded-lg border border-primary/40 bg-primary/5 p-4 space-y-3",
        className,
      )}
    >
      <p className="text-base font-medium">
        작성 중이던 내용이 있습니다{at ? ` (${hhmm(at)} 저장)` : ""}.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <Button type="button" onClick={onResume} className="flex-1">
          이어서 쓰기
        </Button>
        <Button type="button" variant="outline" onClick={onDiscard} className="flex-1">
          새로 쓰기
        </Button>
      </div>
    </div>
  );
}
