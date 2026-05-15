import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function getUserRow(authUid: string) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, name, organization_id, org_role, email")
    .eq("auth_id", authUid)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("사용자 레코드를 찾을 수 없습니다.");
  return data;
}

export const getMyContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const u = await getUserRow(context.userId);
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("id, name, subscription_status, seat_limit, expires_at")
      .eq("id", u.organization_id!)
      .maybeSingle();
    const { count: seatCount } = await supabaseAdmin
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", u.organization_id!);
    return { user: u, organization: org, seatCount: seatCount ?? 0 };
  });

const createComplexSchema = z.object({
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().min(1).max(500),
  household_count: z.number().int().min(0).max(100000).optional().nullable(),
  mgmt_type: z.enum(["자가관리", "위탁관리"]).default("위탁관리"),
  manager_name: z.string().trim().max(100).optional().nullable(),
  manager_phone: z.string().trim().max(50).optional().nullable(),
});

export const createComplex = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createComplexSchema.parse(input))
  .handler(async ({ data, context }) => {
    const u = await getUserRow(context.userId);
    const { data: complex, error } = await supabaseAdmin
      .from("complexes")
      .insert({
        name: data.name,
        address: data.address,
        household_count: data.household_count ?? null,
        mgmt_type: data.mgmt_type,
        manager_name: data.manager_name ?? u.name,
        manager_phone: data.manager_phone ?? null,
        organization_id: u.organization_id,
      })
      .select("id")
      .single();
    if (error) throw error;
    await supabaseAdmin
      .from("complex_members")
      .insert({ complex_id: complex.id, user_id: u.id, role_in_complex: "관리사무소장" });
    return { complexId: complex.id };
  });

const deleteComplexSchema = z.object({ complexId: z.string().uuid() });

export const deleteComplex = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => deleteComplexSchema.parse(input))
  .handler(async ({ data, context }) => {
    const u = await getUserRow(context.userId);
    const { data: cx } = await supabaseAdmin
      .from("complexes")
      .select("id, organization_id")
      .eq("id", data.complexId)
      .maybeSingle();
    if (!cx || cx.organization_id !== u.organization_id) throw new Error("권한이 없습니다.");

    const { count } = await supabaseAdmin
      .from("assessments")
      .select("id", { count: "exact", head: true })
      .eq("complex_id", data.complexId);
    if ((count ?? 0) > 0) throw new Error(`이 단지에 평가 기록(${count}건)이 있어 삭제할 수 없습니다.`);

    await supabaseAdmin.from("near_miss").delete().eq("complex_id", data.complexId);
    await supabaseAdmin.from("complex_members").delete().eq("complex_id", data.complexId);
    const { error } = await supabaseAdmin.from("complexes").delete().eq("id", data.complexId);
    if (error) throw error;
    return { ok: true };
  });
