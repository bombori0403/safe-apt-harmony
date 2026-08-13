import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export interface SubscriptionState {
  status: string | null;      // trial / active / past_due / canceled
  expiresAt: string | null;
  isTrial: boolean;           // 체험 상태
  isPaid: boolean;            // 유료(active) 상태
  isExpired: boolean;         // 체험 또는 유료 구독이 만료된 상태(서버 org_can_write와 동일 기준)
  daysLeft: number | null;    // 만료까지 잔여일 (양수), 만료면 0
  loading: boolean;
}

// Reads the current user's organization subscription so screens can gate
// trial/paid behavior (watermark, expiry lock, renewal CTA) in step with the
// server-side org_can_write() write gate.
export function useSubscription(): SubscriptionState {
  const { user } = useAuth();
  const [state, setState] = useState<SubscriptionState>({
    status: null, expiresAt: null, isTrial: false, isPaid: false, isExpired: false, daysLeft: null, loading: true,
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
        const isPaid = status === "active";
        const expMs = expiresAt ? new Date(expiresAt).getTime() : null;
        // 서버 org_can_write(): status in('trial','active') AND (expires_at IS NULL OR expires_at>now()).
        // 유한 만료는 유료 활성화(apply_paid_activation)뿐이고, 수동 활성화는 expires_at=null이라 만료되지 않는다.
        const isExpired = (isTrial || isPaid) && expMs != null && expMs < Date.now();
        const daysLeft = (isTrial || isPaid) && expMs != null
          ? Math.max(0, Math.ceil((expMs - Date.now()) / 86400000))
          : null;
        setState({ status, expiresAt, isTrial, isPaid, isExpired, daysLeft, loading: false });
      });
    return () => { mounted = false; };
  }, [user]);

  return state;
}
