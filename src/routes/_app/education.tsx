import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, GraduationCap, CircleCheck, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_app/education")({
  component: EducationList,
});

type Row = {
  id: string; title: string; category: string; method: string; edu_date: string | null;
  duration_minutes: number; status: string; attendees: any[];
};

function fmtMin(m: number) {
  const h = Math.floor(m / 60), min = m % 60;
  return h > 0 ? `${h}시간${min ? " " + min + "분" : ""}` : `${min}분`;
}

function EducationList() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [items, setItems] = useState<Row[]>([]);
  const [tally, setTally] = useState<{ name: string; role: string; eduMin: number; tbmMin: number }[]>([]);
  const [showTally, setShowTally] = useState(false);
  const [loading, setLoading] = useState(true);
  const year = new Date().getFullYear();

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  if (path !== "/education") return <Outlet />;

  async function load() {
    setLoading(true);
    const { data: edus } = await (supabase as any).from("safety_educations").select("*").order("edu_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
    setItems(edus ?? []);

    // 이수현황: 올해 교육(완료분)과 TBM(edu_minutes)을 이름 기준으로 "각각" 집계(합치지 않음)
    const start = new Date(year, 0, 1).toISOString();
    const map = new Map<string, { name: string; role: string; eduMin: number; tbmMin: number }>();
    const add = (name: string, role: string, kind: "edu" | "tbm", minutes: number) => {
      if (!name) return;
      const key = name.trim();
      const cur = map.get(key) ?? { name: key, role, eduMin: 0, tbmMin: 0 };
      if (kind === "edu") cur.eduMin += minutes; else cur.tbmMin += minutes;
      if (!cur.role && role) cur.role = role;
      map.set(key, cur);
    };
    for (const e of (edus ?? []) as Row[]) {
      if (e.status !== "완료") continue;
      if (e.edu_date && e.edu_date < start.slice(0, 10)) continue;
      for (const a of (e.attendees ?? []) as any[]) if (a.completed) add(a.name, a.role, "edu", e.duration_minutes || 0);
    }
    const { data: tbms } = await (supabase as any).from("tbm_meetings").select("held_at,edu_minutes,attendees,status").gte("held_at", start);
    for (const t of (tbms ?? []) as any[]) {
      if (!t.edu_minutes) continue;
      for (const a of (t.attendees ?? []) as any[]) add(a.name, a.role, "tbm", t.edu_minutes || 0);
    }
    setTally([...map.values()].sort((a, b) => (b.eduMin + b.tbmMin) - (a.eduMin + a.tbmMin)));
    setLoading(false);
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">안전보건교육</h1>
          <p className="text-sm text-muted-foreground mt-1">법정 교육을 실시·기록하고 이수현황을 관리합니다. 교육과 TBM 시간은 각각 따로 표시됩니다.</p>
        </div>
        <Link to="/education/new">
          <Button className="gap-1.5"><Plus className="h-4 w-4" />교육 등록</Button>
        </Link>
      </div>

      {/* 이수현황 요약 */}
      <Card>
        <CardContent className="p-4">
          <button type="button" onClick={() => setShowTally((v) => !v)} className="w-full flex items-center justify-between">
            <span className="flex items-center gap-2 font-medium text-sm"><BarChart3 className="h-4 w-4 text-primary" />{year}년 개인별 이수시간 ({tally.length}명)</span>
            <span className="text-xs text-muted-foreground">{showTally ? "접기" : "펼치기"}</span>
          </button>
          {showTally && (
            tally.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-3">아직 이수 기록이 없습니다. 교육을 완료 처리하거나 TBM에 교육시간을 입력하세요.</p>
            ) : (
              <div className="mt-3">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground pb-1.5 border-b">
                  <span className="flex-1">이름</span>
                  <span className="w-20 text-right">교육</span>
                  <span className="w-20 text-right">TBM</span>
                </div>
                <div className="divide-y">
                  {tally.map((t) => (
                    <div key={t.name} className="flex items-center gap-2 text-sm py-1.5">
                      <span className="flex-1 min-w-0 truncate"><span className="font-medium">{t.name}</span>{t.role && <span className="text-xs text-muted-foreground ml-1.5">{t.role}</span>}</span>
                      <span className="w-20 text-right tabular-nums">{t.eduMin > 0 ? fmtMin(t.eduMin) : <span className="text-muted-foreground">-</span>}</span>
                      <span className="w-20 text-right tabular-nums text-muted-foreground">{t.tbmMin > 0 ? fmtMin(t.tbmMin) : "-"}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground pt-2">‘교육’은 안전보건교육 완료분, ‘TBM’은 작업 전 안전미팅 인정시간입니다. 실제 법정 이수 기준은 직종에 따라 다르니 담당자가 확인하세요.</p>
              </div>
            )
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-sm text-muted-foreground p-8 text-center">불러오는 중...</div>
      ) : items.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">등록된 교육이 없습니다.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {items.map((it) => {
            const done = it.status === "완료";
            const completed = (it.attendees ?? []).filter((a: any) => a.completed).length;
            return (
              <Link key={it.id} to="/education/$id" params={{ id: it.id }}>
                <Card className="hover:border-primary transition-colors">
                  <CardContent className="p-4 flex gap-3 items-start">
                    <div className={`mt-0.5 p-1.5 rounded-md ${done ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                      {done ? <CircleCheck className="h-4 w-4" /> : <GraduationCap className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="px-1.5 py-0.5 rounded bg-muted font-medium">{it.category}</span>
                        <span>{it.method}</span>
                        {it.edu_date && <span>· {it.edu_date}</span>}
                      </div>
                      <div className="mt-1 font-medium text-sm">{it.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {it.status} · {fmtMin(it.duration_minutes)} · 이수 {completed}/{it.attendees?.length ?? 0}명
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
