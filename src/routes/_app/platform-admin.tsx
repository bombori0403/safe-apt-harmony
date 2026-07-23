import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { platformDeleteOrganization, getPlatformUsage } from "@/lib/platform-admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Database, HardDrive, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Usage {
  db_bytes: number; storage_bytes: number; photo_count: number;
  assessments: number; organizations: number; users: number;
}
const FREE_DB = 500 * 1024 * 1024;      // Supabase 무료 DB 500MB
const FREE_STORAGE = 1024 * 1024 * 1024; // Supabase 무료 저장 1GB

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function UsageBar({ label, icon: Icon, used, limit }: { label: string; icon: any; used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const tier = pct >= 90 ? "bg-danger" : pct >= 70 ? "bg-warning" : "bg-primary";
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="flex items-center gap-1.5 font-medium"><Icon className="h-4 w-4 text-muted-foreground" />{label}</span>
        <span className="text-muted-foreground text-xs">{fmtBytes(used)} / {fmtBytes(limit)} <b className="text-foreground">({pct}%)</b></span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${tier} transition-all`} style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
    </div>
  );
}

function UsagePanel() {
  const fetchUsage = useServerFn(getPlatformUsage);
  const [u, setU] = useState<Usage | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true); setErr(null);
    try { setU(await fetchUsage() as Usage); }
    catch (e) { setErr(e instanceof Error ? e.message : "사용량을 불러오지 못했습니다."); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  return (
    <Card className="border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Supabase 실사용량</CardTitle>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="gap-1.5 h-8">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />새로고침
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {err && <p className="text-sm text-destructive">{err} (마이그레이션 실행 여부를 확인하세요: get_platform_usage)</p>}
        {!u && !err && <p className="text-sm text-muted-foreground">불러오는 중...</p>}
        {u && (
          <>
            <UsageBar label="데이터베이스" icon={Database} used={u.db_bytes} limit={FREE_DB} />
            <UsageBar label="사진 저장" icon={HardDrive} used={u.storage_bytes} limit={FREE_STORAGE} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
              {[
                { k: "사진", v: u.photo_count },
                { k: "평가", v: u.assessments },
                { k: "조직", v: u.organizations },
                { k: "계정", v: u.users },
              ].map((x) => (
                <div key={x.k} className="rounded-lg border bg-muted/20 py-2">
                  <div className="text-lg font-bold">{x.v.toLocaleString()}</div>
                  <div className="text-[11px] text-muted-foreground">{x.k}</div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              무료 한도 기준(DB 500MB · 저장 1GB). 70% 넘으면 주황, 90% 넘으면 빨강으로 표시됩니다.
              전송량(대역폭)은 SQL로 알 수 없어 Supabase 대시보드에서 확인하세요.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export const Route = createFileRoute("/_app/platform-admin")({
  component: PlatformAdmin,
});

interface OrgRow {
  id: string;
  name: string;
  approval_status: "pending" | "approved" | "rejected";
  created_at: string;
  representative_name: string | null;
  subscription_status: "trial" | "active" | "past_due" | "canceled";
  expires_at: string | null;
  activation_requested_at: string | null;
  business_number: string | null;
  phone: string | null;
}

function PlatformAdmin() {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { setAllowed(false); return; }
      const { data: me } = await supabase.from("users").select("is_platform_admin").eq("auth_id", auth.user.id).maybeSingle();
      setAllowed(!!me?.is_platform_admin);
    })();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name, approval_status, created_at, representative_name, subscription_status, expires_at, activation_requested_at, business_number, phone")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setOrgs((data as OrgRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (allowed) load();
  }, [allowed]);

  async function decide(id: string, approval_status: "pending" | "approved" | "rejected") {
    const { error } = await supabase.from("organizations").update({ approval_status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      approval_status === "approved" ? "승인 완료" : approval_status === "rejected" ? "거절 처리 완료" : "대기 상태로 되돌렸습니다"
    );
    load();
  }

  async function activate(id: string) {
    const { error } = await supabase
      .from("organizations")
      .update({ subscription_status: "active", expires_at: null, activation_requested_at: null, approval_status: "approved" })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("정식 활성화 완료 — 제한·워터마크가 해제됩니다");
    load();
  }

  async function dismissRequest(id: string) {
    const { error } = await supabase
      .from("organizations")
      .update({ activation_requested_at: null })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("신청을 보류 처리했습니다");
    load();
  }

  async function revertToTrial(id: string) {
    if (!window.confirm("이 회사를 다시 14일 체험 상태로 되돌릴까요? (오늘부터 14일)")) return;
    const expires = new Date(Date.now() + 14 * 86400000).toISOString();
    const { error } = await supabase
      .from("organizations")
      .update({ subscription_status: "trial", expires_at: expires })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("14일 체험 상태로 전환했습니다");
    load();
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`"${name}" 회사를 완전히 삭제할까요? 이 회사의 단지/평가 데이터와 소속 계정(로그인 포함)도 모두 삭제되며 되돌릴 수 없습니다.`)) return;
    try {
      await platformDeleteOrganization({ data: { orgId: id } });
      toast.success("삭제되었습니다 (소속 계정 포함)");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "삭제 중 오류가 발생했습니다");
    }
  }

  const pending = orgs.filter((o) => o.approval_status === "pending");
  const decided = orgs.filter((o) => o.approval_status !== "pending");
  const activationRequests = orgs.filter(
    (o) => o.activation_requested_at && o.subscription_status !== "active"
  );

  if (allowed === null) return <div className="p-8 text-muted-foreground">불러오는 중...</div>;
  if (!allowed) return (
    <div className="p-10 max-w-md mx-auto text-center space-y-3">
      <h1 className="text-xl font-bold">접근 권한이 없습니다</h1>
      <p className="text-sm text-muted-foreground">이 페이지는 플랫폼 관리자만 사용할 수 있습니다.</p>
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">가입 승인 · 활성화 요청</h1>
        <p className="text-sm text-muted-foreground mt-1">가입 회사 검토와, 체험 종료 후 정식 사용(활성화) 신청을 처리합니다.</p>
      </div>

      <UsagePanel />

      {loading ? (
        <p className="text-sm text-muted-foreground">불러오는 중...</p>
      ) : (
        <>
          <div>
            <h2 className="text-sm font-semibold text-primary mb-2">정식 사용 신청 ({activationRequests.length})</h2>
            {activationRequests.length === 0 && <p className="text-sm text-muted-foreground">대기 중인 활성화 신청이 없습니다.</p>}
            <div className="space-y-3">
              {activationRequests.map((o) => (
                <Card key={o.id} className="border-primary/30">
                  <CardContent className="flex items-center justify-between py-4 gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">{o.name}</div>
                      <div className="text-xs text-muted-foreground">
                        사업자 {o.business_number ?? "-"} · {o.representative_name ?? "-"} · {o.phone ?? "-"}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        신청 {o.activation_requested_at ? new Date(o.activation_requested_at).toLocaleString() : "-"}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" onClick={() => activate(o.id)}>활성화 승인</Button>
                      <Button size="sm" variant="outline" onClick={() => dismissRequest(o.id)}>보류</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">대기 중 ({pending.length})</h2>
            {pending.length === 0 && <p className="text-sm text-muted-foreground">대기 중인 가입이 없습니다.</p>}
            <div className="space-y-3">
              {pending.map((o) => (
                <Card key={o.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <div className="font-medium">{o.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {o.representative_name ?? "-"} · {new Date(o.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => decide(o.id, "approved")}>승인</Button>
                      <Button size="sm" variant="outline" onClick={() => decide(o.id, "rejected")}>거절</Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(o.id, o.name)} aria-label="삭제">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">전체 조직 · 구독 관리 ({decided.length})</h2>
            <p className="text-xs text-muted-foreground mb-3">체험 기간과 상관없이 언제든 정식 전환하거나 체험으로 되돌릴 수 있습니다.</p>
            <div className="space-y-2">
              {decided.map((o) => {
                const s = subInfo(o);
                return (
                  <div key={o.id} className="flex flex-wrap items-center justify-between text-sm py-2.5 border-b gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">{o.name}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge className={s.cls}>{s.label}</Badge>
                        {o.approval_status === "rejected" && <Badge variant="destructive">거절됨</Badge>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      {o.subscription_status !== "active" ? (
                        <Button size="sm" onClick={() => activate(o.id)}>정식 활성화</Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => revertToTrial(o.id)}>체험으로 전환</Button>
                      )}
                      {o.approval_status !== "rejected" ? (
                        <Button size="sm" variant="ghost" onClick={() => decide(o.id, "rejected")}>거절</Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => decide(o.id, "approved")}>거절 해제</Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => remove(o.id, o.name)} aria-label="삭제">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function subInfo(o: OrgRow): { label: string; cls: string } {
  if (o.subscription_status === "active") return { label: "정식", cls: "bg-success/15 text-success" };
  if (o.subscription_status === "past_due") return { label: "결제 필요", cls: "bg-warning/15 text-warning-foreground" };
  if (o.subscription_status === "canceled") return { label: "해지됨", cls: "bg-muted text-muted-foreground" };
  // trial
  const expMs = o.expires_at ? new Date(o.expires_at).getTime() : null;
  if (expMs != null && expMs > Date.now()) {
    const d = Math.ceil((expMs - Date.now()) / 86400000);
    return { label: `체험 D-${d}`, cls: "bg-primary/10 text-primary" };
  }
  return { label: "체험 종료", cls: "bg-danger/10 text-danger" };
}
