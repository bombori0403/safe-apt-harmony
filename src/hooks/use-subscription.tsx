import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export interface SubscriptionState {
  status: string | null;      // trial / active / past_due / canceled
  expiresAt: string | null;
  isTrial: boolean;           // 체험 상태
  isExpired: boolean;         // 체험이 만료된 상태
  daysLeft: number | null;    // 체험 잔여일 (양수), 만료면 0
  loading: boolean;
}

// Reads the current user's organization subscription so screens can gate
// trial behavior (watermark, expiry lock) without a payment system.
export function useSubscription(): SubscriptionState {
  const { user } = useAuth();
  const [state, setState] = useState<SubscriptionState>({
    status: null, expiresAt: null, isTrial: false, isExpired: false, daysLeft: null, loading: true,
  });

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    supabase
      .from("users")
      .select("organizations(subscription_status, expires_at)")
      .eq("auth_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        const org = (data?.organizations as { subscription_status?: string; expires_at?: string } | null) ?? null;
        const status = org?.subscription_status ?? null;
        const expiresAt = org?.expires_at ?? null;
        const isTrial = status === "trial";
        const expMs = expiresAt ? new Date(expiresAt).getTime() : null;
        const isExpired = isTrial && expMs != null && expMs < Date.now();
        const daysLeft = isTrial && expMs != null
          ? Math.max(0, Math.ceil((expMs - Date.now()) / 86400000))
          : null;
        setState({ status, expiresAt, isTrial, isExpired, daysLeft, loading: false });
      });
    return () => { mounted = false; };
  }, [user]);

  return state;
}
