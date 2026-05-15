import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function getMe(authUid: string) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, organization_id, org_role")
    .eq("auth_id", authUid)
    .maybeSingle();
  if (error || !data) throw new Error("사용자를 찾을 수 없습니다.");
  return data;
}

async function isLastAdmin(orgId: string, userId: string) {
  const { count } = await supabaseAdmin
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("org_role", "admin");
  if ((count ?? 0) > 1) return false;
  const { data: only } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("organization_id", orgId)
    .eq("org_role", "admin")
    .maybeSingle();
  return only?.id === userId;
}

// 1) Leave organization (keep auth account)
export const leaveOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await getMe(context.userId);
    if (me.org_role === "admin" && me.organization_id) {
      if (await isLastAdmin(me.organization_id, me.id)) {
        throw new Error("마지막 관리자입니다. 다른 사용자를 관리자로 지정한 뒤 나가거나, 조직을 삭제하세요.");
      }
    }
    await supabaseAdmin.from("complex_members").delete().eq("user_id", me.id);
    const { error } = await supabaseAdmin.from("users").delete().eq("id", me.id);
    if (error) throw error;
    return { ok: true };
  });

// 2) Delete account entirely (auth + user row). Blocks if last admin.
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await getMe(context.userId);
    if (me.org_role === "admin" && me.organization_id) {
      if (await isLastAdmin(me.organization_id, me.id)) {
        throw new Error("마지막 관리자입니다. 조직을 먼저 삭제하거나 다른 관리자를 지정하세요.");
      }
    }
    await supabaseAdmin.from("complex_members").delete().eq("user_id", me.id);
    await supabaseAdmin.from("users").delete().eq("id", me.id);
    await supabaseAdmin.auth.admin.deleteUser(context.userId).catch(() => {});
    return { ok: true };
  });

// 3) Delete organization (admin only). Cascades all org data + all auth users.
export const deleteOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await getMe(context.userId);
    if (me.org_role !== "admin") throw new Error("관리자만 조직을 삭제할 수 있습니다.");
    if (!me.organization_id) throw new Error("조직이 없습니다.");
    const orgId = me.organization_id;

    // Collect all auth_ids in org (to delete after rows are gone)
    const { data: members } = await supabaseAdmin
      .from("users")
      .select("id, auth_id")
      .eq("organization_id", orgId);
    const authIds = (members ?? []).map((m) => m.auth_id).filter(Boolean) as string[];

    // Find org assessments → delete dependent rows (no FK cascades guaranteed)
    const { data: assessments } = await supabaseAdmin
      .from("assessments").select("id").eq("organization_id", orgId);
    const aIds = (assessments ?? []).map((a) => a.id);
    if (aIds.length) {
      const { data: hazards } = await supabaseAdmin.from("hazards").select("id").in("assessment_id", aIds);
      const hIds = (hazards ?? []).map((h) => h.id);
      if (hIds.length) await supabaseAdmin.from("measures").delete().in("hazard_id", hIds);
      await supabaseAdmin.from("signatures").delete().in("assessment_id", aIds);
      await supabaseAdmin.from("participants").delete().in("assessment_id", aIds);
      await supabaseAdmin.from("hazards").delete().in("assessment_id", aIds);
      await supabaseAdmin.from("assessments").delete().in("id", aIds);
    }
    await supabaseAdmin.from("near_miss").delete().eq("organization_id", orgId);

    // Complex members for org's complexes
    const { data: complexes } = await supabaseAdmin
      .from("complexes").select("id").eq("organization_id", orgId);
    const cIds = (complexes ?? []).map((c) => c.id);
    if (cIds.length) {
      await supabaseAdmin.from("complex_members").delete().in("complex_id", cIds);
      await supabaseAdmin.from("complexes").delete().in("id", cIds);
    }

    await supabaseAdmin.from("invitations").delete().eq("organization_id", orgId);
    await supabaseAdmin.from("users").delete().eq("organization_id", orgId);
    await supabaseAdmin.from("organizations").delete().eq("id", orgId);

    // Finally delete auth users
    for (const aid of authIds) {
      await supabaseAdmin.auth.admin.deleteUser(aid).catch(() => {});
    }
    return { ok: true };
  });
