import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { createComplex, deleteComplex } from "@/lib/user-context.functions";
import { leaveOrganization, deleteAccount, deleteOrganization } from "@/lib/account.functions";
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
  const deleteComplexFn = useServerFn(deleteComplex);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [userRow, setUserRow] = useState<any>(null);
  const [org, setOrg] = useState<any>(null);
  const [savingOrg, setSavingOrg] = useState(false);
  const [complexes, setComplexes] = useState<any[]>([]);
  const [newComplex, setNewComplex] = useState<any>(EMPTY_COMPLEX);
  const [loading, setLoading] = useState(true);
  const [savingUser, setSavingUser] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);

  async function reload() {
    if (!user) return;
    setLoading(true);
    const { data: u } = await supabase.from("users").select("*").eq("auth_id", user.id).maybeSingle();
    setUserRow(u);
    if (u?.organization_id) {
      const { data: o } = await supabase.from("organizations").select("*").eq("id", u.organization_id).maybeSingle();
      setOrg(o);
    }
    if (u) {
      const { data: members } = await supabase
        .from("complex_members")
        .select("complex_id")
        .eq("user_id", u.id);

      const complexIds = [...new Set((members ?? []).map((m: any) => m.complex_id).filter(Boolean))];
      if (complexIds.length === 0) {
        setComplexes([]);
        setShowNewForm(true);
        setLoading(false);
        return;
      }

      const { data: list, error } = await supabase
        .from("complexes")
        .select("*")
        .in("id", complexIds)
        .order("created_at", { ascending: true });
      if (error) toast.error(error.message);
      setComplexes(list ?? []);
      setShowNewForm((list ?? []).length === 0);
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
      setShowNewForm(false);
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
      name: userRow.name, job_title: userRow.job_title, phone: userRow.phone,
    }).eq("id", userRow.id);
    setSavingUser(false);
    if (error) toast.error(error.message); else toast.success("프로필이 저장되었습니다");
  }

  async function saveOrg() {
    if (!org) return;
    if (!org.name?.trim()) { toast.error("본사명을 입력하세요"); return; }
    setSavingOrg(true);
    const { error } = await supabase.from("organizations").update({
      name: org.name.trim(),
      address: org.address?.trim() || null,
      phone: org.phone?.trim() || null,
      business_number: org.business_number?.trim() || null,
      representative_name: org.representative_name?.trim() || null,
    }).eq("id", org.id);
    setSavingOrg(false);
    if (error) toast.error(error.message); else toast.success("본사 정보가 저장되었습니다");
  }

  async function handleDelete(c: any) {
    if (!confirm(`'${c.name}' 단지를 삭제하시겠습니까?\n평가 기록이 있는 단지는 삭제할 수 없습니다.`)) return;
    setDeletingId(c.id);
    try {
      await deleteComplexFn({ data: { complexId: c.id } });
      toast.success("단지가 삭제되었습니다");
      await reload();
    } catch (e: any) {
      toast.error(e?.message ?? "단지 삭제에 실패했습니다");
    } finally {
      setDeletingId(null);
    }
  }

  async function saveComplex(c: any) {
    if (!c.name?.trim() || !c.address?.trim()) { toast.error("단지명/주소를 입력하세요"); return; }
    setSavingId(c.id);
    const { error } = await supabase.from("complexes").update({
      name: c.name, address: c.address, household_count: c.household_count,
      mgmt_type: c.mgmt_type, manager_name: c.manager_name, manager_phone: c.manager_phone,
    }).eq("id", c.id);
    setSavingId(null);
    if (error) toast.error(error.message); else toast.success("단지 정보가 저장되었습니다");
  }

  function updateComplex(id: string, patch: any) {
    setComplexes(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
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
                <Input value={userRow.job_title ?? ""} placeholder="예: 관리사무소장"
                  onChange={e=>setUserRow({...userRow, job_title:e.target.value})} />
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

      <Card><CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">등록된 단지 ({complexes.length})</h2>
          {complexes.length > 0 && !showNewForm && (
            <Button size="sm" variant="outline" onClick={()=>setShowNewForm(true)}>+ 단지 추가</Button>
          )}
        </div>

        {loading ? (
          <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">불러오는 중...</div>
        ) : complexes.length === 0 && !showNewForm ? (
          <p className="text-sm text-muted-foreground">등록된 단지가 없습니다.</p>
        ) : (
          complexes.map(c => (
            <div key={c.id} className="rounded-md border p-4 space-y-3">
              <div>
                <Label>단지명</Label>
                <Input value={c.name ?? ""} onChange={e=>updateComplex(c.id, {name:e.target.value})} />
              </div>
              <div>
                <Label>주소</Label>
                <Input value={c.address ?? ""} onChange={e=>updateComplex(c.id, {address:e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>세대수</Label>
                  <Input type="number" min={0} value={c.household_count ?? 0}
                    onChange={e=>updateComplex(c.id, {household_count:Number(e.target.value)})} />
                </div>
                <div>
                  <Label>관리방식</Label>
                  <select value={c.mgmt_type ?? "위탁관리"} onChange={e=>updateComplex(c.id, {mgmt_type:e.target.value})}
                    className="w-full h-10 px-3 rounded-md border bg-background text-sm">
                    <option value="자가관리">자가관리</option>
                    <option value="위탁관리">위탁관리</option>
                  </select>
                </div>
                <div>
                  <Label>관리자명</Label>
                  <Input value={c.manager_name ?? ""} onChange={e=>updateComplex(c.id, {manager_name:e.target.value})} />
                </div>
                <div>
                  <Label>관리자 연락처</Label>
                  <Input value={c.manager_phone ?? ""} placeholder="010-0000-0000"
                    onChange={e=>updateComplex(c.id, {manager_phone:e.target.value})} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={()=>saveComplex(c)} disabled={savingId===c.id}>
                  {savingId===c.id?"저장 중...":"저장"}
                </Button>
                <Button variant="destructive" onClick={()=>handleDelete(c)} disabled={deletingId===c.id}>
                  {deletingId===c.id?"삭제 중...":"삭제"}
                </Button>
              </div>
            </div>
          ))
        )}

        {showNewForm && (
          <div className="rounded-md border border-dashed p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">새 단지 등록</h3>
              {complexes.length > 0 && (
                <Button size="sm" variant="ghost" onClick={()=>{setShowNewForm(false); setNewComplex(EMPTY_COMPLEX);}}>취소</Button>
              )}
            </div>
            <div>
              <Label>단지명 *</Label>
              <Input value={newComplex.name} onChange={e=>setNewComplex({...newComplex, name:e.target.value})} />
            </div>
            <div>
              <Label>주소 *</Label>
              <Input value={newComplex.address} onChange={e=>setNewComplex({...newComplex, address:e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>세대수</Label>
                <Input type="number" min={0} value={newComplex.household_count}
                  onChange={e=>setNewComplex({...newComplex, household_count:Number(e.target.value)})} />
              </div>
              <div>
                <Label>관리방식</Label>
                <select value={newComplex.mgmt_type} onChange={e=>setNewComplex({...newComplex, mgmt_type:e.target.value})}
                  className="w-full h-10 px-3 rounded-md border bg-background text-sm">
                  <option value="자가관리">자가관리</option>
                  <option value="위탁관리">위탁관리</option>
                </select>
              </div>
              <div>
                <Label>관리자명</Label>
                <Input value={newComplex.manager_name}
                  onChange={e=>setNewComplex({...newComplex, manager_name:e.target.value})} />
              </div>
              <div>
                <Label>관리자 연락처</Label>
                <Input value={newComplex.manager_phone} placeholder="010-0000-0000"
                  onChange={e=>setNewComplex({...newComplex, manager_phone:e.target.value})} />
              </div>
            </div>
            <Button onClick={handleCreate} disabled={creating}>{creating?"등록 중...":"단지 등록"}</Button>
          </div>
        )}
      </CardContent></Card>

      <Card><CardContent className="p-5 space-y-3">
        <h2 className="font-semibold">계정</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={signOut}>로그아웃</Button>
          <Button
            variant="outline"
            onClick={async () => {
              if (!confirm("조직에서 나가시겠습니까?\n계정은 유지되지만 조직 데이터에 더 이상 접근할 수 없습니다.")) return;
              try {
                await leaveOrganization();
                toast.success("조직에서 나갔습니다.");
                await signOut();
              } catch (e: any) { toast.error(e?.message ?? "실패"); }
            }}
          >조직에서 나가기</Button>
          {userRow?.org_role === "admin" && (
            <>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!confirm("계정을 완전히 삭제합니다. 되돌릴 수 없습니다. 진행할까요?")) return;
                  if (!confirm("정말 계정을 삭제하시겠습니까?")) return;
                  try {
                    await deleteAccount();
                    toast.success("계정이 삭제되었습니다.");
                    await signOut();
                  } catch (e: any) { toast.error(e?.message ?? "실패"); }
                }}
              >계정 삭제 (관리자)</Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  const name = prompt("조직과 모든 데이터(단지/평가/멤버)를 영구 삭제합니다.\n확인을 위해 '삭제'를 입력하세요.");
                  if (name !== "삭제") return;
                  try {
                    await deleteOrganization();
                    toast.success("조직이 삭제되었습니다.");
                    await signOut();
                  } catch (e: any) { toast.error(e?.message ?? "실패"); }
                }}
              >조직 삭제 (관리자)</Button>
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          · 조직에서 나가기: 본인 멤버 기록만 제거 (계정 유지)<br/>
          · 계정 삭제: 본인 계정 + 멤버 기록 영구 삭제<br/>
          · 조직 삭제: 조직 전체 데이터와 모든 구성원 영구 삭제
        </p>
      </CardContent></Card>
    </div>
  );
}
