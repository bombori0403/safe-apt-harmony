import { supabase } from "@/integrations/supabase/client";

/**
 * 현재 로그인 사용자의 public.users.id (auth_id 기반)와 기본 단지 ID를 가져온다.
 * 기존 계정처럼 단지 연결이 비어 있으면 안전한 DB 함수로 기본 단지를 보강한다.
 */
export async function getCurrentUserContext(authUid: string): Promise<{
  userId: string | null;
  complexId: string | null;
  userRow: any | null;
}> {
  const loadContext = async () => {
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
  };

  const context = await loadContext();
  if (context.userId && context.complexId) return context;

  const { error } = await (supabase as any).rpc("ensure_current_user_default_complex");
  if (error) {
    console.error("Failed to ensure default complex", error);
    return context;
  }

  return loadContext();
}
