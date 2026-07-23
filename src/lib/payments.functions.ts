import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { priceBreakdown, type BillingCycle } from "@/lib/pricing";

// 세대수 구간 정액제 온라인 결제(연간). 금액은 서버가 조직 단지들로 계산해
// payments(ready) 행을 만들고, 토스 승인 성공 시 조직을 active로 전환한다.

async function getAdminOrg(authUid: string) {
  const { data: u } = await supabaseAdmin
    .from("users")
    .select("id, organization_id, org_role")
    .eq("auth_id", authUid)
    .maybeSingle();
  if (!u?.organization_id) throw new Error("사용자 또는 조직을 찾을 수 없습니다.");
  if (u.org_role !== "admin") throw new Error("결제는 조직 관리자만 진행할 수 있습니다.");
  return u as { id: string; organization_id: string; org_role: string };
}

// 조직의 단지 목록 → 세대수 구간 정액 합산.
async function computeAmount(orgId: string, cycle: BillingCycle) {
  const { data: complexes } = await supabaseAdmin
    .from("complexes")
    .select("name, household_count")
    .eq("organization_id", orgId)
    .order("name");
  const list = (complexes ?? []) as Array<{ name: string; household_count: number | null }>;
  const { lines, total } = priceBreakdown(list, cycle);
  return { lines, total, count: list.length };
}

const orderSchema = z.object({ cycle: z.enum(["annual", "monthly"]).default("annual") });

// 결제 주문 생성: 서버가 금액을 계산해 ready 행을 만든다.
// 클라이언트는 반환된 orderId/amount로만 결제창을 띄운다(금액 위변조 방지).
export const createPaymentOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orderSchema.parse(i))
  .handler(async ({ data, context }) => {
    const me = await getAdminOrg(context.userId);
    const orgId = me.organization_id;
    const { lines, total, count } = await computeAmount(orgId, data.cycle);
    if (count === 0) throw new Error("등록된 단지가 없습니다. 먼저 단지를 등록하세요.");
    if (total <= 0) throw new Error("결제 금액을 계산할 수 없습니다. 단지 세대수를 확인하세요.");

    const orderId = `sad_${orgId.slice(0, 8)}_${Date.now().toString(36)}`;
    const { error } = await supabaseAdmin.from("payments").insert({
      organization_id: orgId,
      order_id: orderId,
      amount: total,
      billing_cycle: data.cycle,
      status: "ready",
      breakdown: lines,
    });
    if (error) throw new Error("주문 생성 실패: " + error.message);

    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .maybeSingle();

    return { orderId, amount: total, cycle: data.cycle, lines, orgName: org?.name ?? "" };
  });

const confirmSchema = z.object({
  paymentKey: z.string().min(1),
  orderId: z.string().min(1),
  amount: z.number().int().positive(),
});

// 결제 승인 + 조직 활성화: successUrl 콜백값을 서버에서 토스로 최종 승인한다.
export const confirmPaymentAndActivate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => confirmSchema.parse(i))
  .handler(async ({ data, context }) => {
    const me = await getAdminOrg(context.userId);

    // 주문 검증: 내 조직의 주문이고 금액이 일치해야 함(위변조 방지).
    const { data: order } = await supabaseAdmin
      .from("payments")
      .select("id, organization_id, amount, status, billing_cycle")
      .eq("order_id", data.orderId)
      .maybeSingle();
    if (!order) throw new Error("주문을 찾을 수 없습니다.");
    if (order.organization_id !== me.organization_id) throw new Error("주문 조직이 일치하지 않습니다.");
    if (order.amount !== data.amount) throw new Error("결제 금액이 일치하지 않습니다.");
    if (order.status === "paid") return { ok: true as const, already: true };

    const secret = process.env.TOSS_SECRET_KEY;
    if (!secret) {
      throw new Error("결제 설정이 완료되지 않았습니다(TOSS_SECRET_KEY). 관리자에게 문의하세요.");
    }

    const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(secret + ":")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        paymentKey: data.paymentKey,
        orderId: data.orderId,
        amount: data.amount,
      }),
    });
    const body = (await res.json()) as {
      message?: string;
      method?: string;
      receipt?: { url?: string };
    };
    if (!res.ok) {
      await supabaseAdmin.from("payments").update({ status: "failed" }).eq("order_id", data.orderId);
      throw new Error(body?.message ?? "결제 승인에 실패했습니다.");
    }

    // 조직 활성화 (SECURITY DEFINER 함수로 가드 트리거 안전 통과).
    const months = order.billing_cycle === "monthly" ? 1 : 12;
    const { error: actErr } = await supabaseAdmin.rpc("apply_paid_activation", {
      p_org_id: order.organization_id,
      p_months: months,
    });
    if (actErr) throw new Error("활성화 처리 실패: " + actErr.message);

    await supabaseAdmin
      .from("payments")
      .update({
        status: "paid",
        payment_key: data.paymentKey,
        method: body?.method ?? null,
        receipt_url: body?.receipt?.url ?? null,
        paid_at: new Date().toISOString(),
      })
      .eq("order_id", data.orderId);

    return { ok: true as const };
  });
