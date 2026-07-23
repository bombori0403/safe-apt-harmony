import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getPlatformUsage, getUsageBreakdown, getMyOrgUsage } from "@/lib/platform-admin.functions";
import { STORAGE_LIMIT_PER_COMPLEX_BYTES, STORAGE_LIMIT_PER_COMPLEX_LABEL, STORAGE_OVERAGE_NOTICE } from "@/lib/pricing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, HardDrive, RefreshCw, Info } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";

export const Route = createFileRoute("/_app/data-usage")({ component: DataUsage });

const FREE_DB = 500 * 1024 * 1024;
const FREE_STORAGE = 1024 * 1024 * 1024;
const BAR = "oklch(0.42 0.18 262)";
const BAR2 = "oklch(0.58 0.23 27)";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
const toMB = (n: number) => Math.round((n / 1024 / 1024) * 100) / 100;

function UsageBar({ label, icon: Icon, used, limit }: { label: string; icon?: any; used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const tier = pct >= 90 ? "bg-danger" : pct >= 70 ? "bg-warning" : "bg-primary";
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="flex items-center gap-1.5 font-medium">{Icon && <Icon className="h-4 w-4 text-muted-foreground" />}{label}</span>
        <span className="text-muted-foreground text-xs">{fmtBytes(used)} / {fmtBytes(limit)} <b className="text-foreground">({pct}%)</b></span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${tier} transition-all`} style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function OverageNotice() {
  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardContent className="p-4 flex items-start gap-2.5 text-sm">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
        <p className="text-muted-foreground leading-relaxed">{STORAGE_OVERAGE_NOTICE}</p>
      </CardContent>
    </Card>
  );
}

function useRole() {
  const [role, setRole] = useState<{ platform: boolean; admin: boolean } | null>(null);
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { setRole({ platform: false, admin: false }); return; }
      const { data: me } = await supabase.from("users").select("is_platform_admin, org_role").eq("auth_id", auth.user.id).maybeSingle();
      setRole({ platform: !!me?.is_platform_admin, admin: me?.org_role === "admin" });
    })();
  }, []);
  return role;
}

function DataUsage() {
  const role = useRole();
  if (role === null) return <div className="p-8 text-muted-foreground">불러오는 중...</div>;
  if (role.platform) return <PlatformUsage />;
  if (role.admin) return <OrgUsage />;
  return (
    <div className="p-10 max-w-md mx-auto text-center space-y-3">
      <h1 className="text-xl font-bold">접근 권한이 없습니다</h1>
      <p className="text-sm text-muted-foreground">사용량은 회사 관리자 또는 플랫폼 관리자만 볼 수 있습니다.</p>
    </div>
  );
}

// ── 회사 관리자: 본인 회사의 단지별 사용량 ───────────────────────────────
function OrgUsage() {
  const fetchMine = useServerFn(getMyOrgUsage);
  const [d, setD] = useState<Awaited<ReturnType<typeof getMyOrgUsage>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true); setErr(null);
    try { setD(await fetchMine() as any); }
    catch (e) { setErr(e instanceof Error ? e.message : "사용량을 불러오지 못했습니다."); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const complexes = [...(d?.complexes ?? [])].sort((a, b) => b.storage_bytes - a.storage_bytes);
  const perQuota = STORAGE_LIMIT_PER_COMPLEX_BYTES;
  const orgQuota = complexes.length * perQuota;
  const orgUsed = d?.org?.storage_bytes ?? 0;
  const chart = complexes.map((c) => ({ name: c.name, MB: toMB(c.storage_bytes) }));

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">우리 회사 사용량</h1>
          <p className="text-sm text-muted-foreground mt-1">단지별 사진 저장용량과 활동을 한눈에 확인합니다.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />새로고침
        </Button>
      </div>

      <OverageNotice />

      {err && <Card className="border-destructive"><CardContent className="p-4 text-sm text-destructive">{err}</CardContent></Card>}
      {!d && !err && <p className="text-sm text-muted-foreground">불러오는 중...</p>}

      {d && (
        <>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">전체 저장용량 (기본 제공 대비)</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <UsageBar label={`우리 회사 사진 저장 (단지 ${complexes.length}개 × ${STORAGE_LIMIT_PER_COMPLEX_LABEL})`} icon={HardDrive} used={orgUsed} limit={orgQuota} />
              <p className="text-[11px] text-muted-foreground">기본 제공은 단지당 {STORAGE_LIMIT_PER_COMPLEX_LABEL}입니다. 70% 넘으면 주황, 90% 넘으면 빨강으로 표시됩니다.</p>
            </CardContent>
          </Card>

          {chart.length > 0 && (
            <ChartCard title="단지별 사진 저장용량 (MB)">
              <ResponsiveContainer width="100%" height={Math.max(180, chart.length * 42)}>
                <BarChart data={chart} layout="vertical" margin={{ left: 8, right: 12 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => [`${v} MB`, "저장"]} />
                  <Bar dataKey="MB" fill={BAR} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">단지별 상세</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead><tr className="text-muted-foreground text-left border-b">
                  <th className="py-2 pr-2">단지</th><th className="py-2 px-2 text-right">세대수</th><th className="py-2 px-2 text-right">평가</th>
                  <th className="py-2 px-2 text-right">위험요인</th><th className="py-2 px-2 text-right">아차사고</th><th className="py-2 pl-2 min-w-[160px]">사진 저장 (기본 {STORAGE_LIMIT_PER_COMPLEX_LABEL})</th>
                </tr></thead>
                <tbody className="divide-y">
                  {complexes.map((c) => {
                    const pct = Math.min(100, Math.round((c.storage_bytes / perQuota) * 100));
                    const tier = pct >= 90 ? "bg-danger" : pct >= 70 ? "bg-warning" : "bg-primary";
                    return (
                      <tr key={c.id}>
                        <td className="py-2 pr-2 font-medium truncate max-w-[140px]">{c.name}</td>
                        <td className="py-2 px-2 text-right">{(c.household_count ?? 0).toLocaleString()}</td>
                        <td className="py-2 px-2 text-right">{c.assessments}</td>
                        <td className="py-2 px-2 text-right">{c.hazards}</td>
                        <td className="py-2 px-2 text-right">{c.near_miss}</td>
                        <td className="py-2 pl-2">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden min-w-[70px]">
                              <div className={`h-full ${tier}`} style={{ width: `${Math.max(2, pct)}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{fmtBytes(c.storage_bytes)}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {complexes.length === 0 && (
                    <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">등록된 단지가 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
              <p className="text-[11px] text-muted-foreground mt-3">사진 저장은 평가에 첨부한 사진 기준입니다. 아차사고·작업중지 사진은 회사 전체 합계에만 포함됩니다.</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ── 플랫폼 관리자: 전체 업체·단지 사용량 ─────────────────────────────────
interface Totals { db_bytes: number; storage_bytes: number; photo_count: number; assessments: number; organizations: number; users: number }
type Breakdown = Awaited<ReturnType<typeof getUsageBreakdown>>;

function PlatformUsage() {
  const fetchTotals = useServerFn(getPlatformUsage);
  const fetchBreakdown = useServerFn(getUsageBreakdown);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [bd, setBd] = useState<Breakdown | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"org" | "complex">("org");

  async function load() {
    setLoading(true); setErr(null);
    try {
      const [t, b] = await Promise.all([fetchTotals(), fetchBreakdown()]);
      setTotals(t as Totals); setBd(b as Breakdown);
    } catch (e) { setErr(e instanceof Error ? e.message : "사용량을 불러오지 못했습니다."); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const orgs = [...(bd?.orgs ?? [])].sort((a, b) => b.storage_bytes - a.storage_bytes);
  const complexes = [...(bd?.complexes ?? [])].sort((a, b) => b.storage_bytes - a.storage_bytes);
  const orgStorage = orgs.map((o) => ({ name: o.name, MB: toMB(o.storage_bytes) }));
  const orgActivity = orgs.map((o) => ({ name: o.name, 평가: o.assessments, 아차사고: o.near_miss }));
  const cxStorage = complexes.slice(0, 12).map((c) => ({ name: c.name, MB: toMB(c.storage_bytes) }));
  const cxActivity = complexes.slice(0, 12).map((c) => ({ name: c.name, 평가: c.assessments, 위험요인: c.hazards }));

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">데이터 사용량 (전체)</h1>
          <p className="text-sm text-muted-foreground mt-1">서버 자원과 업체·단지별 사용 현황을 확인합니다.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />새로고침
        </Button>
      </div>

      <OverageNotice />

      {err && <Card className="border-destructive"><CardContent className="p-4 text-sm text-destructive">{err}<div className="text-xs text-muted-foreground mt-1">마이그레이션 실행 여부를 확인하세요: get_platform_usage / get_usage_breakdown</div></CardContent></Card>}

      {totals && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">전체 사용량 (무료 한도 대비)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <UsageBar label="데이터베이스" icon={Database} used={totals.db_bytes} limit={FREE_DB} />
            <UsageBar label="사진 저장" icon={HardDrive} used={totals.storage_bytes} limit={FREE_STORAGE} />
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-1 text-center">
              {[{ k: "업체", v: totals.organizations }, { k: "계정", v: totals.users }, { k: "평가", v: totals.assessments }, { k: "사진", v: totals.photo_count }].map((x) => (
                <div key={x.k} className="rounded-lg border bg-muted/20 py-2">
                  <div className="text-lg font-bold">{x.v.toLocaleString()}</div>
                  <div className="text-[11px] text-muted-foreground">{x.k}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {bd && (
        <div className="grid lg:grid-cols-2 gap-4">
          <ChartCard title="업체별 사진 저장용량 (MB)">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={orgStorage} layout="vertical" margin={{ left: 8, right: 12 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => [`${v} MB`, "저장"]} />
                <Bar dataKey="MB" fill={BAR} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="업체별 활동 (평가 · 아차사고)">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={orgActivity}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="평가" fill={BAR} /><Bar dataKey="아차사고" fill={BAR2} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {bd && (
        <div className="grid lg:grid-cols-2 gap-4">
          <ChartCard title="단지별 사진 저장용량 (MB · 상위 12)">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={cxStorage} layout="vertical" margin={{ left: 8, right: 12 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => [`${v} MB`, "저장"]} />
                <Bar dataKey="MB" fill={BAR} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="단지별 활동 (평가 · 위험요인 · 상위 12)">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={cxActivity}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="평가" fill={BAR} /><Bar dataKey="위험요인" fill={BAR2} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {bd && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">상세 표</CardTitle>
            <div className="flex rounded-md border overflow-hidden text-xs">
              <button className={`px-3 py-1.5 ${tab === "org" ? "bg-primary text-primary-foreground" : "bg-background"}`} onClick={() => setTab("org")}>업체별</button>
              <button className={`px-3 py-1.5 border-l ${tab === "complex" ? "bg-primary text-primary-foreground" : "bg-background"}`} onClick={() => setTab("complex")}>단지별</button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {tab === "org" ? (
              <table className="w-full text-sm min-w-[560px]">
                <thead><tr className="text-muted-foreground text-left border-b">
                  <th className="py-2 pr-2">업체</th><th className="py-2 px-2 text-right">단지</th><th className="py-2 px-2 text-right">평가</th>
                  <th className="py-2 px-2 text-right">위험요인</th><th className="py-2 px-2 text-right">아차사고</th><th className="py-2 px-2 text-right">계정</th><th className="py-2 pl-2 text-right">사진 저장</th>
                </tr></thead>
                <tbody className="divide-y">
                  {orgs.map((o) => (
                    <tr key={o.id}>
                      <td className="py-2 pr-2 font-medium truncate max-w-[160px]">{o.name}</td>
                      <td className="py-2 px-2 text-right">{o.complexes}</td>
                      <td className="py-2 px-2 text-right">{o.assessments}</td>
                      <td className="py-2 px-2 text-right">{o.hazards}</td>
                      <td className="py-2 px-2 text-right">{o.near_miss}</td>
                      <td className="py-2 px-2 text-right">{o.users}</td>
                      <td className="py-2 pl-2 text-right font-medium">{fmtBytes(o.storage_bytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm min-w-[560px]">
                <thead><tr className="text-muted-foreground text-left border-b">
                  <th className="py-2 pr-2">단지</th><th className="py-2 px-2">업체</th><th className="py-2 px-2 text-right">세대수</th>
                  <th className="py-2 px-2 text-right">평가</th><th className="py-2 px-2 text-right">위험요인</th><th className="py-2 px-2 text-right">아차사고</th><th className="py-2 pl-2 text-right">사진 저장</th>
                </tr></thead>
                <tbody className="divide-y">
                  {complexes.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2 pr-2 font-medium truncate max-w-[140px]">{c.name}</td>
                      <td className="py-2 px-2 text-muted-foreground truncate max-w-[120px]">{c.org_name ?? "-"}</td>
                      <td className="py-2 px-2 text-right">{(c.household_count ?? 0).toLocaleString()}</td>
                      <td className="py-2 px-2 text-right">{c.assessments}</td>
                      <td className="py-2 px-2 text-right">{c.hazards}</td>
                      <td className="py-2 px-2 text-right">{c.near_miss}</td>
                      <td className="py-2 pl-2 text-right font-medium">{fmtBytes(c.storage_bytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
              사진 저장은 매핑 가능한 것만 집계 — 업체별=평가+아차사고 사진, 단지별=평가 사진. 작업중지 사진은 제외.
              DB 용량은 전체 단일 수치라 위 총량만 참고하세요.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
