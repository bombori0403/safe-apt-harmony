import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { riskLevelClass, type RiskLevel } from "@/lib/types";

export const Route = createFileRoute("/_app/history")({
  component: History,
});

function History() {
  const [items, setItems] = useState<any[]>([]);
  const [complexes, setComplexes] = useState<{ id: string; name: string }[]>([]);
  const [complexId, setComplexId] = useState<string>("");
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase.from("assessments").select("*").order("assessment_date", { ascending: false }).then(({ data }) => {
      setItems(data ?? []);
    });
    supabase.from("complexes").select("id,name").order("name").then(({ data }) => {
      setComplexes((data as any) ?? []);
    });
  }, []);

  const complexName = useMemo(() => {
    const m = new Map<string, string>();
    complexes.forEach(c => m.set(c.id, c.name));
    return m;
  }, [complexes]);

  const filtered = items.filter(i =>
    (!q || i.work_name?.includes(q)) &&
    (!complexId || i.complex_id === complexId)
  );

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold">평가 이력</h1>
        <p className="text-sm text-muted-foreground mt-1">
          위험성평가 결과는 3년간 보존하여야 합니다 (산업안전보건법 시행규칙).
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px]">
          <Label className="text-xs">단지</Label>
          <select
            value={complexId}
            onChange={e => setComplexId(e.target.value)}
            className="h-10 px-3 rounded-md border bg-background text-sm block w-full mt-1"
          >
            <option value="">전체 단지</option>
            {complexes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Label className="text-xs">검색</Label>
          <div className="relative mt-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={e=>setQ(e.target.value)} placeholder="작업명 검색..." className="pl-9" />
          </div>
        </div>
        <div className="text-xs text-muted-foreground ml-auto">총 {filtered.length}건</div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {filtered.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">기록이 없습니다.</div>
            )}
            {filtered.map(a => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 p-4 hover:bg-muted/40 transition-colors">
                <Link to="/assessment/$id" params={{ id: a.id }} className="flex-1 min-w-0">
                  <div className="font-medium truncate">{a.work_name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {complexName.get(a.complex_id) ?? "-"} · {a.assessment_date} · {a.method} · {a.work_category ?? "-"}
                  </div>
                </Link>
                <Badge variant="outline">{a.status}</Badge>
                {a.allowable_level && (
                  <span className={`px-2 py-1 rounded-md text-xs font-medium ${riskLevelClass(a.allowable_level as RiskLevel)}`}>
                    허용 {a.allowable_level}
                  </span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
