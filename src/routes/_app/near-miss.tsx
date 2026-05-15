import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_app/near-miss")({
  component: NearMissList,
});

const LOC_OPTIONS = ["전체","지하주차장","옥상","기계실","저수조","공용계단","엘리베이터","기타"];
const TYPE_OPTIONS = ["전체","전도","추락","끼임","감전","화재","중독","기타"];

function NearMissList() {
  const [items, setItems] = useState<any[]>([]);
  const [loc, setLoc] = useState("전체");
  const [type, setType] = useState("전체");
  const [days, setDays] = useState(365);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [loc, type, days]);

  async function load() {
    setLoading(true);
    const since = new Date(Date.now() - days * 86400_000).toISOString();
    let q = (supabase as any).from("near_miss").select("*").gte("occurred_at", since).order("occurred_at", { ascending: false });
    if (loc !== "전체") q = q.eq("location_category", loc);
    if (type !== "전체") q = q.eq("incident_type", type);
    const { data } = await q;
    setItems(data ?? []);
    setLoading(false);
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">아차사고 신고 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">사업장 내 아차사고 기록을 위험성평가에 반영합니다.</p>
        </div>
        <Link to="/near-miss/new">
          <Button className="gap-1.5"><Plus className="h-4 w-4" />신규 신고</Button>
        </Link>
      </div>

      <Card><CardContent className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">기간</label>
          <select value={days} onChange={e=>setDays(Number(e.target.value))} className="w-full h-10 px-3 rounded-md border bg-background text-sm mt-1">
            <option value={30}>최근 30일</option>
            <option value={90}>최근 90일</option>
            <option value={180}>최근 6개월</option>
            <option value={365}>최근 12개월</option>
            <option value={3650}>전체</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">발생 장소</label>
          <select value={loc} onChange={e=>setLoc(e.target.value)} className="w-full h-10 px-3 rounded-md border bg-background text-sm mt-1">
            {LOC_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">사고 유형</label>
          <select value={type} onChange={e=>setType(e.target.value)} className="w-full h-10 px-3 rounded-md border bg-background text-sm mt-1">
            {TYPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </CardContent></Card>

      {loading ? (
        <div className="text-sm text-muted-foreground p-8 text-center">불러오는 중...</div>
      ) : items.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">
          등록된 아차사고가 없습니다.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {items.map((it: any) => (
            <Link key={it.id} to="/near-miss/$id" params={{ id: it.id }}>
              <Card className="hover:border-primary transition-colors">
                <CardContent className="p-4 flex gap-3 items-start">
                  <div className={`mt-0.5 p-1.5 rounded-md ${it.countermeasure_completed ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{new Date(it.occurred_at).toLocaleString("ko-KR")}</span>
                      {it.location_category && <span>· {it.location_category}</span>}
                      {it.incident_type && <span>· {it.incident_type}</span>}
                    </div>
                    <div className="mt-1 font-medium text-sm line-clamp-2">{it.situation}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {it.countermeasure_completed ? "조치 완료" : it.countermeasure ? "조치 중" : "조치 필요"}
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
