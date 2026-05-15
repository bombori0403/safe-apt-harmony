import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the current user's public.users id and a default complex id (if any).
 * In the new multitenant model, users belong to one organization. The "default
 * complex" is just the first complex the user is a member of (for legacy
 * single-complex pages). Returns null complexId if none yet.
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

  if (member?.complex_id) {
    return { userId: userRow.id, complexId: member.complex_id, userRow };
  }

  // Fallback: any complex in same org
  const { data: cx } = await supabase
    .from("complexes")
    .select("id")
    .eq("organization_id", userRow.organization_id ?? "")
    .limit(1)
    .maybeSingle();

  return { userId: userRow.id, complexId: cx?.id ?? null, userRow };
}
