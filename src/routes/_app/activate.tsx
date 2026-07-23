import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { notifyActivationRequest } from "@/lib/notify.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Clock, Lock, CreditCard } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/activate")({
  component: Activate,
});

function Activate() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [org, setOrg] = useState<any>(null);

  const [orgName, setOrgName] = useState("");
  const [businessNumber, setBusinessNumber] = useState("");
  const [repName, setRepName] = useState("");
  const [phone, setPhone] = useState("");

  async function load() {
    if (!user) return;
    const { data: me } = await supabase
      .from("users")
      .select("organization_id, org_role")
      .eq("auth_id", user.id)
      .maybeSingle();
    setRole(me?.org_role ?? null);
    if (me?.organization_id) {
      const { data: o } = await supabase
        .from("organizations")
        .select("id, name, subscription_status, expires_at, activation_requested_at, business_number, phone, representative_name")
        .eq("id", me.organization_id)
        .maybeSingle();
      setOrg(o);
      setOrgName(o?.name ?? "");
      setBusinessNumber(o?.business_number ?? "");
      setRepName(o?.representative_name ?? "");
      setPhone(o?.phone ?? "");
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, [user]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          name: orgName.trim() || org.name,
          business_number: businessNumber.trim() || null,
          representative_name: repName.trim() || null,
          phone: phone.trim() || null,
          activation_requested_at: new Date().toISOString(),
        })
        .eq("id", org.id);
      if (error) throw error;
      notifyActivationRequest({
        data: { orgName: orgName.trim() || org.name, businessNumber, phone, repName },
      }).catch(() => {});
      toast.success("정식 사용 신청이 접수되었습니다. 승인 후 이용하실 수 있어요.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "신청 중 오류가 발생했습니다");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8 text-muted-foreground">불러오는 중...</div>;

  // 이미 정식(active) 상태
  if (org?.subscription_status === "active") {
    return (
      <Wrap>
        <div className="text-center space-y-4 py-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-success/10 text-success">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold">이미 정식 사용 중입니다</h1>
          <p className="text-sm text-muted-foreground">모든 기능을 제한 없이 이용할 수 있습니다.</p>
          <Link to="/dashboard"><Button>대시보드로</Button></Link>
        </div>
      </Wrap>
    );
  }

  // 관리자가 아님
  if (role !== "admin") {
    return (
      <Wrap>
        <div className="text-center space-y-4 py-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-muted text-muted-foreground">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold">관리자에게 문의하세요</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            정식 사용 신청은 회사(조직) 관리자만 할 수 있습니다.
            관리자에게 정식 전환을 요청해주세요.
          </p>
          <Link to="/dashboard"><Button variant="outline">대시보드로</Button></Link>
        </div>
      </Wrap>
    );
  }

  // 이미 신청 접수됨
  if (org?.activation_requested_at) {
    return (
      <Wrap>
        <div className="text-center space-y-4 py-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary">
            <Clock className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold">승인 대기 중입니다</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {new Date(org.activation_requested_at).toLocaleString("ko-KR")}에 정식 사용 신청이 접수되었습니다.
            결제 확인 및 관리자 승인 후 모든 기능이 열립니다.
          </p>
          <p className="text-xs text-muted-foreground">문의: get0412@gmail.com</p>
          <Link to="/dashboard"><Button variant="outline">대시보드로</Button></Link>
        </div>
      </Wrap>
    );
  }

  // 신청 폼
  return (
    <Wrap>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">정식 등록하고 계속 사용하기</h1>
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
          14일 무료 체험이 종료되었습니다. 카드·계좌로 바로 결제하면 즉시 전환되고,
          기존에 작성한 데이터는 그대로 유지됩니다.
        </p>
      </div>

      <Card className="mb-4 border-primary/50 bg-primary/[0.04]">
        <CardContent className="p-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-semibold">카드·계좌로 바로 결제하고 전환</div>
            <div className="text-sm text-muted-foreground mt-0.5">단지 세대수 구간에 따른 연간 정액. 결제 즉시 활성화됩니다.</div>
          </div>
          <Link to="/billing"><Button className="gap-1.5"><CreditCard className="h-4 w-4" />결제하고 전환</Button></Link>
        </CardContent>
      </Card>

      <div className="mb-4 text-xs text-muted-foreground text-center">또는 아래로 정식 사용을 신청하면 확인 후 활성화해 드립니다.</div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">사업자 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>회사 / 단지명</Label>
              <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} required maxLength={200} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>사업자등록번호</Label>
              <Input value={businessNumber} onChange={(e) => setBusinessNumber(e.target.value)} placeholder="000-00-00000" maxLength={50} className="h-11" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>담당자 이름</Label>
                <Input value={repName} onChange={(e) => setRepName(e.target.value)} maxLength={100} className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label>연락처</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" maxLength={50} className="h-11" />
              </div>
            </div>
            <Button type="submit" disabled={saving} className="w-full h-11 text-base mt-1">
              {saving ? "신청 중..." : "정식 사용 신청하기"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Wrap>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="p-4 md:p-8 max-w-lg mx-auto">{children}</div>;
}
