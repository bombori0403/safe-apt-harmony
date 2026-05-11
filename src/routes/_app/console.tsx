import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, AlertTriangle, TrendingUp, Users } from "lucide-react";

export const Route = createFileRoute("/_app/console")({
  component: Console,
});

function Console() {
  const [complexes, setComplexes] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, month: 0, high: 0 });

  useEffect(() => {
    (async () => {
      const { data: c } = await supabase.from("complexes").select("*");
      setComplexes(c ?? []);
      const start = new Date(); start.setDate(1); start.setHours(0,0,0,0);
      const { count: mc } = await supabase.from("assessments").select("*", { count: "exact", head: true }).gte("created_at", start.toISOString());
      const { count: hc } = await supabase.from("hazards").select("*", { count: "exact", head: true }).in("level", ["높음","매우높음"]);
      setStats({ total: c?.length ?? 0, month: mc ?? 0, high: hc ?? 0 });
    })();
  }, []);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold">본사 콘솔</h1>
        <p className="text-sm text-muted-foreground mt-1">위탁관리회사 본사용 멀티사이트 통합 관리</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Building2} title="관리 단지" value={stats.total} />
        <Stat icon={TrendingUp} title="이번 달 평가" value={stats.month} />
        <Stat icon={AlertTriangle} title="매우높음 미해결" value={stats.high} danger />
        <Stat icon={Users} title="평균 참여율" value="—" />
      </div>

      <Card><CardContent className="p-0">
        <div className="p-4 border-b font-semibold">단지 목록</div>
        <div className="divide-y">
          {complexes.map(c => (
            <div key={c.id} className="p-4 flex items-center justify-between gap-3 hover:bg-muted/40">
              <div className="min-w-0">
                <div className="font-medium truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{c.address} · {c.household_count}세대 · {c.mgmt_type}</div>
              </div>
            </div>
          ))}
          {complexes.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">단지가 없습니다.</div>}
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-5">
        <h2 className="font-semibold mb-2">표준화 환산 정책</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          단지별 평가가 어떤 방법(3단계/5단계/빈도강도/체크리스트/OPS)으로 진행되었든, 본사 콘솔에서는 5단계 표준 위험성수준으로 자동 환산하여 표시합니다.
          원본 방법·점수는 함께 보존되어 감사 시 대응 가능합니다.
        </p>
        <ul className="text-xs text-muted-foreground mt-3 space-y-1">
          <li>· 3단계 → 5단계: 상=매우높음, 중=보통, 하=낮음</li>
          <li>· 체크리스트 보완 항목수: 1=낮음, 2~3=보통, 4~5=높음, 6+=매우높음</li>
          <li>· OPS 위험요인 수: 1=낮음, 2=보통, 3+=높음</li>
        </ul>
      </CardContent></Card>
    </div>
  );
}

function Stat({ icon: Icon, title, value, danger }: { icon: any; title: string; value: any; danger?: boolean }) {
  return (
    <Card className={danger && Number(value) > 0 ? "border-danger/40" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground text-xs">
          <span>{title}</span><Icon className={`h-4 w-4 ${danger ? "text-danger" : ""}`} />
        </div>
        <div className={`text-2xl font-bold mt-1.5 ${danger && Number(value) > 0 ? "text-danger" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
