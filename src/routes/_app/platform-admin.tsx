import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { platformDeleteOrganization } from "@/lib/platform-admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

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
    load();
  }, []);

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

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">가입 승인 · 활성화 요청</h1>
        <p className="text-sm text-muted-foreground mt-1">가입 회사 검토와, 체험 종료 후 정식 사용(활성화) 신청을 처리합니다.</p>
      </div>

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
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">처리 완료</h2>
            <div className="space-y-2">
              {decided.map((o) => (
                <div key={o.id} className="flex items-center justify-between text-sm py-2 border-b gap-3">
                  <div>
                    <div>{o.name}</div>
                    <Badge variant={o.approval_status === "approved" ? "default" : "destructive"} className="mt-1">
                      {o.approval_status === "approved" ? "승인됨" : "거절됨"}
                    </Badge>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {o.approval_status !== "approved" && (
                      <Button size="sm" variant="outline" onClick={() => decide(o.id, "approved")}>승인</Button>
                    )}
                    {o.approval_status !== "rejected" && (
                      <Button size="sm" variant="outline" onClick={() => decide(o.id, "rejected")}>거절</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => decide(o.id, "pending")}>취소(대기로)</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(o.id, o.name)} aria-label="삭제">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
