import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function requirePlatformAdmin(authUid: string) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("is_platform_admin")
    .eq("auth_id", authUid)
    .maybeSingle();
  if (error || !data?.is_platform_admin) throw new Error("플랫폼 관리자만 사용할 수 있습니다.");
}

const schema = z.object({ orgId: z.string().uuid() });

// Fully delete an organization: dependent data, member accounts, and the org itself.
export const platformDeleteOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => schema.parse(i))
  .handler(async ({ context, data }) => {
    await requirePlatformAdmin(context.userId);
    const orgId = data.orgId;

    const { data: members } = await supabaseAdmin
      .from("users")
      .select("id, auth_id")
      .eq("organization_id", orgId);
    const authIds = (members ?? []).map((m) => m.auth_id).filter(Boolean) as string[];

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

    for (const aid of authIds) {
      await supabaseAdmin.auth.admin.deleteUser(aid).catch(() => {});
    }
    return { ok: true };
  });
