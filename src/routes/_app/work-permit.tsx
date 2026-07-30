import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileCheck2, CircleCheck, CircleAlert } from "lucide-react";

export const Route = createFileRoute("/_app/work-permit")({
  component: PermitList,
});

type Row = { id: string; permit_type: string; title: string; work_location: string | null; work_date: string | null; status: string; gas_required: boolean };

function PermitList() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [items, setItems] = useState<Row[]>([]);
  const [status, setStatus] = useState("전체");
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  if (path !== "/work-permit") return <Outlet />;

  async function load() {
    setLoading(true);
    let q = (supabase as any).from("work_permits").select("*").order("work_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
    if (status !== "전체") q = q.eq("status", status);
    const { data } = await q;
    setItems(data ?? []);
    setLoading(false);
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">작업허가서</h1>
          <p className="text-sm text-muted-foreground mt-1">고소·밀폐공간·화기 등 위험작업은 착수 전 점검·허가를 받고 기록합니다.</p>
        </div>
        <Link to="/work-permit/new">
          <Button className="gap-1.5"><Plus className="h-4 w-4" />허가서 작성</Button>
        </Link>
      </div>

      <Card><CardContent className="p-4">
        <label className="text-xs text-muted-foreground">상태</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full md:w-48 h-10 px-3 rounded-md border bg-background text-sm mt-1">
          {["전체", "신청", "승인", "완료"].map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </CardContent></Card>

      {loading ? (
        <div className="text-sm text-muted-foreground p-8 text-center">불러오는 중...</div>
      ) : items.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">
          작성된 작업허가서가 없습니다.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <Link key={it.id} to="/work-permit/$id" params={{ id: it.id }}>
              <Card className="hover:border-primary transition-colors">
                <CardContent className="p-4 flex gap-3 items-start">
                  <div className={`mt-0.5 p-1.5 rounded-md ${it.status === "완료" ? "bg-success/15 text-success" : it.status === "승인" ? "bg-primary/15 text-primary" : "bg-warning/15 text-warning"}`}>
                    {it.status === "완료" ? <CircleCheck className="h-4 w-4" /> : it.gas_required ? <CircleAlert className="h-4 w-4" /> : <FileCheck2 className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="px-1.5 py-0.5 rounded bg-muted font-medium">{it.permit_type}</span>
                      {it.work_date && <span>{it.work_date}</span>}
                      {it.work_location && <span>· {it.work_location}</span>}
                    </div>
                    <div className="mt-1 font-medium text-sm">{it.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{it.status}{it.gas_required && <span className="text-danger"> · 가스측정 필요</span>}</div>
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
