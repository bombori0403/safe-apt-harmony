import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { writeErrorMessage } from "@/lib/write-error";
import { createComplex, deleteComplex } from "@/lib/user-context.functions";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const EMPTY_COMPLEX = {
  name: "", address: "", household_count: 0, mgmt_type: "위탁관리",
  manager_name: "", manager_phone: "",
};

// 단지(사업장) 등록·수정·삭제. 설정과 '단지 관리' 페이지에서 공용으로 사용.
export function ComplexManager() {
  const { user } = useAuth();
  const sub = useSubscription();
  const createComplexFn = useServerFn(createComplex);
  const deleteComplexFn = useServerFn(deleteComplex);
  const [isAdmin, setIsAdmin] = useState(false);
  const [complexes, setComplexes] = useState<any[]>([]);
  const [newComplex, setNewComplex] = useState<any>(EMPTY_COMPLEX);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function reload() {
    if (!user) return;
    setLoading(true);
    const { data: u } = await supabase.from("users").select("id, org_role").eq("auth_id", user.id).maybeSingle();
    const admin = u?.org_role === "admin";
    setIsAdmin(admin);
    let list: any[] = [];
    if (admin) {
      const { data, error } = await supabase.from("complexes").select("*").order("created_at", { ascending: true });
      if (error) toast.error(writeErrorMessage(error));
      list = data ?? [];
    } else if (u) {
      const { data: members } = await supabase.from("complex_members").select("complex_id").eq("user_id", u.id);
      const ids = [...new Set((members ?? []).map((m: any) => m.complex_id).filter(Boolean))];
      list = ids.length
        ? (await supabase.from("complexes").select("*").in("id", ids).order("created_at", { ascending: true })).data ?? []
        : [];
    }
    setComplexes(list);
    setShowNewForm(admin && list.length === 0);
    setLoading(false);
  }
  useEffect(() => { reload(); }, [user]);

  async function handleCreate() {
    if (!newComplex.name?.trim()) { toast.error("단지명을 입력하세요"); return; }
    if (!newComplex.address?.trim()) { toast.error("주소를 입력하세요"); return; }
    if (sub.isTrial && complexes.length >= 1) {
      toast.error("체험판은 단지 1개까지 등록할 수 있습니다. 정식 전환 후 추가하세요.");
      return;
    }
    setCreating(true);
    try {
      await createComplexFn({ data: {
        name: newComplex.name.trim(), address: newComplex.address.trim(),
        household_count: Number(newComplex.household_count) || 0, mgmt_type: newComplex.mgmt_type,
        manager_name: newComplex.manager_name?.trim() || null, manager_phone: newComplex.manager_phone?.trim() || null,
      }});
      toast.success("단지가 등록되었습니다");
      setNewComplex(EMPTY_COMPLEX);
      setShowNewForm(false);
      await reload();
    } catch (e: any) {
      toast.error(writeErrorMessage(e, "단지 등록에 실패했습니다"));
    } finally { setCreating(false); }
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
    } finally { setDeletingId(null); }
  }

  async function saveComplex(c: any) {
    if (!c.name?.trim() || !c.address?.trim()) { toast.error("단지명/주소를 입력하세요"); return; }
    setSavingId(c.id);
    const { error } = await supabase.from("complexes").update({
      name: c.name, address: c.address, household_count: c.household_count,
      mgmt_type: c.mgmt_type, manager_name: c.manager_name, manager_phone: c.manager_phone,
      initial_assessment_date: c.initial_assessment_date || null,
    }).eq("id", c.id);
    setSavingId(null);
    if (error) toast.error(writeErrorMessage(error)); else toast.success("단지 정보가 저장되었습니다");
  }

  function updateComplex(id: string, patch: any) {
    setComplexes(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  }

  return (
    <Card><CardContent className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">등록된 단지 ({complexes.length})</h2>
        {complexes.length > 0 && !showNewForm && isAdmin && (
          <Button size="sm" variant="outline" onClick={() => setShowNewForm(true)}>+ 단지 추가</Button>
        )}
      </div>

      {loading ? (
        <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">불러오는 중...</div>
      ) : complexes.length === 0 && !showNewForm ? (
        <p className="text-sm text-muted-foreground">등록된 단지가 없습니다.{isAdmin ? "" : " 관리자에게 단지 등록을 요청하세요."}</p>
      ) : (
        complexes.map(c => (
          <div key={c.id} className="rounded-md border p-4 space-y-3">
            <div>
              <Label>단지명</Label>
              <Input value={c.name ?? ""} onChange={e => updateComplex(c.id, { name: e.target.value })} />
            </div>
            <div>
              <Label>주소</Label>
              <Input value={c.address ?? ""} onChange={e => updateComplex(c.id, { address: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>세대수</Label>
                <Input type="number" min={0} value={c.household_count ?? 0}
                  onChange={e => updateComplex(c.id, { household_count: Number(e.target.value) })} />
              </div>
              <div>
                <Label>관리방식</Label>
                <select value={c.mgmt_type ?? "위탁관리"} onChange={e => updateComplex(c.id, { mgmt_type: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border bg-background text-sm">
                  <option value="자가관리">자가관리</option>
                  <option value="위탁관리">위탁관리</option>
                </select>
              </div>
              <div>
                <Label>관리자명</Label>
                <Input value={c.manager_name ?? ""} onChange={e => updateComplex(c.id, { manager_name: e.target.value })} />
              </div>
              <div>
                <Label>관리자 연락처</Label>
                <Input value={c.manager_phone ?? ""} placeholder="010-0000-0000"
                  onChange={e => updateComplex(c.id, { manager_phone: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>최초평가일 <span className="text-xs text-muted-foreground">(정기평가 예정일 자동계산 기준)</span></Label>
                <Input type="date" value={c.initial_assessment_date ?? ""}
                  onChange={e => updateComplex(c.id, { initial_assessment_date: e.target.value })} />
                {c.next_assessment_auto && (
                  <p className="text-xs text-muted-foreground mt-1">자동계산된 다음 정기평가일: {c.next_assessment_auto}</p>
                )}
              </div>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <Button onClick={() => saveComplex(c)} disabled={savingId === c.id}>{savingId === c.id ? "저장 중..." : "저장"}</Button>
                <Button variant="destructive" onClick={() => handleDelete(c)} disabled={deletingId === c.id}>{deletingId === c.id ? "삭제 중..." : "삭제"}</Button>
              </div>
            )}
          </div>
        ))
      )}

      {showNewForm && isAdmin && (
        <div className="rounded-md border border-dashed p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm">새 단지 등록</h3>
            {complexes.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => { setShowNewForm(false); setNewComplex(EMPTY_COMPLEX); }}>취소</Button>
            )}
          </div>
          <div>
            <Label>단지명 *</Label>
            <Input value={newComplex.name} onChange={e => setNewComplex({ ...newComplex, name: e.target.value })} placeholder="○○아파트 관리사무소" />
          </div>
          <div>
            <Label>주소 *</Label>
            <Input value={newComplex.address} onChange={e => setNewComplex({ ...newComplex, address: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>세대수</Label>
              <Input type="number" min={0} value={newComplex.household_count}
                onChange={e => setNewComplex({ ...newComplex, household_count: Number(e.target.value) })} />
            </div>
            <div>
              <Label>관리방식</Label>
              <select value={newComplex.mgmt_type} onChange={e => setNewComplex({ ...newComplex, mgmt_type: e.target.value })}
                className="w-full h-10 px-3 rounded-md border bg-background text-sm">
                <option value="자가관리">자가관리</option>
                <option value="위탁관리">위탁관리</option>
              </select>
            </div>
            <div>
              <Label>관리자명</Label>
              <Input value={newComplex.manager_name} onChange={e => setNewComplex({ ...newComplex, manager_name: e.target.value })} />
            </div>
            <div>
              <Label>관리자 연락처</Label>
              <Input value={newComplex.manager_phone} placeholder="010-0000-0000"
                onChange={e => setNewComplex({ ...newComplex, manager_phone: e.target.value })} />
            </div>
          </div>
          <Button onClick={handleCreate} disabled={creating}>{creating ? "등록 중..." : "단지 등록"}</Button>
        </div>
      )}
    </CardContent></Card>
  );
}
