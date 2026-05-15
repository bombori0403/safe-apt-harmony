import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function getMe(authUid: string) {
  const { data: u, error } = await supabaseAdmin
    .from("users")
    .select("id, organization_id, org_role")
    .eq("auth_id", authUid)
    .maybeSingle();
  if (error || !u) throw new Error("사용자를 찾을 수 없습니다.");
  if (u.org_role !== "admin" && u.org_role !== "manager") {
    throw new Error("초대 권한이 없습니다. (관리자 또는 매니저만 가능)");
  }
  return u;
}

async function getMyComplexId(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("complex_members")
    .select("complex_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return data?.complex_id ?? null;
}

export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await getMe(context.userId);
    const orgId = me.organization_id!;

    const { data: members } = await supabaseAdmin
      .from("users")
      .select("id, auth_id, email, name, org_role, role, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true });

    // member -> complex map
    const memberIds = (members ?? []).map((m) => m.id);
    const { data: cmRows } = memberIds.length
      ? await supabaseAdmin
          .from("complex_members")
          .select("user_id, complex_id, complexes(id, name)")
          .in("user_id", memberIds)
      : { data: [] as any[] };

    const { data: invites } = await supabaseAdmin
      .from("invitations")
      .select("id, email, role, status, expires_at, used_at, created_at, token, is_link, max_uses, used_count, label, complex_id, invited_by")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    const { data: complexes } = await supabaseAdmin
      .from("complexes")
      .select("id, name")
      .eq("organization_id", orgId)
      .order("name");

    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("id, name")
      .eq("id", orgId)
      .maybeSingle();

    const myComplexId = me.org_role === "manager" ? await getMyComplexId(me.id) : null;

    return {
      me: { id: me.id, role: me.org_role, complexId: myComplexId },
      members: members ?? [],
      memberComplexes: cmRows ?? [],
      invitations: invites ?? [],
      complexes: complexes ?? [],
      organization: org ?? null,
    };
  });

const createLinkSchema = z.object({
  role: z.enum(["admin", "manager", "member"]),
  label: z.string().trim().max(50).optional(),
  maxUses: z.number().int().min(1).max(500).optional(),
  expiresInDays: z.number().int().min(1).max(90).default(30),
  complexId: z.string().uuid().optional(),
});

export const createInviteLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => createLinkSchema.parse(i))
  .handler(async ({ data, context }) => {
    const me = await getMe(context.userId);

    // Permission rules
    if (me.org_role === "manager") {
      if (data.role !== "member") throw new Error("매니저는 일반 직원만 초대할 수 있습니다.");
      const myCx = await getMyComplexId(me.id);
      if (!myCx) throw new Error("소속 단지가 없어 초대할 수 없습니다. 관리자에게 문의하세요.");
      data.complexId = myCx;
    } else {
      // admin
      if (data.role === "manager" && !data.complexId) {
        throw new Error("매니저 초대 시 단지를 선택해야 합니다.");
      }
      if (data.role === "admin" && data.complexId) data.complexId = undefined;
    }

    if (data.complexId) {
      const { data: cx } = await supabaseAdmin
        .from("complexes")
        .select("id")
        .eq("id", data.complexId)
        .eq("organization_id", me.organization_id!)
        .maybeSingle();
      if (!cx) throw new Error("단지를 찾을 수 없습니다.");
    }

    const expiresAt = new Date(Date.now() + data.expiresInDays * 86400000).toISOString();
    const { data: inv, error } = await supabaseAdmin
      .from("invitations")
      .insert({
        email: null,
        role: data.role,
        organization_id: me.organization_id!,
        invited_by: me.id,
        is_link: true,
        max_uses: data.maxUses ?? null,
        label: data.label ?? null,
        complex_id: data.complexId ?? null,
        expires_at: expiresAt,
      })
      .select("id, token")
      .single();
    if (error) throw error;
    return { id: inv.id, token: inv.token };
  });

const createInviteSchema = z.object({
  email: z.string().trim().email().max(255),
  role: z.enum(["admin", "manager", "member"]).default("member"),
  complexId: z.string().uuid().optional(),
});

