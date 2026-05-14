import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getCurrentUserContext } from "@/lib/user-context";
import { createComplex } from "@/lib/user-context.functions";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  component: Settings,
});

const USER_ROLES = [
  "관리사무소장",
  "안전보건관리책임자",
  "관리감독자",
  "안전관리자",
  "보건관리자",
  "본사_안전담당",
  "기타",
];

const EMPTY_COMPLEX = {
  name: "", address: "", household_count: 0, mgmt_type: "위탁관리",
  manager_name: "", manager_phone: "",
};

function Settings() {
  const { user, signOut } = useAuth();
  const createComplexFn = useServerFn(createComplex);
  const [userRow, setUserRow] = useState<any>(null);
  const [complex, setComplex] = useState<any>(null);
  const [newComplex, setNewComplex] = useState<any>(EMPTY_COMPLEX);
  const [loading, setLoading] = useState(true);
  const [savingUser, setSavingUser] = useState(false);
  const [savingComplex, setSavingComplex] = useState(false);
  const [creating, setCreating] = useState(false);

  async function reload() {
    if (!user) return;
    setLoading(true);
    const { userRow, complexId } = await getCurrentUserContext(user.id);
    setUserRow(userRow);
    if (complexId) {
      const { data: c } = await supabase.from("complexes").select("*").eq("id", complexId).maybeSingle();
      setComplex(c);
    } else {
      setComplex(null);
    }
    setLoading(false);
  }

  useEffect(() => { reload(); }, [user]);

  async function handleCreate() {
    if (!newComplex.name?.trim()) { toast.error("단지명을 입력하세요"); return; }
    if (!newComplex.address?.trim()) { toast.error("주소를 입력하세요"); return; }
    setCreating(true);
    try {
      await createComplexFn({ data: {
        name: newComplex.name.trim(),
        address: newComplex.address.trim(),
        household_count: Number(newComplex.household_count) || 0,
        mgmt_type: newComplex.mgmt_type,
        manager_name: newComplex.manager_name?.trim() || null,
        manager_phone: newComplex.manager_phone?.trim() || null,
      }});
      toast.success("단지가 등록되었습니다");
      setNewComplex(EMPTY_COMPLEX);
      await reload();
    } catch (e: any) {
      toast.error(e?.message ?? "단지 등록에 실패했습니다");
    } finally {
      setCreating(false);
    }
  }

  async function saveUser() {
    if (!userRow) return;
    setSavingUser(true);
    const { error } = await supabase.from("users").update({
      name: userRow.name,
      role: userRow.role,
      phone: userRow.phone,
    }).eq("id", userRow.id);
    setSavingUser(false);
    if (error) toast.error(error.message); else toast.success("프로필이 저장되었습니다");
  }

  async function saveComplex() {
    if (!complex) return;
    if (!complex.name?.trim()) { toast.error("단지명을 입력하세요"); return; }
    if (!complex.address?.trim()) { toast.error("주소를 입력하세요"); return; }
    setSavingComplex(true);
    const { error } = await supabase.from("complexes").update({
      name: complex.name,
      address: complex.address,
      household_count: complex.household_count,
      mgmt_type: complex.mgmt_type,
      manager_name: complex.manager_name,
      manager_phone: complex.manager_phone,
    }).eq("id", complex.id);
    setSavingComplex(false);
    if (error) toast.error(error.message); else toast.success("단지 정보가 저장되었습니다");
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
                  {USER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <Label>이메일</Label>
                <Input value={userRow.email ?? ""} disabled />
              </div>
              <div>
                <Label>연락처</Label>
                <Input value={userRow.phone ?? ""} placeholder="010-0000-0000"
                  onChange={e=>setUserRow({...userRow, phone:e.target.value})} />
              </div>
            </div>
            <Button onClick={saveUser} disabled={savingUser}>{savingUser?"저장 중...":"프로필 저장"}</Button>
          </>
        ) : (
          <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">사용자 정보를 불러오는 중...</div>
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
              <Input type="number" min={0} value={complex.household_count ?? 0}
                onChange={e=>setComplex({...complex, household_count:Number(e.target.value)})} />
            </div>
            <div>
              <Label>관리방식</Label>
              <select value={complex.mgmt_type ?? "위탁관리"} onChange={e=>setComplex({...complex, mgmt_type:e.target.value})}
                className="w-full h-10 px-3 rounded-md border bg-background text-sm">
                <option value="자가관리">자가관리</option>
                <option value="위탁관리">위탁관리</option>
              </select>
            </div>
            <div>
              <Label>관리자명</Label>
              <Input value={complex.manager_name ?? ""} onChange={e=>setComplex({...complex, manager_name:e.target.value})} />
            </div>
            <div>
              <Label>관리자 연락처</Label>
              <Input value={complex.manager_phone ?? ""} placeholder="010-0000-0000"
                onChange={e=>setComplex({...complex, manager_phone:e.target.value})} />
            </div>
          </div>
          <Button onClick={saveComplex} disabled={savingComplex}>{savingComplex?"저장 중...":"단지 정보 저장"}</Button>
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
