import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
}

function PlatformAdmin() {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name, approval_status, created_at, representative_name")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setOrgs((data as OrgRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(id: string, approval_status: "approved" | "rejected") {
    const { error } = await supabase.from("organizations").update({ approval_status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(approval_status === "approved" ? "승인 완료" : "거절 처리 완료");
    load();
  }

  const pending = orgs.filter((o) => o.approval_status === "pending");
  const decided = orgs.filter((o) => o.approval_status !== "pending");

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">가입 승인</h1>
        <p className="text-sm text-muted-foreground mt-1">새로 등록된 회사를 검토하고 승인/거절합니다.</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">불러오는 중...</p>
      ) : (
        <>
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
                <div key={o.id} className="flex items-center justify-between text-sm py-2 border-b">
                  <span>{o.name}</span>
                  <Badge variant={o.approval_status === "approved" ? "default" : "destructive"}>
                    {o.approval_status === "approved" ? "승인됨" : "거절됨"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
