import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { writeErrorMessage } from "@/lib/write-error";
import { getCurrentUserContext } from "@/lib/user-context";
import { EDUCATION_PRESETS, EDU_METHODS } from "@/lib/education-presets";

export const Route = createFileRoute("/_app/education/new")({
  component: NewEducation,
});

function NewEducation() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [userRowId, setUserRowId] = useState("");
  const [orgId, setOrgId] = useState("");
  const [complexes, setComplexes] = useState<{ id: string; name: string }[]>([]);
  const [complexId, setComplexId] = useState("");
  const [category, setCategory] = useState(EDUCATION_PRESETS[0].category);
  const [method, setMethod] = useState<string>(EDU_METHODS[0]);
  const [title, setTitle] = useState("");
  const [eduDate, setEduDate] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10));
  const [minutes, setMinutes] = useState(EDUCATION_PRESETS[0].defaultMinutes);
  const [instructor, setInstructor] = useState("");
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

  const preset = EDUCATION_PRESETS.find((p) => p.category === category)!;

  function pickCategory(c: string) {
    setCategory(c);
    const p = EDUCATION_PRESETS.find((x) => x.category === c);
    if (p) setMinutes(p.defaultMinutes);
  }

  async function submit() {
    if (!complexId) { toast.error("단지를 선택해주세요"); return; }
    let effectiveOrg = orgId;
    if (!effectiveOrg && user) {
      const { data } = await supabase.from("users").select("organization_id").eq("auth_id", user.id).maybeSingle();
      effectiveOrg = data?.organization_id ?? "";
    }
    if (!effectiveOrg) { toast.error("조직 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요."); return; }
    setSaving(true);
    const { data, error } = await (supabase as any).from("safety_educations").insert({
      complex_id: complexId,
      organization_id: effectiveOrg,
      title: title.trim() || `${category} 안전보건교육`,
      category,
      method,
      edu_date: eduDate || null,
      duration_minutes: minutes || 0,
      instructor: instructor || null,
      legal_basis: preset.legalBasis,
      status: "예정",
      attendees: [],
      created_by: userRowId || null,
    }).select("id").maybeSingle();
    setSaving(false);
    if (error) { toast.error(writeErrorMessage(error)); return; }
    navigate({ to: "/education/$id", params: { id: data.id } });
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-4">
      <Link to="/education"><Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />목록</Button></Link>
      <h1 className="text-2xl font-bold">교육 등록</h1>

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
          <Label>교육 종류</Label>
          <div className="grid grid-cols-3 gap-1.5 mt-1">
            {EDUCATION_PRESETS.map((p) => (
              <button key={p.category} type="button" onClick={() => pickCategory(p.category)}
                className={`py-2.5 rounded-md border text-sm font-medium ${category === p.category ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}>
                {p.category}
              </button>
            ))}
          </div>
          <div className="mt-2 text-xs bg-primary/5 border border-primary/20 rounded-md px-3 py-2 space-y-1">
            <div className="font-medium text-primary">{preset.legalBasis}</div>
            <div className="text-muted-foreground">{preset.guide}</div>
          </div>
        </div>
        <div>
          <Label>제목 (비우면 자동 생성)</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${category} 안전보건교육`} className="h-11 mt-1" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>방식</Label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full h-11 px-3 rounded-md border bg-background text-sm mt-1">
              {EDU_METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <Label>일자</Label>
            <Input type="date" value={eduDate} onChange={(e) => setEduDate(e.target.value)} className="h-11 mt-1" />
          </div>
          <div>
            <Label>시간(분)</Label>
            <Input type="number" min={0} value={minutes} onChange={(e) => setMinutes(Number(e.target.value) || 0)} className="h-11 mt-1" />
          </div>
        </div>
        <div>
          <Label>강사/실시자 (선택)</Label>
          <Input value={instructor} onChange={(e) => setInstructor(e.target.value)} placeholder="예: 관리소장 또는 외부 강사" className="h-11 mt-1" />
        </div>

        <Button onClick={submit} disabled={saving} className="w-full h-12">
          {saving ? "생성 중..." : "등록하고 참석자 입력"}
        </Button>
      </CardContent></Card>
    </div>
  );
}
