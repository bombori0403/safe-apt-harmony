import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createPaymentOrder } from "@/lib/payments.functions";
import { formatKRW } from "@/lib/pricing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Building, ShieldCheck, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_app/billing")({ component: Billing });

interface OrderLine { label: string; households: number; tierLabel: string; unit: number }
interface Order { orderId: string; amount: number; lines: OrderLine[]; orgName: string }

function tossClientKey(): string | undefined {
  return import.meta.env.VITE_TOSS_CLIENT_KEY as string | undefined;
}

function Billing() {
  const makeOrder = useServerFn(createPaymentOrder);
  const [order, setOrder] = useState<Order | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [payErr, setPayErr] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const widgetsRef = useRef<unknown>(null);
  const clientKey = tossClientKey();

  // 1) 서버에서 금액 계산 + 주문 생성
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const o = await makeOrder({ data: { cycle: "annual" } });
        if (!cancelled) setOrder(o as Order);
      } catch (e) {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : "주문 생성 실패");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 2) 토스 결제위젯 초기화 (클라 키 + 주문이 있을 때만)
  useEffect(() => {
    if (!clientKey || !order) return;
    let cancelled = false;
    (async () => {
      try {
        const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
        const toss = await loadTossPayments(clientKey);
        const widgets = toss.widgets({ customerKey: `org_${order.orderId}` });
        await widgets.setAmount({ currency: "KRW", value: order.amount });
        if (cancelled) return;
        await Promise.all([
          widgets.renderPaymentMethods({ selector: "#payment-method", variantKey: "DEFAULT" }),
          widgets.renderAgreement({ selector: "#agreement" }),
        ]);
        widgetsRef.current = widgets;
        if (!cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) setPayErr(e instanceof Error ? e.message : "결제창 초기화 실패");
      }
    })();
    return () => { cancelled = true; };
  }, [clientKey, order]);

  async function pay() {
    setPayErr(null);
    const widgets = widgetsRef.current as { requestPayment: (o: Record<string, unknown>) => Promise<void> } | null;
    if (!widgets || !order) return;
    const origin = window.location.origin;
    try {
      await widgets.requestPayment({
        orderId: order.orderId,
        orderName: `안전데스크 연간 이용료 (${order.orgName})`,
        successUrl: `${origin}/billing/success`,
        failUrl: `${origin}/billing`,
      });
    } catch (e) {
      setPayErr(e instanceof Error ? e.message : "결제 요청 실패");
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-lg mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">정식 전환 결제</h1>
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
          단지 세대수 구간에 따른 <b>연간 정액</b>입니다. 결제 즉시 단지·평가 제한과
          워터마크 없이 1년간 이용할 수 있고, 기존 데이터는 그대로 유지됩니다.
        </p>
      </div>

      {loadErr && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              {loadErr}
              <div className="mt-2">
                <Link to="/complexes"><Button variant="outline" size="sm">단지 관리로</Button></Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {order && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building className="h-4 w-4" />단지별 요금</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y text-sm">
              {order.lines.map((l, i) => (
                <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{l.label || "단지"}</div>
                    <div className="text-xs text-muted-foreground">{l.households.toLocaleString()}세대 · {l.tierLabel}</div>
                  </div>
                  <div className="font-semibold shrink-0">{formatKRW(l.unit)}</div>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t flex items-center justify-between bg-muted/30">
              <span className="font-semibold">연간 합계</span>
              <span className="text-lg font-bold">{formatKRW(order.amount)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 토스 위젯 or 설정 안내 */}
      {order && !clientKey && (
        <Card className="border-primary/40 bg-primary/[0.03]">
          <CardContent className="p-4 text-sm space-y-2">
            <div className="font-medium flex items-center gap-2"><CreditCard className="h-4 w-4" />온라인 결제 준비 중</div>
            <p className="text-muted-foreground leading-relaxed">
              결제 모듈(토스페이먼츠)이 아직 설정되지 않았습니다. 기존 방식으로 정식 사용을 신청하시면
              확인 후 활성화해 드립니다.
            </p>
            <Link to="/activate"><Button size="sm" variant="outline">정식 사용 신청하기</Button></Link>
          </CardContent>
        </Card>
      )}

      {order && clientKey && (
        <>
          <div id="payment-method" />
          <div id="agreement" />
          {payErr && <p className="text-sm text-destructive">{payErr}</p>}
          <Button onClick={pay} disabled={!ready} className="w-full h-12 text-base gap-2">
            <ShieldCheck className="h-5 w-5" />
            {ready ? `${formatKRW(order.amount)} 결제하기` : "결제창 준비 중…"}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
            결제는 토스페이먼츠를 통해 안전하게 처리됩니다. 세금계산서·문의는 카카오톡 채널로 남겨주세요.
          </p>
        </>
      )}
    </div>
  );
}
