import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
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
  const [profile, setProfile] = useState<any>(null);
  const [complex, setComplex] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      setProfile(p);
      if (p?.primary_complex_id) {
        const { data: c } = await supabase.from("complexes").select("*").eq("id", p.primary_complex_id).maybeSingle();
        setComplex(c);
      }
    })();
  }, [user]);

  async function saveComplex() {
    if (!complex) return;
    setSaving(true);
    const { error } = await supabase.from("complexes").update({
      name: complex.name, address: complex.address, household_count: complex.household_count, mgmt_type: complex.mgmt_type,
    }).eq("id", complex.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("저장되었습니다");
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold">설정</h1>

      <Card><CardContent className="p-5 space-y-3">
        <h2 className="font-semibold">사용자 프로필</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><Label>이름</Label><div className="mt-1">{profile?.name}</div></div>
          <div><Label>직책</Label><div className="mt-1">{profile?.position}</div></div>
          <div><Label>소속</Label><div className="mt-1">{profile?.affiliation}</div></div>
          <div><Label>연락처</Label><div className="mt-1">{profile?.phone ?? "-"}</div></div>
        </div>
      </CardContent></Card>

      {complex && (
        <Card><CardContent className="p-5 space-y-3">
          <h2 className="font-semibold">단지 정보</h2>
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
          <Button onClick={saveComplex} disabled={saving}>{saving?"저장 중...":"단지 정보 저장"}</Button>
        </CardContent></Card>
      )}

      <Card><CardContent className="p-5 space-y-3">
        <h2 className="font-semibold">계정</h2>
        <Button variant="outline" onClick={signOut}>로그아웃</Button>
      </CardContent></Card>
    </div>
  );
}
