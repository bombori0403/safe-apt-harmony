import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getCurrentUserContext } from "@/lib/user-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarComp } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, AlertTriangle, Calendar, Users, TrendingUp, Building2, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

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
  complex_id?: string;
}

interface ComplexRow {
  id: string;
  name: string;
  next_assessment_date: string | null;
}

function Dashboard() {
  const { user } = useAuth();
  const [userRow, setUserRow] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [myComplexId, setMyComplexId] = useState<string | null>(null);
  const [complexes, setComplexes] = useState<ComplexRow[]>([]);
  const [selectedComplexId, setSelectedComplexId] = useState<string>("all");
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [nearMisses, setNearMisses] = useState<any[]>([]);
  const [workStops, setWorkStops] = useState<any[]>([]);
  const [employeeInputs, setEmployeeInputs] = useState<any[]>([]);
  const [unresolvedHigh, setUnresolvedHigh] = useState(0);
  const [monthCount, setMonthCount] = useState(0);
  const [nextDate, setNextDate] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Load user context once
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { userRow, complexId } = await getCurrentUserContext(user.id);
      setUserRow(userRow);
      const admin = userRow?.org_role === "admin";
      setIsAdmin(admin);
      setMyComplexId(complexId ?? null);

      if (admin) {
        const { data: cs } = await supabase
          .from("complexes")
          .select("id, name, next_assessment_date")
          .order("name");
        setComplexes((cs ?? []) as ComplexRow[]);
        setSelectedComplexId("all");
      } else if (complexId) {
        const { data: c } = await supabase
          .from("complexes")
          .select("id, name, next_assessment_date")
          .eq("id", complexId)
          .maybeSingle();
        if (c) setComplexes([c as ComplexRow]);
        setSelectedComplexId(complexId);
      }
    })();
  }, [user]);

  // Reload metrics when selection changes
  useEffect(() => {
    if (!user) return;
    (async () => {
      const scoped = selectedComplexId !== "all";

      let aQ = supabase.from("assessments").select("*").order("created_at", { ascending: false }).limit(20);
      if (scoped) aQ = aQ.eq("complex_id", selectedComplexId);
      const { data: a } = await aQ;
      setAssessments((a ?? []) as Assessment[]);

      let nmQ = supabase.from("near_miss").select("id, incident_name, situation, occurred_at, complex_id").order("occurred_at", { ascending: false }).limit(5);
      if (scoped) nmQ = nmQ.eq("complex_id", selectedComplexId);
      const { data: nm } = await nmQ;
      setNearMisses(nm ?? []);

      let wsQ = supabase.from("work_stop_records").select("id, work_description, exercised_at, exerciser_name, result, complex_id").order("exercised_at", { ascending: false }).limit(5);
      if (scoped) wsQ = wsQ.eq("complex_id", selectedComplexId);
      const { data: ws } = await wsQ;
      setWorkStops(ws ?? []);

      let eiQ = supabase
        .from("employee_inputs")
        .select("id, assessment_id, input_type, respondent_name, respondent_role, content, occurred_at, complex_id")
        .order("occurred_at", { ascending: false })
        .limit(5);
      if (scoped) eiQ = eiQ.eq("complex_id", selectedComplexId);
      const { data: ei } = await eiQ;
      setEmployeeInputs(ei ?? []);

      const startMonth = new Date(); startMonth.setDate(1); startMonth.setHours(0,0,0,0);
      let mQ = supabase.from("assessments").select("*", { count: "exact", head: true }).gte("created_at", startMonth.toISOString());
      if (scoped) mQ = mQ.eq("complex_id", selectedComplexId);
      const { count: mc } = await mQ;
      setMonthCount(mc ?? 0);

      if (scoped) {
        // Fetch hazards joined via assessments of selected complex
        const { data: aids } = await supabase.from("assessments").select("id").eq("complex_id", selectedComplexId);
        const ids = (aids ?? []).map((x: any) => x.id);
        if (ids.length === 0) {
          setUnresolvedHigh(0);
        } else {
          const { count: hc } = await supabase
            .from("hazards")
            .select("*", { count: "exact", head: true })
            .in("level", ["높음", "매우높음"])
            .in("assessment_id", ids);
          setUnresolvedHigh(hc ?? 0);
        }
      } else {
        const { count: hc } = await supabase
          .from("hazards")
          .select("*", { count: "exact", head: true })
          .in("level", ["높음", "매우높음"]);
        setUnresolvedHigh(hc ?? 0);
      }

      const cur = complexes.find((c) => c.id === selectedComplexId);
      if (cur?.next_assessment_date) setNextDate(new Date(cur.next_assessment_date));
      else setNextDate(undefined);
    })();
  }, [user, selectedComplexId, complexes]);

  const handleDateSelect = async (d: Date | undefined) => {
    setNextDate(d);
    setCalendarOpen(false);
    const targetComplex = selectedComplexId !== "all" ? selectedComplexId : myComplexId;
    if (!targetComplex) {
      toast.error("단지를 선택해주세요.");
      return;
    }
    const iso = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : null;
    const { error } = await supabase.from("complexes").update({ next_assessment_date: iso }).eq("id", targetComplex);
    if (error) toast.error("저장 실패: " + error.message);
    else {
      toast.success(d ? "다음 정기평가 날짜가 저장되었습니다." : "날짜가 해제되었습니다.");
      setComplexes((prev) => prev.map((c) => c.id === targetComplex ? { ...c, next_assessment_date: iso } : c));
    }
  };

  const nextDisplay = (() => {
    if (!nextDate) return { value: "미정", sub: "날짜 선택" };
    const today = new Date(); today.setHours(0,0,0,0);
    const target = new Date(nextDate); target.setHours(0,0,0,0);
    const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
    if (diff > 0) return { value: `D-${diff}`, sub: `${target.getMonth() + 1}/${target.getDate()}` };
    if (diff === 0) return { value: "D-DAY", sub: "오늘" };
    return { value: `D+${-diff}`, sub: "지남" };
  })();

  const currentComplexName = selectedComplexId === "all"
    ? "전체 단지"
    : complexes.find((c) => c.id === selectedComplexId)?.name ?? "";
  const isMember = userRow?.org_role === "member";
  const RowLink = ({ children, ...props }: any) =>
    isMember ? <div className={props.className}>{children}</div> : <Link {...props}>{children}</Link>;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex flex-wrap items-center gap-2">
            <span>안녕하세요, {userRow?.name ?? ""} {userRow?.job_title || userRow?.role || ""}님</span>
            {userRow?.org_role && (
              <Badge variant={userRow.org_role === "admin" ? "default" : userRow.org_role === "manager" ? "secondary" : "outline"} className="text-xs font-medium">
                {userRow.org_role === "admin" ? "관리자" : userRow.org_role === "manager" ? "매니저" : "일반"}
              </Badge>
            )}
          </h1>
          {currentComplexName && <p className="text-sm text-muted-foreground mt-1">{currentComplexName}</p>}
        </div>
        {userRow?.org_role !== "member" && (
          <Link to="/assessment/new">
            <Button size="lg" className="gap-2 shadow-md shadow-primary/20">
              <Plus className="h-5 w-5" /> 새 평가 시작
            </Button>
          </Link>
        )}
      </div>

      {isAdmin && complexes.length > 0 && (
        <Card>
          <CardContent className="p-3 md:p-4 flex items-center gap-3">
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground shrink-0">단지 보기:</span>
            <Select value={selectedComplexId} onValueChange={setSelectedComplexId}>
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 단지</SelectItem>
                {complexes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KpiCard title="이번 달 평가" value={monthCount} icon={TrendingUp} />
        <KpiCard title="높음·매우높음 미해결" value={unresolvedHigh} icon={AlertTriangle} danger />
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <button type="button" className="text-left" disabled={selectedComplexId === "all" || isMember}>
              <Card className={cn("transition-colors", selectedComplexId === "all" ? "opacity-60" : "hover:border-primary/40 cursor-pointer")}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between text-muted-foreground text-xs">
                    <span>다음 정기평가</span>
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div className="text-2xl md:text-3xl font-bold mt-2">
                    {selectedComplexId === "all" ? "—" : nextDisplay.value}
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      {selectedComplexId === "all" ? "단지 선택" : nextDisplay.sub}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComp
              mode="single"
              selected={nextDate}
              onSelect={handleDateSelect}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
            {nextDate && (
              <div className="p-2 border-t">
                <Button variant="ghost" size="sm" className="w-full" onClick={() => handleDateSelect(undefined)}>
                  날짜 해제
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
        <KpiCard title="참여 확인 대기" value={0} icon={Users} sub="명" />
      </div>

      <Card>
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">최근 평가</h2>
            {!isMember && <Link to="/history" className="text-sm text-primary hover:underline">전체 보기</Link>}
          </div>
          {assessments.length === 0 ? (
            <div className="text-center text-muted-foreground py-10 text-sm">아직 평가가 없습니다. "새 평가 시작" 버튼을 눌러보세요.</div>
          ) : (
            <div className="divide-y">
              {assessments.slice(0, 5).map((a) => (
                <RowLink key={a.id} to="/assessment/$id" params={{ id: a.id }} className="py-3 flex items-center justify-between gap-3 hover:bg-muted/30 -mx-2 px-2 rounded">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{a.work_name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {a.assessment_date} · {a.method}
                    </div>
                  </div>
                  <Badge variant="outline">{a.status}</Badge>
                </RowLink>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid xl:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">최근 직원 참여</h2>
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </div>
            {employeeInputs.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 text-sm">등록된 청취조사/오픈채팅 이력이 없습니다.</div>
            ) : (
              <div className="divide-y">
                {employeeInputs.map((it) => (
                  <Link key={it.id} to="/assessment/$id/inputs" params={{ id: it.assessment_id }} className="py-3 flex items-center justify-between gap-3 hover:bg-muted/30 -mx-2 px-2 rounded">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{it.input_type === "hearing" ? "청취조사" : "오픈채팅"}</Badge>
                        <span className="font-medium truncate">{it.respondent_name || it.respondent_role || "직원 의견"}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 truncate">
                        {it.occurred_at ? new Date(it.occurred_at).toLocaleDateString() : ""} · {it.content}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">최근 아차사고</h2>
              <Link to="/near-miss" className="text-sm text-primary hover:underline">전체 보기</Link>
            </div>
            {nearMisses.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 text-sm">등록된 아차사고가 없습니다.</div>
            ) : (
              <div className="divide-y">
                {nearMisses.map((n) => (
                  <Link key={n.id} to="/near-miss/$id" params={{ id: n.id }} className="py-3 flex items-center justify-between gap-3 hover:bg-muted/30 -mx-2 px-2 rounded">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{n.incident_name || n.situation}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {n.occurred_at ? new Date(n.occurred_at).toLocaleDateString() : ""}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">최근 작업중지권 행사</h2>
              <Link to="/work-stop-records" className="text-sm text-primary hover:underline">전체 보기</Link>
            </div>
            {workStops.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 text-sm">등록된 작업중지권 기록이 없습니다.</div>
            ) : (
              <div className="divide-y">
                {workStops.map((w) => (
                  <Link key={w.id} to="/work-stop-records_/$id" params={{ id: w.id }} className="py-3 flex items-center justify-between gap-3 hover:bg-muted/30 -mx-2 px-2 rounded">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{w.work_description}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {w.exercised_at ? new Date(w.exercised_at).toLocaleDateString() : ""} · {w.exerciser_name}
                      </div>
                    </div>
                    <Badge variant="outline">{w.result}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
