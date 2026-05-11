import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { riskLevelClass, type RiskLevel } from "@/lib/types";
import { ListChecks, ShieldCheck, Users, FileText, Printer } from "lucide-react";

export const Route = createFileRoute("/_app/assessment/$id/")({
  component: Detail,
});

function Detail() {
  const { id } = Route.useParams();
  const [a, setA] = useState<any>(null);
  const [hazards, setHazards] = useState<any[]>([]);
  const [parts, setParts] = useState<any[]>([]);
  const [sigCount, setSigCount] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: ass } = await supabase.from("assessments").select("*").eq("id", id).maybeSingle();
      setA(ass);
      const { data: h } = await supabase.from("hazards").select("*, measures(*)").eq("assessment_id", id);
      setHazards(h ?? []);
      const { data: p } = await supabase.from("participants").select("*").eq("assessment_id", id);
      setParts(p ?? []);
      const { count } = await supabase.from("signatures").select("*", { count: "exact", head: true }).eq("assessment_id", id);
      setSigCount(count ?? 0);
    })();
  }, [id]);

  if (!a) return <div className="p-8 text-muted-foreground">불러오는 중...</div>;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="secondary">{a.method}</Badge>
            <Badge variant="outline">{a.assessment_type}</Badge>
            <Badge>{a.status}</Badge>
          </div>
          <h1 className="text-2xl font-bold mt-2">{a.work_name}</h1>
          <p className="text-sm text-muted-foreground">{a.assessment_date} · {a.location ?? "-"} · {a.work_category ?? "-"}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/assessment/$id/hazards" params={{ id }}><Button variant="outline" size="sm">유해·위험요인</Button></Link>
          <Link to="/assessment/$id/results" params={{ id }}><Button variant="outline" size="sm">위험성 결정</Button></Link>
          <Link to="/assessment/$id/measures" params={{ id }}><Button variant="outline" size="sm">감소대책</Button></Link>
          <Link to="/assessment/$id/share" params={{ id }}><Button size="sm">협의·공유</Button></Link>
          <Link to="/assessment/$id/report" params={{ id }}><Button size="sm" variant="secondary" className="gap-1"><Printer className="h-4 w-4" />결과서</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={ListChecks} title="유해·위험요인" value={hazards.length} />
        <Stat icon={ShieldCheck} title="감소대책 수립" value={hazards.reduce((s, h) => s + (h.measures?.length ?? 0), 0)} />
        <Stat icon={Users} title="참여자" value={parts.length} />
        <Stat icon={FileText} title="확인 서명" value={`${sigCount}/${parts.length}`} />
      </div>

      <Card><CardContent className="p-0">
        <div className="p-4 border-b font-semibold">유해·위험요인 목록</div>
        {hazards.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">아직 유해·위험요인이 없습니다.</div>
        ) : (
          <div className="divide-y">
            {hazards.map(h => (
              <div key={h.id} className="p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{h.description}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    감소대책 {h.measures?.length ?? 0}건
                    {h.likelihood && h.severity && ` · ${h.likelihood}×${h.severity}=${h.likelihood * h.severity}점`}
                  </div>
                </div>
                {h.level && (
                  <span className={`px-2 py-1 rounded text-xs font-medium ${riskLevelClass(h.level as RiskLevel)}`}>{h.level}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>
    </div>
  );
}

function Stat({ icon: Icon, title, value }: { icon: any; title: string; value: any }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground text-xs">
          <span>{title}</span><Icon className="h-4 w-4" />
        </div>
        <div className="text-2xl font-bold mt-1.5">{value}</div>
      </CardContent>
    </Card>
  );
}
