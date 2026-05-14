import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getCurrentUserContext } from "@/lib/user-context";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  component: Settings,
});

function Settings() {
  const { user, signOut } = useAuth();
  const [userRow, setUserRow] = useState<any>(null);
  const [complex, setComplex] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { userRow, complexId } = await getCurrentUserContext(user.id);
      setUserRow(userRow);
      if (complexId) {
        const { data: c } = await supabase.from("complexes").select("*").eq("id", complexId).maybeSingle();
        setComplex(c);
        if (c?.company_id) {
          const { data: co } = await supabase.from("companies").select("*").eq("id", c.company_id).maybeSingle();
          setCompany(co ?? { name: "", business_number: "", phone: "", address: "" });
        } else {
          setCompany({ name: "", business_number: "", phone: "", address: "" });
        }
      }
    })();
  }, [user]);

  const [savingUser, setSavingUser] = useState(false);
  async function saveUser() {
    if (!userRow) return;
    setSavingUser(true);
    const { error } = await supabase.from("users").update({
      name: userRow.name, role: userRow.role, phone: userRow.phone,
    }).eq("id", userRow.id);
    setSavingUser(false);
    if (error) toast.error(error.message); else toast.success("프로필이 저장되었습니다");
  }

  async function saveComplex() {
    if (!complex) return;
    setSaving(true);
    let companyId = complex.company_id ?? null;

    if (complex.mgmt_type === "위탁관리" && company && (company.name || company.business_number || company.phone || company.address)) {
      if (companyId) {
        const { error: cuErr } = await supabase.from("companies").update({
          name: company.name, business_number: company.business_number, phone: company.phone, address: company.address,
        }).eq("id", companyId);
        if (cuErr) { setSaving(false); toast.error(cuErr.message); return; }
      } else {
        const { data: ins, error: ciErr } = await supabase.from("companies").insert({
          name: company.name || "본사", business_number: company.business_number, phone: company.phone, address: company.address,
        }).select("id").single();
        if (ciErr) { setSaving(false); toast.error(ciErr.message); return; }
        companyId = ins.id;
      }
    }

    const { error } = await supabase.from("complexes").update({
      name: complex.name, address: complex.address, household_count: complex.household_count, mgmt_type: complex.mgmt_type,
      company_id: complex.mgmt_type === "위탁관리" ? companyId : null,
    }).eq("id", complex.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("저장되었습니다");
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold">설정</h1>

      <Card><CardContent className="p-5 space-y-3">
        <h2 className="font-semibold">사용자 프로필</h2>
        {userRow ? (
        <>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>이름</Label>
            <Input value={userRow.name ?? ""} onChange={e=>setUserRow({...userRow, name:e.target.value})} />
          </div>
          <div>
            <Label>직책</Label>
            <select value={userRow.role ?? "기타"} onChange={e=>setUserRow({...userRow, role:e.target.value})}
              className="w-full h-10 px-3 rounded-md border bg-background text-sm">
              <option value="관리사무소장">관리사무소장</option>
              <option value="관리과장">관리과장</option>
              <option value="시설주임">시설주임</option>
              <option value="경비반장">경비반장</option>
              <option value="미화반장">미화반장</option>
              <option value="외주업체">외주업체</option>
              <option value="기타">기타</option>
            </select>
          </div>
          <div>
            <Label>이메일</Label>
            <div className="mt-1 text-sm text-muted-foreground h-10 flex items-center">{userRow.email}</div>
          </div>
          <div>
            <Label>연락처</Label>
            <Input value={userRow.phone ?? ""} onChange={e=>setUserRow({...userRow, phone:e.target.value})} />
          </div>
        </div>
        <Button onClick={saveUser} disabled={savingUser}>{savingUser?"저장 중...":"프로필 저장"}</Button>
        </>
        ) : (
          <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">불러오는 중...</div>
        )}
      </CardContent></Card>

      <Card><CardContent className="p-5 space-y-3">
        <h2 className="font-semibold">단지 정보</h2>
        {complex ? (
          <>
          <div>
            <Label>단지명</Label>
            <Input value={complex.name ?? ""} onChange={e=>setComplex({...complex, name:e.target.value})} />
          </div>
          <div>
            <Label>주소</Label>
            <Input value={complex.address ?? ""} onChange={e=>setComplex({...complex, address:e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>세대수</Label>
              <Input type="number" value={complex.household_count ?? 0} onChange={e=>setComplex({...complex, household_count:Number(e.target.value)})} />
            </div>
            <div>
              <Label>관리방식</Label>
              <select value={complex.mgmt_type} onChange={e=>setComplex({...complex, mgmt_type:e.target.value})}
                className="w-full h-10 px-3 rounded-md border bg-background text-sm">
                <option value="자가관리">자가관리</option>
                <option value="위탁관리">위탁관리</option>
              </select>
            </div>
          </div>
          {complex.mgmt_type === "위탁관리" && company && (
            <div className="space-y-3 rounded-md border bg-muted/30 p-3">
              <div className="text-sm font-medium">위탁 본사 정보</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>본사명</Label>
                  <Input value={company.name ?? ""} onChange={e=>setCompany({...company, name:e.target.value})} />
                </div>
                <div>
                  <Label>사업자등록번호</Label>
                  <Input value={company.business_number ?? ""} onChange={e=>setCompany({...company, business_number:e.target.value})} />
                </div>
                <div>
                  <Label>본사 연락처</Label>
                  <Input value={company.phone ?? ""} onChange={e=>setCompany({...company, phone:e.target.value})} />
                </div>
                <div>
                  <Label>본사 주소</Label>
                  <Input value={company.address ?? ""} onChange={e=>setCompany({...company, address:e.target.value})} />
                </div>
              </div>
            </div>
          )}
          <Button onClick={saveComplex} disabled={saving}>{saving?"저장 중...":"단지 정보 저장"}</Button>
          </>
        ) : (
          <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">단지 정보를 준비하는 중입니다.</div>
        )}
      </CardContent></Card>

      <Card><CardContent className="p-5 space-y-3">
        <h2 className="font-semibold">계정</h2>
        <Button variant="outline" onClick={signOut}>로그아웃</Button>
      </CardContent></Card>
    </div>
  );
}
