import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ClipboardList, FilePlus2, Building2, Settings, Shield, Users, AlertTriangle, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { to: "/dashboard", label: "대시보드", icon: LayoutDashboard, adminOnly: false },
  { to: "/assessment/new", label: "새 평가", icon: FilePlus2, adminOnly: false },
  { to: "/history", label: "평가 이력", icon: ClipboardList, adminOnly: false },
  { to: "/near-miss", label: "아차사고", icon: AlertTriangle, adminOnly: false, managerOrAdmin: true },
  { to: "/work-stop-right", label: "작업중지권", icon: ShieldAlert, adminOnly: false, managerOrAdmin: true },
  { to: "/console", label: "본사 콘솔", icon: Building2, adminOnly: false },
  { to: "/team", label: "직원 관리", icon: Users, adminOnly: false, managerOrAdmin: true },
  { to: "/settings", label: "설정", icon: Settings, adminOnly: false },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { signOut, user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [orgName, setOrgName] = useState<string>("");
  useEffect(() => {
    if (!user) return;
    supabase.from("users").select("org_role, organization_id").eq("auth_id", user.id).maybeSingle()
      .then(async ({ data }) => {
        setIsAdmin(data?.org_role === "admin");
        setIsManager(data?.org_role === "manager");
        if (data?.organization_id) {
          const { data: org } = await supabase.from("organizations").select("name").eq("id", data.organization_id).maybeSingle();
          if (org?.name) setOrgName(org.name);
        }
      });
  }, [user]);
  const visibleNav = NAV.filter(n => {
    if (n.adminOnly) return isAdmin;
    if ((n as any).managerOrAdmin) return isAdmin || isManager;
    return true;
  });
  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar - desktop only */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2 px-5 h-16 border-b">
          <Shield className="h-6 w-6 text-primary" />
          <div className="min-w-0">
            <div className="font-bold text-lg tracking-tight leading-tight">안전관리소</div>
            {orgName && <div className="text-[11px] text-muted-foreground truncate">{orgName}</div>}
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {visibleNav.map(({ to, label, icon: Icon }) => {
            const active = path === to || path.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t text-xs space-y-2">
          <div className="text-muted-foreground truncate">{user?.email}</div>
          <Button variant="outline" size="sm" className="w-full" onClick={signOut}>
            로그아웃
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-14 flex items-center justify-between px-4 border-b bg-card">
          <div className="flex items-center gap-2 font-bold min-w-0">
            <Shield className="h-5 w-5 text-primary shrink-0" />
            <span className="truncate">안전관리소{orgName && <span className="text-xs text-muted-foreground font-normal ml-1">· {orgName}</span>}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>로그아웃</Button>
        </header>
        <main className="flex-1 pb-20 md:pb-0">{children}</main>

        {/* Bottom tabbar - mobile */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t flex">
          {visibleNav.filter(n => ["/dashboard","/history","/near-miss","/work-stop-right","/settings"].includes(n.to)).map(({ to, label, icon: Icon }) => {
            const active = path === to || path.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to}
                className={`flex-1 flex flex-col items-center justify-center py-2 text-[11px] gap-0.5 ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
