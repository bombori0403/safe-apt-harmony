import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ClipboardList, FilePlus2, Building2, Settings, Shield } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/dashboard", label: "대시보드", icon: LayoutDashboard },
  { to: "/assessment/new", label: "새 평가", icon: FilePlus2 },
  { to: "/history", label: "평가 이력", icon: ClipboardList },
  { to: "/console", label: "본사 콘솔", icon: Building2 },
  { to: "/settings", label: "설정", icon: Settings },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { signOut, user } = useAuth();
  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar - desktop only */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2 px-5 h-16 border-b">
          <Shield className="h-6 w-6 text-primary" />
          <div className="font-bold text-lg tracking-tight">안전관리소</div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => {
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
          <div className="flex items-center gap-2 font-bold">
            <Shield className="h-5 w-5 text-primary" /> 안전관리소
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>로그아웃</Button>
        </header>
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
        <footer className="border-t bg-card px-4 py-3 text-center text-[11px] md:text-xs text-muted-foreground mb-16 md:mb-0">
          Copyright © 2026. [kimsugyun/위험성평가-안전관리소]. All rights reserved.
        </footer>

        {/* Bottom tabbar - mobile */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t flex">
          {NAV.filter(n => n.to !== "/console").map(({ to, label, icon: Icon }) => {
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
