import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, AlertTriangle, TrendingUp, Users, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import type { RiskLevel } from "@/lib/types";
import { useSubscription } from "@/hooks/use-subscription";
import { TrialWatermark } from "@/components/trial-watermark";

export const Route = createFileRoute("/_app/console")({
  component: Console,
});

const RISK_COLORS: Record<RiskLevel, string> = {
  매우낮음: "oklch(0.78 0.1 162)",
  낮음: "oklch(0.7 0.14 162)",
  보통: "oklch(0.78 0.16 70)",
  높음: "oklch(0.68 0.2 30)",
  매우높음: "oklch(0.58 0.23 27)",
};

function Console() {
  const sub = useSubscription();
  const [complexes, setComplexes] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [hazards, setHazards] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: a }, { data: h }] = await Promise.all([
        supabase.from("complexes").select("*"),
        supabase.from("assessments").select("id,complex_id,status,assessment_date,method"),
        supabase.from("hazards").select("level_standardized,level,assessment_id"),
      ]);
      setComplexes(c ?? []);
      setAssessments(a ?? []);
      setHazards(h ?? []);
    })();
  }, []);

  const startMonth = new Date(); startMonth.setDate(1); startMonth.setHours(0,0,0,0);
  const monthCount = assessments.filter(a => new Date(a.assessment_date) >= startMonth).length;
  const highCount = hazards.filter(h => (h.level_standardized ?? h.level) === "매우높음" || (h.level_standardized ?? h.level) === "높음").length;

  // 표준화 위험 분포
  const dist: Record<RiskLevel, number> = { 매우낮음:0, 낮음:0, 보통:0, 높음:0, 매우높음:0 };
  hazards.forEach(h => {
    const lvl = (h.level_standardized ?? h.level) as RiskLevel | null;
    if (lvl && lvl in dist) dist[lvl]++;
  });
  const pieData = (Object.keys(dist) as RiskLevel[]).map(k => ({ name: k, value: dist[k], color: RISK_COLORS[k] }));

  // 단지별 평가 수
  const byComplex = complexes.map(c => {
    const list = assessments.filter(a => a.complex_id === c.id);
    const hzIds = new Set(list.map(a => a.id));
    const hzList = hazards.filter(h => hzIds.has(h.assessment_id));
    const high = hzList.filter(h => ["높음","매우높음"].includes((h.level_standardized ?? h.level) as string)).length;
    const nm = c.name ?? "";
    return { name: nm.length > 8 ? nm.slice(0,8)+"…" : nm, 평가수: list.length, 고위험: high };
  });

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-5">
      {sub.isTrial && <TrialWatermark expired={sub.isExpired} />}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">본사 콘솔</h1>
          <p className="text-sm text-muted-foreground mt-1">위탁관리회사 본사용 멀티사이트 통합 관리</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" />인쇄
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Building2} title="관리 단지" value={complexes.length} />
        <Stat icon={TrendingUp} title="이번 달 평가" value={monthCount} />
        <Stat icon={AlertTriangle} title="높음·매우높음" value={highCount} danger />
        <Stat icon={Users} title="총 평가 건수" value={assessments.length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card><CardContent className="p-5">
          <h2 className="font-semibold mb-3">표준화 위험 분포 (5단계)</h2>
          {hazards.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">데이터 없음</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData.filter(d => d.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e: any) => `${e.name} ${e.value}`}>
                  {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent></Card>

        <Card><CardContent className="p-5">
          <h2 className="font-semibold mb-3">단지별 평가 현황</h2>
          {byComplex.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">데이터 없음</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byComplex}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="평가수" fill="oklch(0.42 0.18 262)" />
                <Bar dataKey="고위험" fill="oklch(0.58 0.23 27)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent></Card>
      </div>

      <Card><CardContent className="p-0">
        <div className="p-4 border-b font-semibold">단지 목록</div>
        <div className="divide-y">
          {complexes.map(c => {
            const list = assessments.filter(a => a.complex_id === c.id);
            return (
              <div key={c.id} className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-muted/40">
                <div className="min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{c.address} · {c.household_count}세대 · {c.mgmt_type}</div>
                </div>
                <div className="text-right text-xs">
                  <div className="font-semibold">{list.length}건</div>
                  <div className="text-muted-foreground">총 평가</div>
                </div>
              </div>
            );
          })}
          {complexes.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">단지가 없습니다.</div>}
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-5">
        <h2 className="font-semibold mb-2">표준화 환산 정책</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          단지별 평가가 어떤 방법(3단계/5단계/빈도강도/체크리스트/OPS)으로 진행되었든, 본사 콘솔에서는 5단계 표준 위험성수준으로 자동 환산되어 표시됩니다.
          원본 방법·점수는 함께 보존되어 감사 시 대응 가능합니다.
        </p>
        <ul className="text-xs text-muted-foreground mt-3 space-y-1">
          <li>· 3단계 → 5단계: 상=매우높음, 중=보통, 하=낮음</li>
          <li>· 빈도×강도: 1~4=매우낮음, 5~8=낮음, 9~12=보통, 13~16=높음, 17~25=매우높음</li>
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
