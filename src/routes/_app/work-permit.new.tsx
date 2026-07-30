import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { writeErrorMessage } from "@/lib/write-error";
import { getCurrentUserContext } from "@/lib/user-context";
import { PERMIT_PRESETS } from "@/lib/permit-presets";

export const Route = createFileRoute("/_app/work-permit/new")({
  component: NewPermit,
});

function NewPermit() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [userRowId, setUserRowId] = useState("");
  const [orgId, setOrgId] = useState("");
  const [complexes, setComplexes] = useState<{ id: string; name: string }[]>([]);
  const [complexId, setComplexId] = useState("");
  const [permitType, setPermitType] = useState(PERMIT_PRESETS[0].type);
  const [title, setTitle] = useState("");
  const [workLocation, setWorkLocation] = useState("");
  const [workDate, setWorkDate] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10));
  const [performer, setPerformer] = useState("");
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

  const preset = PERMIT_PRESETS.find((p) => p.type === permitType)!;

  async function submit() {
    if (!complexId) { toast.error("단지를 선택해주세요"); return; }
    let effectiveOrg = orgId;
    if (!effectiveOrg && user) {
      const { data } = await supabase.from("users").select("organization_id").eq("auth_id", user.id).maybeSingle();
      effectiveOrg = data?.organization_id ?? "";
    }
    if (!effectiveOrg) { toast.error("조직 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요."); return; }
    setSaving(true);
    const checklist = preset.checklist.map((t) => ({ text: t, required: true, result: "" }));
    const { data, error } = await (supabase as any).from("work_permits").insert({
      complex_id: complexId,
      organization_id: effectiveOrg,
      permit_type: permitType,
      title: title.trim() || `${permitType} 허가서`,
      work_location: workLocation || null,
      work_date: workDate || null,
      performer: performer || null,
      workers: [],
      checklist,
      gas_required: preset.gasRequired,
      status: "신청",
      created_by: userRowId || null,
    }).select("id").maybeSingle();
    setSaving(false);
    if (error) { toast.error(writeErrorMessage(error)); return; }
    navigate({ to: "/work-permit/$id", params: { id: data.id } });
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-4">
      <Link to="/work-permit"><Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />목록</Button></Link>
      <h1 className="text-2xl font-bold">작업허가서 작성</h1>

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
          <Label>작업 유형</Label>
          <div className="grid grid-cols-3 gap-1.5 mt-1">
            {PERMIT_PRESETS.map((p) => (
              <button key={p.type} type="button" onClick={() => setPermitType(p.type)}
                className={`py-2.5 rounded-md border text-sm font-medium ${permitType === p.type ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}>
                {p.type}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">예: {preset.examples}</p>
          {preset.gasRequired && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-danger bg-danger/10 rounded-md px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />이 작업은 가스농도 측정이 필수입니다.
            </div>
          )}
        </div>
        <div>
          <Label>제목 (비우면 자동 생성)</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${permitType} 허가서`} className="h-11 mt-1" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>작업 예정일</Label>
            <Input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} className="h-11 mt-1" />
          </div>
          <div>
            <Label>작업 장소</Label>
            <Input value={workLocation} onChange={(e) => setWorkLocation(e.target.value)} placeholder="예: 101동 옥상" className="h-11 mt-1" />
          </div>
        </div>
        <div>
          <Label>시행 업체/담당 (선택)</Label>
          <Input value={performer} onChange={(e) => setPerformer(e.target.value)} placeholder="예: OO방수(주) 또는 자체 시설팀" className="h-11 mt-1" />
        </div>

        <Button onClick={submit} disabled={saving} className="w-full h-12">
          {saving ? "생성 중..." : "허가서 만들고 점검하기"}
        </Button>
      </CardContent></Card>
    </div>
  );
}
