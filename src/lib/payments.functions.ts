import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { priceBreakdown, PAYMENTS_PUBLIC, type BillingCycle } from "@/lib/pricing";

// 세대수 구간 정액제 온라인 결제(연간). 금액은 서버가 조직 단지들로 계산해
// payments(ready) 행을 만들고, 토스 승인 성공 시 조직을 active로 전환한다.

async function getAdminOrg(authUid: string) {
  const { data: u } = await supabaseAdmin
    .from("users")
    .select("id, organization_id, org_role, is_platform_admin")
    .eq("auth_id", authUid)
    .maybeSingle();
  if (!u?.organization_id) throw new Error("사용자 또는 조직을 찾을 수 없습니다.");
  if (u.org_role !== "admin") throw new Error("결제는 조직 관리자만 진행할 수 있습니다.");
  // 실키 전환 전까지는 플랫폼 관리자에게만 결제 허용(실고객 무료 자가활성화 방지).
  if (!PAYMENTS_PUBLIC && !u.is_platform_admin) {
    throw new Error("결제 기능은 현재 준비 중입니다. 도입 문의는 카카오톡 채널로 남겨주세요.");
  }
  return u as { id: string; organization_id: string; org_role: string; is_platform_admin: boolean };
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

// 토스 승인(멱등) → 원자적 활성화(apply_paid_activation)를 재구동한다.
// 이 경로는 ready에서 처음 진입하든, confirming에 갇힌 주문을 복구하든 안전하게 동작한다:
// 토스 confirm은 같은 paymentKey/orderId에 대해 중복 청구 없이 같은 결과를 돌려주고,
// 활성화는 payments의 confirming→paid 전이를 가드로 삼아 정확히 1회만 만료를 연장한다.
async function driveConfirm(orderId: string, paymentKey: string, amount: number, secret: string) {
  const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(secret + ":")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });
  const body = (await res.json()) as {
    message?: string;
    method?: string;
    receipt?: { url?: string };
  };
  if (!res.ok) {
    // 우리가 선점한(confirming) 주문만 failed로 표시 — 이미 paid인 행을 덮어쓰지 않음.
    await supabaseAdmin.from("payments").update({ status: "failed" }).eq("order_id", orderId).eq("status", "confirming");
    throw new Error(body?.message ?? "결제 승인에 실패했습니다.");
  }

  // 승인 성공 표시 + 조직 활성화를 한 함수에서 원자적으로 처리(멱등).
  const { error: actErr } = await supabaseAdmin.rpc("apply_paid_activation", {
    p_order_id: orderId,
    p_payment_key: paymentKey,
    p_method: body?.method ?? null,
    p_receipt_url: body?.receipt?.url ?? null,
  });
  if (actErr) {
    // 토스 결제는 이미 승인된 상태 — 주문은 confirming에 남고 이 경로가 다음 재시도에서 재구동해 복구한다.
    throw new Error("결제는 승인됐지만 활성화 처리에 실패했습니다. 결제 결과 페이지를 새로고침하면 자동으로 다시 시도됩니다. 계속되면 카카오톡 채널로 문의해 주세요. (" + actErr.message + ")");
  }
  return { ok: true as const };
}

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

    // 미결(ready)이거나 이전 시도에서 confirming에 갇힌 주문을 confirming으로 선점/재선점한다.
    // 활성화가 payments 전이로 멱등화돼 있어, 재구동(confirming 재진입)이나 동시 요청도 안전하다.
    const { data: claim } = await supabaseAdmin
      .from("payments")
      .update({ status: "confirming" })
      .eq("order_id", data.orderId)
      .in("status", ["ready", "confirming"])
      .select("id");
    if (!claim?.length) {
      // ready/confirming이 아님 → paid(완료) 또는 failed(토스 거절).
      const { data: cur } = await supabaseAdmin
        .from("payments").select("status").eq("order_id", data.orderId).maybeSingle();
      if (cur?.status === "paid") return { ok: true as const, already: true };
      throw new Error("결제를 처리할 수 없는 상태입니다(" + (cur?.status ?? "unknown") + "). 결제를 다시 시도하거나 카카오톡 채널로 문의해 주세요.");
    }

    return await driveConfirm(data.orderId, data.paymentKey, data.amount, secret);
  });
