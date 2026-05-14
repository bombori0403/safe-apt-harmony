import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function ensureUserRow(authUid: string) {
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(authUid);
  if (authError || !authUser.user?.email) throw new Error("사용자 정보를 확인할 수 없습니다.");
  const email = authUser.user.email;
  const name = authUser.user.user_metadata?.name ?? email.split("@")[0] ?? "사용자";
  const { data: userRow, error: userError } = await supabaseAdmin
    .from("users")
    .upsert({ auth_id: authUid, email, name }, { onConflict: "auth_id" })
    .select("id, name")
    .single();
  if (userError) throw userError;
  return userRow;
}

export const ensureDefaultComplex = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userRow = await ensureUserRow(context.userId);

    const { data: member } = await supabaseAdmin
      .from("complex_members")
      .select("complex_id")
      .eq("user_id", userRow.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (member?.complex_id) return { userId: userRow.id, complexId: member.complex_id };

    const { data: complex, error: complexError } = await supabaseAdmin
      .from("complexes")
      .insert({ name: "내 단지", address: "주소를 입력하세요", mgmt_type: "위탁관리", manager_name: userRow.name })
      .select("id")
      .single();
    if (complexError) throw complexError;

    const { error: memberError } = await supabaseAdmin
      .from("complex_members")
      .insert({ complex_id: complex.id, user_id: userRow.id, role_in_complex: "관리사무소장" });
    if (memberError) throw memberError;

    return { userId: userRow.id, complexId: complex.id };
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
    const userRow = await ensureUserRow(context.userId);

    const { data: complex, error: complexError } = await supabaseAdmin
      .from("complexes")
      .insert({
        name: data.name,
        address: data.address,
        household_count: data.household_count ?? null,
        mgmt_type: data.mgmt_type,
        manager_name: data.manager_name ?? userRow.name,
        manager_phone: data.manager_phone ?? null,
      })
      .select("id")
      .single();
    if (complexError) throw complexError;

    const { error: memberError } = await supabaseAdmin
      .from("complex_members")
      .insert({ complex_id: complex.id, user_id: userRow.id, role_in_complex: "관리사무소장" });
    if (memberError) throw memberError;

    return { complexId: complex.id };
  });

const deleteComplexSchema = z.object({ complexId: z.string().uuid() });

export const deleteComplex = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => deleteComplexSchema.parse(input))
  .handler(async ({ data, context }) => {
    const userRow = await ensureUserRow(context.userId);

    // Verify caller is a member of this complex
    const { data: member } = await supabaseAdmin
      .from("complex_members")
      .select("id")
      .eq("complex_id", data.complexId)
      .eq("user_id", userRow.id)
      .maybeSingle();
    if (!member) throw new Error("해당 단지에 대한 권한이 없습니다.");

    // Block deletion if assessments exist
    const { count } = await supabaseAdmin
      .from("assessments")
      .select("id", { count: "exact", head: true })
      .eq("complex_id", data.complexId);
    if ((count ?? 0) > 0) {
      throw new Error(`이 단지에 평가 기록(${count}건)이 있어 삭제할 수 없습니다.`);
    }

    await supabaseAdmin.from("near_miss").delete().eq("complex_id", data.complexId);
    await supabaseAdmin.from("complex_members").delete().eq("complex_id", data.complexId);
    const { error } = await supabaseAdmin.from("complexes").delete().eq("id", data.complexId);
    if (error) throw error;

    return { ok: true };
  });
