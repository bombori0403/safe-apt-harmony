import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

type OrgGate = "loading" | "ok" | "pending" | "rejected";

function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [gate, setGate] = useState<OrgGate>("loading");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    supabase
      .from("users")
      .select("is_platform_admin, organizations(approval_status)")
      .eq("auth_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        if (data?.is_platform_admin) {
          setGate("ok");
          return;
        }
        const status = (data?.organizations as { approval_status?: string } | null)?.approval_status;
        setGate(status === "approved" ? "ok" : status === "rejected" ? "rejected" : "pending");
      });
    return () => {
      mounted = false;
    };
  }, [user]);

  if (loading || (user && gate === "loading")) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        불러오는 중...
      </div>
    );
  }
  if (!user) return null;

  if (gate === "pending" || gate === "rejected") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center">
        <div className="max-w-sm space-y-3">
          <h1 className="text-xl font-bold">
            {gate === "pending" ? "가입 승인 대기 중입니다" : "가입이 승인되지 않았습니다"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {gate === "pending"
              ? "관리자가 회사 가입을 확인한 후 이용하실 수 있습니다."
              : "문의사항은 관리자에게 연락해주세요."}
          </p>
          <Button variant="outline" onClick={signOut}>로그아웃</Button>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
