import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const ensureDefaultComplex = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const authUid = context.userId;
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(authUid);
    if (authError || !authUser.user?.email) throw new Error("사용자 정보를 확인할 수 없습니다.");

    const email = authUser.user.email;
    const name = authUser.user.user_metadata?.name ?? email.split("@")[0] ?? "사용자";
    const { data: userRow, error: userError } = await supabaseAdmin
      .from("users")
      .upsert({ auth_id: authUid, email, name }, { onConflict: "auth_id" })
      .select("id")
      .single();
    if (userError) throw userError;

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
      .insert({ name: "내 단지", address: "주소를 입력하세요", mgmt_type: "위탁관리", manager_name: name })
      .select("id")
      .single();
    if (complexError) throw complexError;

    const { error: memberError } = await supabaseAdmin
      .from("complex_members")
      .insert({ complex_id: complex.id, user_id: userRow.id, role_in_complex: "관리사무소장" });
    if (memberError) throw memberError;

    return { userId: userRow.id, complexId: complex.id };
  });