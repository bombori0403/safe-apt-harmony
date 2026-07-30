import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, History } from "lucide-react";
import { toast } from "sonner";
import { writeErrorMessage } from "@/lib/write-error";
import { getCurrentUserContext } from "@/lib/user-context";

export const Route = createFileRoute("/_app/tbm/new")({
  component: NewTbm,
});

function NewTbm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [userRowId, setUserRowId] = useState("");
  const [orgId, setOrgId] = useState("");
  const [complexes, setComplexes] = useState<{ id: string; name: string }[]>([]);
  const [complexId, setComplexId] = useState("");
  const [title, setTitle] = useState("");
  const [heldAt, setHeldAt] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  const [location, setLocation] = useState("");
  const [carry, setCarry] = useState<{ work_content: string; attendees: any[]; hazards: any[]; leader_name: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    getCurrentUserContext(user.id).then(async ({ userId, complexId: ctx, userRow }) => {
      if (userId) setUserRowId(userId);
      if (userRow?.organization_id) setOrgId(userRow.organization_id);
      let list: any[] = [];
      if (userRow?.org_role === "admin") {
        list = (await supabase.from("complexes").select("id,name").order("name")).data ?? [];
      } else {
        const { data: members } = await supabase.from("complex_members").select("complex_id").eq("user_id", userId ?? "");
        const ids = [...new Set((members ?? []).map((m: any) => m.complex_id).filter(Boolean))];
        list = ids.length ? (await supabase.from("complexes").select("id,name").in("id", ids)).data ?? [] : [];
      }
      setComplexes(list);
      setComplexId(ctx ?? list[0]?.id ?? "");
    });
  }, [user]);

  // 같은 단지·같은 조(title)의 가장 최근 TBM을 불러와 참석자·위험요인을 재사용(건강체크는 초기화).
  async function loadLast() {
    if (!complexId || !title.trim()) { toast.error("단지와 조/작업명을 먼저 입력하세요"); return; }
    const { data } = await (supabase as any).from("tbm_meetings")
      .select("work_content,attendees,hazards,leader_name")
      .eq("complex_id", complexId).eq("title", title.trim())
      .order("held_at", { ascending: false }).limit(1).maybeSingle();
    if (!data) { toast.error("이전 회차가 없습니다"); return; }
    setCarry({
      work_content: data.work_content ?? "",
      leader_name: data.leader_name ?? "",
      attendees: (data.attendees ?? []).map((a: any) => ({ name: a.name, role: a.role, fever: false, alcohol: false, drug: false, ppe: true, signed: false })),
      hazards: data.hazards ?? [],
    });
    toast.success(`이전 회차를 불러왔습니다 (참석 ${data.attendees?.length ?? 0}명, 위험요인 ${data.hazards?.length ?? 0}건)`);
  }

  async function submit() {
    if (!complexId) { toast.error("단지를 선택해주세요"); return; }
    if (!title.trim()) { toast.error("조/작업명을 입력해주세요"); return; }
    let effectiveOrg = orgId;
    if (!effectiveOrg && user) {
      const { data } = await supabase.from("users").select("organization_id").eq("auth_id", user.id).maybeSingle();
      effectiveOrg = data?.organization_id ?? "";
    }
    if (!effectiveOrg) { toast.error("조직 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요."); return; }
    setSaving(true);
    const { data, error } = await (supabase as any).from("tbm_meetings").insert({
      complex_id: complexId,
      organization_id: effectiveOrg,
      title: title.trim(),
      held_at: new Date(heldAt).toISOString(),
      location: location || null,
      work_content: carry?.work_content ?? null,
      leader_name: carry?.leader_name ?? null,
      attendees: carry?.attendees ?? [],
      hazards: carry?.hazards ?? [],
      status: "작성",
      created_by: userRowId || null,
    }).select("id").maybeSingle();
    setSaving(false);
    if (error) { toast.error(writeErrorMessage(error)); return; }
    navigate({ to: "/tbm/$id", params: { id: data.id } });
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-4">
      <Link to="/tbm"><Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />목록</Button></Link>
      <h1 className="text-2xl font-bold">TBM 작성</h1>

      <Card><CardContent className="p-5 space-y-4">
        {complexes.length > 1 && (
          <div>
            <Label>단지</Label>
            <select value={complexId} onChange={(e) => setComplexId(e.target.value)} className="w-full h-11 px-3 rounded-md border bg-background text-sm mt-1">
              {complexes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <Label>조 / 작업명</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: A동 미화조, 야간 경비조" className="h-11 mt-1" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>일시</Label>
            <Input type="datetime-local" value={heldAt} onChange={(e) => setHeldAt(e.target.value)} className="h-11 mt-1" />
          </div>
          <div>
            <Label>장소 (선택)</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="예: 관리사무소 앞" className="h-11 mt-1" />
          </div>
        </div>

        <Button type="button" variant="outline" className="w-full gap-1.5" onClick={loadLast}>
          <History className="h-4 w-4" />이전 회차 불러오기 (참석자·위험요인 재사용)
        </Button>
        {carry && (
          <p className="text-xs text-success text-center">
            불러옴: 참석 {carry.attendees.length}명 · 위험요인 {carry.hazards.length}건 (건강체크는 초기화됨)
          </p>
        )}

        <Button onClick={submit} disabled={saving} className="w-full h-12">
          {saving ? "생성 중..." : "작성 시작"}
        </Button>
      </CardContent></Card>
    </div>
  );
}
