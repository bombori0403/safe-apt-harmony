import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ClipboardCheck, CircleAlert, CircleCheck, CalendarClock } from "lucide-react";

export const Route = createFileRoute("/_app/safety-inspection")({
  component: InspectionList,
});

const CAT_FILTER = ["전체", "승강기", "소방시설", "전기실·기계실", "저수조", "놀이터", "지하주차장", "옥상·외벽", "공용부(계단·복도)", "제설·수목(계절)"];

type Row = {
  id: string; title: string; inspection_type: string; checklist_category: string | null;
  scheduled_date: string | null; performed_at: string | null; status: string; items: any[];
};

function summarize(items: any[]) {
  const total = items?.length ?? 0;
  const bad = (items ?? []).filter((i) => i.result === "미흡" || i.result === "불량");
  const openActions = bad.filter((i) => !i.actionDone).length;
  return { total, badCount: bad.length, openActions };
}

function InspectionList() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [items, setItems] = useState<Row[]>([]);
  const [cat, setCat] = useState("전체");
  const [status, setStatus] = useState("전체");
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [cat, status]);

  if (path !== "/safety-inspection") return <Outlet />;

  async function load() {
    setLoading(true);
    let q = (supabase as any).from("safety_inspections").select("*").order("scheduled_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
    if (cat !== "전체") q = q.eq("checklist_category", cat);
    if (status !== "전체") q = q.eq("status", status);
    const { data } = await q;
    setItems(data ?? []);
    setLoading(false);
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">안전점검</h1>
          <p className="text-sm text-muted-foreground mt-1">공용시설 점검을 체크리스트로 실시하고 미흡·불량 항목을 개선까지 추적합니다.</p>
        </div>
        <Link to="/safety-inspection/new">
          <Button className="gap-1.5"><Plus className="h-4 w-4" />점검 만들기</Button>
        </Link>
      </div>

      <Card><CardContent className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">시설 분류</label>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="w-full h-10 px-3 rounded-md border bg-background text-sm mt-1">
            {CAT_FILTER.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">상태</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full h-10 px-3 rounded-md border bg-background text-sm mt-1">
            {["전체", "예정", "진행중", "완료"].map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </CardContent></Card>

      {loading ? (
        <div className="text-sm text-muted-foreground p-8 text-center">불러오는 중...</div>
      ) : items.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">
          등록된 점검이 없습니다. 오른쪽 위 "점검 만들기"로 시작하세요.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {items.map((it) => {
            const s = summarize(it.items);
            const done = it.status === "완료";
            const hasOpen = s.openActions > 0;
            return (
              <Link key={it.id} to="/safety-inspection/$id" params={{ id: it.id }}>
                <Card className="hover:border-primary transition-colors">
                  <CardContent className="p-4 flex gap-3 items-start">
                    <div className={`mt-0.5 p-1.5 rounded-md ${done && !hasOpen ? "bg-success/15 text-success" : hasOpen ? "bg-danger/15 text-danger" : "bg-warning/15 text-warning"}`}>
                      {done && !hasOpen ? <CircleCheck className="h-4 w-4" /> : hasOpen ? <CircleAlert className="h-4 w-4" /> : it.status === "예정" ? <CalendarClock className="h-4 w-4" /> : <ClipboardCheck className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {it.checklist_category && <span>{it.checklist_category}</span>}
                        <span>· {it.inspection_type}</span>
                        {it.scheduled_date && <span>· 예정 {it.scheduled_date}</span>}
                      </div>
                      <div className="mt-1 font-medium text-sm">{it.title}</div>
                      <div className="mt-1 text-xs">
                        <span className="text-muted-foreground">{it.status}</span>
                        {s.total > 0 && <span className="text-muted-foreground"> · 항목 {s.total}개</span>}
                        {s.badCount > 0 && (
                          <span className={hasOpen ? "text-danger font-medium" : "text-success"}>
                            {" "}· 개선 {s.badCount - s.openActions}/{s.badCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
