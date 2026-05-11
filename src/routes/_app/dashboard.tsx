import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, AlertTriangle, Calendar, Users, TrendingUp } from "lucide-react";
import { riskLevelClass, type RiskLevel } from "@/lib/types";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

interface Assessment {
  id: string;
  work_name: string;
  method: string;
  assessment_date: string;
  status: string;
  created_at: string;
}

function Dashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ name: string; position: string; primary_complex_id: string | null } | null>(null);
  const [complexName, setComplexName] = useState("");
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [unresolvedHigh, setUnresolvedHigh] = useState(0);
  const [monthCount, setMonthCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("profiles").select("name,position,primary_complex_id").eq("id", user.id).maybeSingle();
      if (p) setProfile(p as any);
      if (p?.primary_complex_id) {
        const { data: c } = await supabase.from("complexes").select("name").eq("id", p.primary_complex_id).maybeSingle();
        setComplexName(c?.name ?? "");
      }
      const { data: a } = await supabase.from("assessments").select("*").order("created_at", { ascending: false }).limit(20);
      setAssessments((a ?? []) as Assessment[]);

      const startMonth = new Date(); startMonth.setDate(1); startMonth.setHours(0,0,0,0);
      const { count: mc } = await supabase
        .from("assessments")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startMonth.toISOString());
      setMonthCount(mc ?? 0);

      const { count: hc } = await supabase
        .from("hazards")
        .select("*", { count: "exact", head: true })
        .in("level", ["높음", "매우높음"]);
      setUnresolvedHigh(hc ?? 0);
    })();
  }, [user]);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">
            안녕하세요, {profile?.name ?? ""} {profile?.position ?? ""}님
          </h1>
          {complexName && <p className="text-sm text-muted-foreground mt-1">{complexName}</p>}
        </div>
        <Link to="/assessment/new">
          <Button size="lg" className="gap-2 shadow-md shadow-primary/20">
            <Plus className="h-5 w-5" /> 새 평가 시작
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KpiCard title="이번 달 평가" value={monthCount} icon={TrendingUp} />
        <KpiCard title="높음·매우높음 미해결" value={unresolvedHigh} icon={AlertTriangle} danger />
        <KpiCard title="다음 정기평가" value="D-30" icon={Calendar} sub="예정" />
        <KpiCard title="참여 확인 대기" value={0} icon={Users} sub="명" />
      </div>

      <Card>
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">최근 평가</h2>
            <Link to="/history" className="text-sm text-primary hover:underline">전체 보기</Link>
          </div>
          {assessments.length === 0 ? (
            <div className="text-center text-muted-foreground py-10 text-sm">아직 평가가 없습니다. "새 평가 시작" 버튼을 눌러보세요.</div>
          ) : (
            <div className="divide-y">
              {assessments.slice(0, 5).map((a) => (
                <Link key={a.id} to="/assessment/$id" params={{ id: a.id }} className="py-3 flex items-center justify-between gap-3 hover:bg-muted/30 -mx-2 px-2 rounded">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{a.work_name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {a.assessment_date} · {a.method}
                    </div>
                  </div>
                  <Badge variant="outline">{a.status}</Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground text-center">
        본 시스템은 산업안전보건법 제36조 및 고용노동부 고시 제2024-76호에 따른 위험성평가 6단계 표준 절차를 지원합니다.
      </p>
    </div>
  );
}

function KpiCard({ title, value, icon: Icon, sub, danger }: { title: string; value: number | string; icon: any; sub?: string; danger?: boolean }) {
  return (
    <Card className={danger && Number(value) > 0 ? "border-danger/40" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground text-xs">
          <span>{title}</span>
          <Icon className={`h-4 w-4 ${danger ? "text-danger" : ""}`} />
        </div>
        <div className={`text-2xl md:text-3xl font-bold mt-2 ${danger && Number(value) > 0 ? "text-danger" : ""}`}>
          {value}<span className="text-sm font-normal text-muted-foreground ml-1">{sub}</span>
        </div>
      </CardContent>
    </Card>
  );
}
