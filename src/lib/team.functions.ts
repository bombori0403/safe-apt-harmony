import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function requireAdmin(authUid: string) {
  const { data: u, error } = await supabaseAdmin
    .from("users")
    .select("id, organization_id, org_role")
    .eq("auth_id", authUid)
    .maybeSingle();
  if (error || !u) throw new Error("사용자를 찾을 수 없습니다.");
  if (u.org_role !== "admin") throw new Error("관리자만 접근할 수 있습니다.");
  return u;
}

export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await requireAdmin(context.userId);
    const { data: members } = await supabaseAdmin
      .from("users")
      .select("id, auth_id, email, name, org_role, role, created_at")
      .eq("organization_id", admin.organization_id!)
      .order("created_at", { ascending: true });
    const { data: invites } = await supabaseAdmin
      .from("invitations")
      .select("id, email, role, status, expires_at, used_at, created_at, token")
      .eq("organization_id", admin.organization_id!)
      .order("created_at", { ascending: false });
    return { members: members ?? [], invitations: invites ?? [] };
  });

const createInviteSchema = z.object({
  email: z.string().trim().email().max(255),
  role: z.enum(["admin", "manager", "member"]).default("member"),
});

export const createInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => createInviteSchema.parse(i))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context.userId);

    // Seat check
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("seat_limit")
      .eq("id", admin.organization_id!)
      .maybeSingle();
    const { count: memberCount } = await supabaseAdmin
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", admin.organization_id!);
    const { count: pendingCount } = await supabaseAdmin
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", admin.organization_id!)
      .eq("status", "pending");
    if ((memberCount ?? 0) + (pendingCount ?? 0) >= (org?.seat_limit ?? 5)) {
      throw new Error("좌석 수 한도를 초과했습니다. 좌석을 확장하거나 대기 초대를 취소하세요.");
    }

    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("organization_id", admin.organization_id!)
      .ilike("email", data.email)
      .maybeSingle();
    if (existing) throw new Error("이미 조직에 속한 이메일입니다.");

    const { data: inv, error } = await supabaseAdmin
      .from("invitations")
      .insert({
        email: data.email.toLowerCase(),
        role: data.role,
        organization_id: admin.organization_id!,
        invited_by: admin.id,
      })
      .select("id, token")
      .single();
    if (error) throw error;
    return { id: inv.id, token: inv.token };
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("invitations")
      .update({ status: "revoked" })
      .eq("id", data.id)
      .eq("organization_id", admin.organization_id!);
    if (error) throw error;
    return { ok: true };
  });

export const updateMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ userId: z.string().uuid(), role: z.enum(["admin", "manager", "member"]) }).parse(i))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context.userId);
    if (data.userId === admin.id && data.role !== "admin") {
      // prevent demoting if last admin
      const { count } = await supabaseAdmin
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", admin.organization_id!)
        .eq("org_role", "admin");
      if ((count ?? 0) <= 1) throw new Error("마지막 관리자는 강등할 수 없습니다.");
    }
    const { error } = await supabaseAdmin
      .from("users")
      .update({ org_role: data.role })
      .eq("id", data.userId)
      .eq("organization_id", admin.organization_id!);
    if (error) throw error;
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context.userId);
    if (data.userId === admin.id) throw new Error("본인을 삭제할 수 없습니다.");
    const { data: target } = await supabaseAdmin
      .from("users")
      .select("auth_id, organization_id")
      .eq("id", data.userId)
      .maybeSingle();
    if (!target || target.organization_id !== admin.organization_id) throw new Error("권한이 없습니다.");

    const targetAuthId: string | null = target.auth_id ?? null;
    await supabaseAdmin.from("users").delete().eq("id", data.userId);
    if (targetAuthId) {
      await supabaseAdmin.auth.admin.deleteUser(target.auth_id).catch(() => {});
    }
    return { ok: true };
  });
