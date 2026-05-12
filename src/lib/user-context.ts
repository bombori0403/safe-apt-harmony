import { supabase } from "@/integrations/supabase/client";

/**
 * 현재 로그인 사용자의 public.users.id (auth_id 기반)와 기본 단지 ID를 가져온다.
 */
export async function getCurrentUserContext(authUid: string): Promise<{
  userId: string | null;
  complexId: string | null;
  userRow: any | null;
}> {
  const { data: userRow } = await supabase
    .from("users")
    .select("*")
    .eq("auth_id", authUid)
    .maybeSingle();
  if (!userRow) return { userId: null, complexId: null, userRow: null };

  const { data: member } = await supabase
    .from("complex_members")
    .select("complex_id")
    .eq("user_id", userRow.id)
    .limit(1)
    .maybeSingle();

  return { userId: userRow.id, complexId: member?.complex_id ?? null, userRow };
}