export const createInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => createInviteSchema.parse(i))
  .handler(async ({ data, context }) => {
    const me = await getMe(context.userId);

    if (me.org_role === "manager") {
      if (data.role !== "member") throw new Error("매니저는 일반 직원만 초대할 수 있습니다.");
      const myCx = await getMyComplexId(me.id);
      if (!myCx) throw new Error("소속 단지가 없어 초대할 수 없습니다.");
      data.complexId = myCx;
    } else {
      if (data.role === "manager" && !data.complexId) {
        throw new Error("매니저 초대 시 단지를 선택해야 합니다.");
      }
      if (data.role === "admin" && data.complexId) data.complexId = undefined;
    }

    // Seat check
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("seat_limit")
      .eq("id", me.organization_id!)
      .maybeSingle();
    const { count: memberCount } = await supabaseAdmin
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", me.organization_id!);
    const { count: pendingCount } = await supabaseAdmin
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", me.organization_id!)
      .eq("status", "pending");
    if ((memberCount ?? 0) + (pendingCount ?? 0) >= (org?.seat_limit ?? 5)) {
      throw new Error("좌석 수 한도를 초과했습니다.");
    }

    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("organization_id", me.organization_id!)
      .ilike("email", data.email)
      .maybeSingle();
    if (existing) throw new Error("이미 조직에 속한 이메일입니다.");

    const { data: inv, error } = await supabaseAdmin
      .from("invitations")
      .insert({
        email: data.email.toLowerCase(),
        role: data.role,
        organization_id: me.organization_id!,
        invited_by: me.id,
        complex_id: data.complexId ?? null,
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
    const me = await getMe(context.userId);
    // Manager can only revoke their own invites
    const filter = supabaseAdmin
      .from("invitations")
      .update({ status: "revoked" })
      .eq("id", data.id)
      .eq("organization_id", me.organization_id!);
    if (me.org_role === "manager") filter.eq("invited_by", me.id);
    const { error } = await filter;
    if (error) throw error;
    return { ok: true };
  });

export const deleteInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const me = await getMe(context.userId);
    let q = supabaseAdmin.from("invitations").delete().eq("id", data.id).eq("organization_id", me.organization_id!);
    if (me.org_role === "manager") q = q.eq("invited_by", me.id);
    const { error } = await q;
    if (error) throw error;
    return { ok: true };
  });

async function requireAdmin(authUid: string) {
  const me = await getMe(authUid);
  if (me.org_role !== "admin") throw new Error("관리자만 가능합니다.");
  return me;
}

export const updateMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ userId: z.string().uuid(), role: z.enum(["admin", "manager", "member"]) }).parse(i))
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context.userId);
    if (data.userId === admin.id && data.role !== "admin") {
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
      await supabaseAdmin.auth.admin.deleteUser(targetAuthId).catch(() => {});
    }
    return { ok: true };
  });

// Admin-only: assign / change a member's complex
export const assignMemberComplex = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ userId: z.string().uuid(), complexId: z.string().uuid().nullable() }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context.userId);

    const { data: target } = await supabaseAdmin
      .from("users")
      .select("id, organization_id, org_role")
      .eq("id", data.userId)
      .maybeSingle();
    if (!target || target.organization_id !== admin.organization_id) throw new Error("권한이 없습니다.");

    if (data.complexId) {
      const { data: cx } = await supabaseAdmin
        .from("complexes")
        .select("id")
        .eq("id", data.complexId)
        .eq("organization_id", admin.organization_id!)
        .maybeSingle();
      if (!cx) throw new Error("단지를 찾을 수 없습니다.");

      // Remove previous complex memberships for this user
      await supabaseAdmin.from("complex_members").delete().eq("user_id", data.userId);

      // If target is being set as manager's complex and a different manager already exists, demote
      if (target.org_role === "manager") {
        const { data: existing } = await supabaseAdmin
          .from("complex_members")
          .select("user_id, users!inner(id, org_role, organization_id)")
          .eq("complex_id", data.complexId);
        const otherManager = (existing ?? []).find(
          (r: any) => r.users?.org_role === "manager" && r.user_id !== data.userId
        );
        if (otherManager) {
          await supabaseAdmin.from("users").update({ org_role: "member" }).eq("id", otherManager.user_id);
        }
      }

      const { error } = await supabaseAdmin
        .from("complex_members")
        .insert({ user_id: data.userId, complex_id: data.complexId, role_in_complex: target.org_role === "manager" ? "관리사무소장" : "기타" });
      if (error) throw error;
    } else {
      await supabaseAdmin.from("complex_members").delete().eq("user_id", data.userId);
    }
    return { ok: true };
  });
