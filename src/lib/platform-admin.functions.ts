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

// Supabase 실사용량(DB·스토리지·카운트) — 플랫폼 관리자 전용.
export const getPlatformUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requirePlatformAdmin(context.userId);
    const { data, error } = await supabaseAdmin.rpc("get_platform_usage");
    if (error) throw new Error(error.message);
    return data as {
      db_bytes: number;
      storage_bytes: number;
      photo_count: number;
      assessments: number;
      organizations: number;
      users: number;
    };
  });

// 업체별·단지별 사용량 집계 — 플랫폼 관리자 전용.
export const getUsageBreakdown = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requirePlatformAdmin(context.userId);
    const { data, error } = await supabaseAdmin.rpc("get_usage_breakdown");
    if (error) throw new Error(error.message);
    return data as {
      orgs: Array<{ id: string; name: string; subscription_status: string; complexes: number; assessments: number; hazards: number; near_miss: number; users: number; storage_bytes: number }>;
      complexes: Array<{ id: string; name: string; org_id: string; org_name: string | null; household_count: number | null; assessments: number; hazards: number; near_miss: number; storage_bytes: number }>;
    };
  });

// 회사 관리자가 본인 조직의 단지별 사용량을 조회. get_usage_breakdown을 서버에서 호출 후
// 본인 조직 것만 필터해 반환한다(다른 조직 데이터는 노출되지 않음).
export const getMyOrgUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: u } = await supabaseAdmin
      .from("users").select("organization_id, org_role").eq("auth_id", context.userId).maybeSingle();
    if (!u?.organization_id) throw new Error("조직을 찾을 수 없습니다.");
    if (u.org_role !== "admin") throw new Error("회사 사용량은 관리자만 볼 수 있습니다.");
    const { data, error } = await supabaseAdmin.rpc("get_usage_breakdown");
    if (error) throw new Error(error.message);
    const all = data as {
      orgs: Array<{ id: string; name: string; complexes: number; assessments: number; hazards: number; near_miss: number; users: number; storage_bytes: number }>;
      complexes: Array<{ id: string; name: string; org_id: string; household_count: number | null; assessments: number; hazards: number; near_miss: number; storage_bytes: number }>;
    };
    const org = all.orgs.find((o) => o.id === u.organization_id) ?? null;
    const complexes = all.complexes.filter((c) => c.org_id === u.organization_id);
    return { org, complexes };
  });

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
