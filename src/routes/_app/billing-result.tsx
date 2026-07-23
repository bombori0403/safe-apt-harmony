import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { confirmPaymentAndActivate } from "@/lib/payments.functions";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle } from "lucide-react";

// 결제 결과 처리(독립 라우트 — /billing 아래에 중첩되지 않도록 분리).
// 토스 successUrl/failUrl이 모두 여기로 온다. paymentKey가 있으면 승인, code가 있으면 실패.
export const Route = createFileRoute("/_app/billing-result")({
  validateSearch: (s: Record<string, unknown>): {
    paymentKey?: string; orderId?: string; amount?: number; code?: string; message?: string;
  } => ({
    paymentKey: typeof s.paymentKey === "string" ? s.paymentKey : undefined,
    orderId: typeof s.orderId === "string" ? s.orderId : undefined,
    amount: s.amount != null ? Number(s.amount) : undefined,
    code: typeof s.code === "string" ? s.code : undefined,
    message: typeof s.message === "string" ? s.message : undefined,
  }),
  component: BillingResult,
});

function BillingResult() {
  const { paymentKey, orderId, amount, code, message } = Route.useSearch();
  const nav = useNavigate();
  const confirm = useServerFn(confirmPaymentAndActivate);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      // 토스가 failUrl로 보낸 실패 — code/message가 실제 원인
      if (code || message) {
        setError(`토스 결제 실패 — 코드: ${code ?? "?"} / ${message ?? "메시지 없음"}`);
        return;
      }
      if (!paymentKey || !orderId || amount == null) {
        setError("결제 정보가 올바르지 않습니다.");
        return;
      }
      try {
        const r = await confirm({ data: { paymentKey, orderId, amount } });
        if (!(r as { ok?: boolean }).ok) {
          setError("결제 승인에 실패했습니다.");
          return;
        }
        setDone(true);
        setTimeout(() => nav({ to: "/dashboard" }), 1800);
      } catch (e) {
        setError(e instanceof Error ? e.message : "결제 승인 중 오류가 발생했습니다.");
      }
    })();
  }, [paymentKey, orderId, amount, code, message, nav, confirm]);

  if (error) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-4 py-16">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold">결제 처리에 문제가 있었습니다</h1>
        <p className="text-sm text-muted-foreground leading-relaxed break-keep">{error}</p>
        <p className="text-xs text-muted-foreground">
          결제가 완료됐는데 활성화가 안 됐다면 카카오톡 채널로 문의해 주세요. 중복 청구되지 않습니다.
        </p>
        <div className="flex justify-center gap-2">
          <Link to="/billing"><Button variant="outline">결제 다시 시도</Button></Link>
          <Link to="/dashboard"><Button>대시보드로</Button></Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-4 py-16">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-success/10 text-success">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold">결제가 완료되었습니다</h1>
        <p className="text-sm text-muted-foreground">정식 사용으로 전환되었습니다. 대시보드로 이동합니다…</p>
        <Link to="/dashboard"><Button>대시보드로</Button></Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
      <p className="text-sm text-muted-foreground">결제를 확인하는 중…</p>
    </div>
  );
}
