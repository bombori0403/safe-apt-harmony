import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Users, CircleCheck } from "lucide-react";
import { useComplexFilter } from "@/hooks/use-complex-filter";

export const Route = createFileRoute("/_app/tbm")({
  component: TbmList,
});

type Row = {
  id: string; title: string; held_at: string; location: string | null;
  attendees: any[]; hazards: any[]; status: string; edu_minutes: number;
};

function TbmList() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [items, setItems] = useState<Row[]>([]);
  const [days, setDays] = useState(90);
  const [loading, setLoading] = useState(true);
  const { complexes, filterComplex, setFilterComplex } = useComplexFilter();

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [days, filterComplex]);

  if (path !== "/tbm") return <Outlet />;

  async function load() {
    setLoading(true);
    const since = new Date(Date.now() - days * 86400_000).toISOString();
    let qb = (supabase as any).from("tbm_meetings").select("*").gte("held_at", since).order("held_at", { ascending: false });
    if (filterComplex !== "all") qb = qb.eq("complex_id", filterComplex);
    const { data } = await qb;
    setItems(data ?? []);
    setLoading(false);
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">작업 전 안전미팅(TBM)</h1>
          <p className="text-sm text-muted-foreground mt-1">매일 조회에서 건강상태와 위험요인·대책을 기록하고, 안전교육 시간으로 인정받습니다.</p>
        </div>
        <Link to="/tbm/new">
          <Button className="gap-1.5"><Plus className="h-4 w-4" />TBM 작성</Button>
        </Link>
      </div>

      <Card><CardContent className="p-4 flex flex-wrap gap-3">
        <div>
          <label className="text-xs text-muted-foreground">기간</label>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-full md:w-48 h-10 px-3 rounded-md border bg-background text-sm mt-1">
            <option value={30}>최근 30일</option>
            <option value={90}>최근 90일</option>
            <option value={180}>최근 6개월</option>
            <option value={365}>최근 12개월</option>
          </select>
        </div>
        {complexes.length > 1 && (
          <div>
            <label className="text-xs text-muted-foreground">단지</label>
            <select value={filterComplex} onChange={(e) => setFilterComplex(e.target.value)} className="w-full md:w-48 h-10 px-3 rounded-md border bg-background text-sm mt-1">
              <option value="all">전체 단지</option>
              {complexes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </CardContent></Card>

      {loading ? (
        <div className="text-sm text-muted-foreground p-8 text-center">불러오는 중...</div>
      ) : items.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">
          작성된 TBM이 없습니다. "TBM 작성"으로 시작하세요.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <Link key={it.id} to="/tbm/$id" params={{ id: it.id }}>
              <Card className="hover:border-primary transition-colors">
                <CardContent className="p-4 flex gap-3 items-start">
                  <div className={`mt-0.5 p-1.5 rounded-md ${it.status === "완료" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                    {it.status === "완료" ? <CircleCheck className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground">{new Date(it.held_at).toLocaleString("ko-KR")}{it.location && <> · {it.location}</>}</div>
                    <div className="mt-1 font-medium text-sm">{it.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      참석 {it.attendees?.length ?? 0}명 · 위험요인 {it.hazards?.length ?? 0}건
                      {it.edu_minutes > 0 && <> · 교육 {it.edu_minutes}분</>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
