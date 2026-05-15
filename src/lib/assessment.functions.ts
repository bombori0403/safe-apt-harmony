import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
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

async function ensureAccess(assessmentId: string, orgId: string) {
  const { data: a } = await supabaseAdmin
    .from("assessments")
    .select("id, organization_id")
    .eq("id", assessmentId)
    .maybeSingle();
  if (!a || a.organization_id !== orgId) throw new Error("권한이 없습니다.");
}

function ensureManagerOrAdmin(role: string | null) {
  if (role !== "admin" && role !== "manager") {
    throw new Error("관리자 또는 매니저만 가능합니다.");
  }
}

const deleteSchema = z.object({ assessmentId: z.string().uuid() });

export const deleteAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => deleteSchema.parse(i))
  .handler(async ({ data, context }) => {
    const me = await getMe(context.userId);
    ensureManagerOrAdmin(me.org_role);
    await ensureAccess(data.assessmentId, me.organization_id!);

    const { data: hazards } = await supabaseAdmin
      .from("hazards").select("id").eq("assessment_id", data.assessmentId);
    const hIds = (hazards ?? []).map((h) => h.id);
    if (hIds.length) await supabaseAdmin.from("measures").delete().in("hazard_id", hIds);
    await supabaseAdmin.from("signatures").delete().eq("assessment_id", data.assessmentId);
    await supabaseAdmin.from("participants").delete().eq("assessment_id", data.assessmentId);
    await supabaseAdmin.from("hazards").delete().eq("assessment_id", data.assessmentId);
    await supabaseAdmin.from("near_miss").update({ assessment_id: null }).eq("assessment_id", data.assessmentId);
    const { error } = await supabaseAdmin.from("assessments").delete().eq("id", data.assessmentId);
    if (error) throw error;
    return { ok: true };
  });

const updateSchema = z.object({
  assessmentId: z.string().uuid(),
  work_name: z.string().trim().min(1).max(200),
  assessment_date: z.string().min(1),
  location: z.string().trim().max(200).optional().nullable(),
  status: z.enum(["작성중", "협의중", "완료"]).optional(),
});

export const updateAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => updateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const me = await getMe(context.userId);
    ensureManagerOrAdmin(me.org_role);
    await ensureAccess(data.assessmentId, me.organization_id!);
    const { error } = await supabaseAdmin
      .from("assessments")
      .update({
        work_name: data.work_name,
        assessment_date: data.assessment_date,
        location: data.location ?? null,
        ...(data.status ? { status: data.status } : {}),
      })
      .eq("id", data.assessmentId);
    if (error) throw error;
    return { ok: true };
  });
