import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ClipboardList, FilePlus2, Building2, Building, Settings, Shield, Users, AlertTriangle, ShieldAlert, MessageCircle, BookOpen, ShieldCheck, BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { SupportFab } from "@/components/support-fab";
import { MascotBuddy } from "@/components/mascot-buddy";

const NAV_GROUPS = [
  {
    title: null,
    items: [
      { to: "/dashboard", label: "대시보드", icon: LayoutDashboard },
    ],
  },
  {
    title: "위험성평가",
    items: [
      { to: "/assessment/new", label: "새 평가", icon: FilePlus2, managerOrAdmin: true },
      { to: "/history", label: "평가 이력", icon: ClipboardList },
      { to: "/regulation", label: "실시규정", icon: BookOpen },
    ],
  },
  {
    title: "안전 활동",
    items: [
      { to: "/near-miss", label: "아차사고", icon: AlertTriangle, managerOrAdmin: true },
      { to: "/work-stop-right", label: "작업중지권", icon: ShieldAlert, managerOrAdmin: true },
      { to: "/employee-inputs", label: "직원 참여", icon: MessageCircle },
    ],
  },
  {
    title: "관리",
    items: [
      { to: "/complexes", label: "단지 관리", icon: Building, managerOrAdmin: true },
      { to: "/team", label: "직원 관리", icon: Users, managerOrAdmin: true },
      { to: "/console", label: "본사 콘솔", icon: Building2, adminOnly: true },
      { to: "/platform-admin", label: "가입 승인", icon: ShieldCheck, platformAdminOnly: true },
      { to: "/data-usage", label: "데이터 사용량", icon: BarChart3, adminOnly: true },
    ],
  },
  {
    title: null,
    items: [
      { to: "/settings", label: "설정", icon: Settings },
    ],
  },
] as const;

const NAV = NAV_GROUPS.flatMap((g) => g.items);


export function AppShell({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { signOut, user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [orgName, setOrgName] = useState<string>("");
  useEffect(() => {
    if (!user) return;
    supabase.from("users").select("org_role, organization_id, is_platform_admin").eq("auth_id", user.id).maybeSingle()
      .then(async ({ data }) => {
        setIsAdmin(data?.org_role === "admin");
        setIsManager(data?.org_role === "manager");
        setIsPlatformAdmin(!!data?.is_platform_admin);
        if (data?.organization_id) {
          const { data: org } = await supabase.from("organizations").select("name").eq("id", data.organization_id).maybeSingle();
          if (org?.name) setOrgName(org.name);
        }
      });
  }, [user]);
  const canSee = (n: any) => {
    if (n.platformAdminOnly) return isPlatformAdmin;
    if (n.adminOnly) return isAdmin;
    if (n.managerOrAdmin) return isAdmin || isManager;
    return true;
  };
  const visibleNav = NAV.filter(canSee);
  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar - desktop only */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground print:hidden">
        <div className="flex items-center gap-2 px-5 h-16 border-b">
          <img src="/logo-mark.png" alt="안전데스크" className="h-9 w-9 rounded-full object-cover shrink-0" />
          <div className="min-w-0">
            <div className="font-bold text-lg tracking-tight leading-tight">안전데스크</div>
            {orgName && <div className="text-[11px] text-muted-foreground truncate">{orgName}</div>}
          </div>
        </div>
        <nav className="flex-1 p-3 overflow-y-auto">
          {NAV_GROUPS.map((group, gi) => {
            const items = group.items.filter(canSee);
            if (items.length === 0) return null;
            return (
              <div key={gi} className={gi > 0 ? "pt-4" : ""}>
                {group.title && (
                  <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
                    {group.title}
                  </div>
                )}
                <div className="space-y-1">
                  {items.map(({ to, label, icon: Icon }) => {
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
                </div>
              </div>
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
        <header className="md:hidden h-14 flex items-center justify-between px-4 border-b bg-card print:hidden">
          <div className="flex items-center gap-2 font-bold min-w-0">
            <img src="/logo-mark.png" alt="안전데스크" className="h-7 w-7 rounded-full object-cover shrink-0" />
            <span className="truncate">안전데스크{orgName && <span className="text-xs text-muted-foreground font-normal ml-1">· {orgName}</span>}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>로그아웃</Button>
        </header>
        <main className="flex-1 pb-20 md:pb-0 print:pb-0">{children}</main>

        {/* Bottom tabbar - mobile */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t flex print:hidden">
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

      <MascotBuddy />
      <SupportFab />
    </div>
  );
}
