import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Printer, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
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

type Tone = "r" | "y" | "g" | "mut";
type Chip = { text: string; tone: Tone };

function daysDiff(dateISO: string | null): number | null {
  if (!dateISO) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const t = new Date(dateISO); t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - today.getTime()) / 86400000);
}

const isBadOpen = (it: any) => (it?.result === "미흡" || it?.result === "불량") && !it?.actionDone;

function ChipView({ chip }: { chip: Chip }) {
  const cls: Record<Tone, string> = {
    r: "bg-danger/15 text-danger",
    y: "bg-warning/15 text-warning",
    g: "bg-success/15 text-success",
    mut: "text-muted-foreground",
  };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${cls[chip.tone]}`}>{chip.text}</span>;
}

function Console() {
  const sub = useSubscription();
  const navigate = useNavigate();
  const [complexes, setComplexes] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [hazards, setHazards] = useState<any[]>([]);
  const [nearMiss, setNearMiss] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [tbms, setTbms] = useState<any[]>([]);
  const [educations, setEducations] = useState<any[]>([]);
  const [permits, setPermits] = useState<any[]>([]);
  const [onlyAction, setOnlyAction] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [c, a, h, nm, ins, tb, ed, wp] = await Promise.all([
        supabase.from("complexes").select("id,name,address,household_count,mgmt_type,manager_name,next_assessment_date,next_assessment_auto"),
        supabase.from("assessments").select("id,complex_id,status,assessment_date"),
        supabase.from("hazards").select("level_standardized,level,assessment_id"),
        (supabase as any).from("near_miss").select("complex_id,countermeasure_completed"),
        (supabase as any).from("safety_inspections").select("complex_id,status,items"),
        (supabase as any).from("tbm_meetings").select("complex_id,held_at"),
        (supabase as any).from("safety_educations").select("complex_id,status,edu_date"),
        (supabase as any).from("work_permits").select("complex_id,status"),
      ]);
      setComplexes(c.data ?? []);
      setAssessments(a.data ?? []);
      setHazards(h.data ?? []);
      setNearMiss(nm.data ?? []);
      setInspections(ins.data ?? []);
      setTbms(tb.data ?? []);
      setEducations(ed.data ?? []);
      setPermits(wp.data ?? []);
      setLoading(false);
    })();
  }, []);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStartStr = `${now.getFullYear()}-01-01`;

  // 단지별 종합 행
  const rows = useMemo(() => {
    const list = complexes.map((c) => {
      const aList = assessments.filter((a) => a.complex_id === c.id);
      const aIds = new Set(aList.map((a) => a.id));
      const hz = hazards.filter((h) => aIds.has(h.assessment_id));
      const high = hz.filter((h) => ["높음", "매우높음"].includes((h.level_standardized ?? h.level) as string)).length;

      const next = c.next_assessment_date ?? c.next_assessment_auto ?? null;
      const dd = daysDiff(next);
      const overdue = dd !== null && dd < 0;
      const soon = dd !== null && dd >= 0 && dd <= 30;

      const insp = inspections.filter((x) => x.complex_id === c.id);
      const openImp = insp.reduce((s, x) => s + (Array.isArray(x.items) ? x.items.filter(isBadOpen).length : 0), 0);
      const inspScheduled = insp.filter((x) => x.status !== "완료").length;

      const tbmList = tbms.filter((x) => x.complex_id === c.id);
      const tbmMonth = tbmList.filter((x) => new Date(x.held_at) >= monthStart).length;

      const eduYear = educations.filter((x) => x.complex_id === c.id && x.status === "완료" && (!x.edu_date || x.edu_date >= yearStartStr)).length;
      const nmOpen = nearMiss.filter((x) => x.complex_id === c.id && !x.countermeasure_completed).length;
      const permOpen = permits.filter((x) => x.complex_id === c.id && x.status !== "완료").length;

      const red = overdue || high > 0 || openImp > 0;
      const yellow = !red && (soon || inspScheduled > 0 || (tbmList.length > 0 && tbmMonth === 0) || nmOpen > 0);
      const status: Tone = red ? "r" : yellow ? "y" : "g";
      const score = (red ? 20000 : yellow ? 10000 : 0) + (overdue ? -dd! * 10 : 0) + high * 50 + openImp * 30 + nmOpen * 5;

      // 열별 칩
      const cReg: Chip = overdue ? { text: `기한초과 ${-dd!}일`, tone: "r" }
        : soon ? { text: `D-${dd}`, tone: "y" }
        : dd !== null ? { text: `D-${dd}`, tone: "g" }
        : { text: "미정", tone: "mut" };
      const cHigh: Chip = high > 0 ? { text: `${high}건`, tone: "r" } : { text: "0", tone: "g" };
      const cInsp: Chip = openImp > 0 ? { text: `개선 ${openImp} 대기`, tone: "r" }
        : inspScheduled > 0 ? { text: `예정 ${inspScheduled}`, tone: "y" }
        : insp.length > 0 ? { text: "완료", tone: "g" }
        : { text: "-", tone: "mut" };
      const cTbm: Chip = tbmMonth > 0 ? { text: `${tbmMonth}회`, tone: "g" }
        : tbmList.length > 0 ? { text: "이번달 0", tone: "y" }
        : { text: "-", tone: "mut" };
      const cEdu: Chip = eduYear > 0 ? { text: `${eduYear}회`, tone: "g" } : { text: "-", tone: "mut" };
      const cNm: Chip = nmOpen > 0 ? { text: `${nmOpen}건`, tone: "y" } : { text: "0", tone: "mut" };

      return { c, status, score, assessCount: aList.length, high, permOpen, cReg, cHigh, cInsp, cTbm, cEdu, cNm };
    });
    list.sort((a, b) => b.score - a.score);
    return list;
  }, [complexes, assessments, hazards, nearMiss, inspections, tbms, educations, permits]);

  const counts = useMemo(() => ({
    r: rows.filter((x) => x.status === "r").length,
    y: rows.filter((x) => x.status === "y").length,
    g: rows.filter((x) => x.status === "g").length,
  }), [rows]);

  const filtered = rows.filter((x) => {
    if (onlyAction && x.status === "g") return false;
    if (q.trim() && !x.c.name?.includes(q.trim())) return false;
    return true;
  });

  // 하단 차트 데이터
  const dist: Record<RiskLevel, number> = { 매우낮음: 0, 낮음: 0, 보통: 0, 높음: 0, 매우높음: 0 };
  hazards.forEach((h) => { const lvl = (h.level_standardized ?? h.level) as RiskLevel | null; if (lvl && lvl in dist) dist[lvl]++; });
  const pieData = (Object.keys(dist) as RiskLevel[]).map((k) => ({ name: k, value: dist[k], color: RISK_COLORS[k] }));
  const barData = rows.slice(0, 12).map((r) => {
    const nm = r.c.name ?? "";
    return { name: nm.length > 6 ? nm.slice(0, 6) + "…" : nm, 평가수: r.assessCount, 고위험: r.high };
  });

  function openComplex(id: string) {
    const to = new Date().toISOString().slice(0, 10);
    navigate({ to: "/print-all", search: { complex: id, from: yearStartStr, to } });
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-5">
      {sub.isTrial && <TrialWatermark expired={sub.isExpired} />}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">본사 콘솔</h1>
          <p className="text-sm text-muted-foreground mt-1">위탁관리회사 본사용 · 단지별 안전 현황을 한눈에</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" />인쇄</Button>
      </div>

      {/* 신호등 요약 스트립 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button type="button" onClick={() => setOnlyAction(true)} className="text-left">
          <Card className={counts.r > 0 ? "border-danger/40" : ""}><CardContent className="p-4">
            <div className="text-2xl font-bold text-danger">{counts.r}</div>
            <div className="text-xs text-danger mt-0.5">🔴 즉시 조치 필요</div>
          </CardContent></Card>
        </button>
        <button type="button" onClick={() => setOnlyAction(true)} className="text-left">
          <Card><CardContent className="p-4">
            <div className="text-2xl font-bold text-warning">{counts.y}</div>
            <div className="text-xs text-warning mt-0.5">🟡 주의</div>
          </CardContent></Card>
        </button>
        <Card><CardContent className="p-4">
          <div className="text-2xl font-bold text-success">{counts.g}</div>
          <div className="text-xs text-success mt-0.5">🟢 양호</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-2xl font-bold">{complexes.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">관리 단지</div>
        </CardContent></Card>
      </div>

      {/* 단지 현황 보드 */}
      <Card><CardContent className="p-0">
        <div className="p-4 border-b flex flex-wrap items-center justify-between gap-2">
          <div className="font-semibold">단지 안전 현황 <span className="text-xs text-muted-foreground font-normal">· 위험순 정렬</span></div>
          <div className="flex items-center gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="단지 검색" className="h-9 w-36" />
            <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={onlyAction} onChange={(e) => setOnlyAction(e.target.checked)} />조치 필요만
            </label>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{complexes.length === 0 ? "단지가 없습니다." : "조건에 맞는 단지가 없습니다."}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 760 }}>
              <thead>
                <tr className="text-[11px] text-muted-foreground bg-muted/40">
                  <th className="text-left font-semibold px-4 py-2.5">단지</th>
                  <th className="font-semibold px-2 py-2.5">정기평가</th>
                  <th className="font-semibold px-2 py-2.5">고위험</th>
                  <th className="font-semibold px-2 py-2.5">안전점검</th>
                  <th className="font-semibold px-2 py-2.5">TBM<br />(이번달)</th>
                  <th className="font-semibold px-2 py-2.5">안전교육<br />(올해)</th>
                  <th className="font-semibold px-2 py-2.5">아차사고<br />미조치</th>
                  <th className="font-semibold px-2 py-2.5">상태</th>
                  <th className="px-2 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.c.id} onClick={() => openComplex(r.c.id)}
                    className="border-t hover:bg-muted/40 cursor-pointer">
                    <td className="px-4 py-3 text-left">
                      <div className="font-semibold">{r.c.name}</div>
                      <div className="text-[10.5px] text-muted-foreground">
                        {r.c.household_count ? `${Number(r.c.household_count).toLocaleString()}세대` : ""}{r.c.manager_name ? ` · ${r.c.manager_name}` : ""}
                      </div>
                    </td>
                    <td className="px-2 py-3 text-center"><ChipView chip={r.cReg} /></td>
                    <td className="px-2 py-3 text-center"><ChipView chip={r.cHigh} /></td>
                    <td className="px-2 py-3 text-center"><ChipView chip={r.cInsp} /></td>
                    <td className="px-2 py-3 text-center"><ChipView chip={r.cTbm} /></td>
                    <td className="px-2 py-3 text-center"><ChipView chip={r.cEdu} /></td>
                    <td className="px-2 py-3 text-center"><ChipView chip={r.cNm} /></td>
                    <td className="px-2 py-3 text-center text-base">{r.status === "r" ? "🔴" : r.status === "y" ? "🟡" : "🟢"}</td>
                    <td className="px-2 py-3 text-center text-muted-foreground"><ChevronRight className="h-4 w-4 inline" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 py-2.5 text-[10.5px] text-muted-foreground border-t">
          🔴 기한초과·고위험·개선 지연 → 즉시 조치　🟡 임박·점검 예정·이번달 TBM 미실시·아차사고 미조치　🟢 정상 · 행 클릭 시 해당 단지 자료 출력
        </div>
      </CardContent></Card>

      {/* 보조 차트 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card><CardContent className="p-5">
          <h2 className="font-semibold mb-3">표준화 위험 분포 (5단계)</h2>
          {hazards.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">데이터 없음</div>
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie data={pieData.filter((d) => d.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e: any) => `${e.name} ${e.value}`}>
                  {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent></Card>

        <Card><CardContent className="p-5">
          <h2 className="font-semibold mb-3">단지별 평가·고위험 (상위 12)</h2>
          {barData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">데이터 없음</div>
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={barData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="평가수" fill="oklch(0.42 0.18 262)" />
                <Bar dataKey="고위험" fill="oklch(0.58 0.23 27)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent></Card>
      </div>

      <Card><CardContent className="p-5">
        <h2 className="font-semibold mb-2">표준화 환산 정책</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          단지별 평가가 어떤 방법(3단계/5단계/빈도강도/체크리스트/OPS)으로 진행되었든, 본사 콘솔에서는 5단계 표준 위험성수준으로 자동 환산되어 표시됩니다.
          원본 방법·점수는 함께 보존되어 감사 시 대응 가능합니다.
        </p>
      </CardContent></Card>
    </div>
  );
}
