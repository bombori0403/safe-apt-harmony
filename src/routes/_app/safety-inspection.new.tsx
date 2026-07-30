import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { writeErrorMessage } from "@/lib/write-error";
import { getCurrentUserContext } from "@/lib/user-context";
import { INSPECTION_PRESETS, INSPECTION_TYPES, RECURRENCE_OPTIONS } from "@/lib/inspection-presets";

export const Route = createFileRoute("/_app/safety-inspection/new")({
  component: NewInspection,
});

type Item = { category: string; text: string; result: string; improvement: string; assignee: string; action: string; actionPhotos: string[]; actionDone: boolean };

function blankItem(category: string, text: string): Item {
  return { category, text, result: "", improvement: "", assignee: "", action: "", actionPhotos: [], actionDone: false };
}

function NewInspection() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [userRowId, setUserRowId] = useState("");
  const [orgId, setOrgId] = useState("");
  const [complexes, setComplexes] = useState<{ id: string; name: string }[]>([]);
  const [complexId, setComplexId] = useState("");
  const [category, setCategory] = useState(INSPECTION_PRESETS[0].category);
  const [type, setType] = useState<string>(INSPECTION_TYPES[0]);
  const [title, setTitle] = useState("");
  const [scheduledDate, setScheduledDate] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10));
  const [recurrence, setRecurrence] = useState("monthly");
  const [items, setItems] = useState<Item[]>(() => INSPECTION_PRESETS[0].items.map((t) => blankItem(INSPECTION_PRESETS[0].category, t)));
  const [newItemText, setNewItemText] = useState("");
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

  function applyPreset(cat: string) {
    setCategory(cat);
    const preset = INSPECTION_PRESETS.find((p) => p.category === cat);
    if (preset) setItems(preset.items.map((t) => blankItem(cat, t)));
  }

  const preset = INSPECTION_PRESETS.find((p) => p.category === category);

  async function submit() {
    if (!complexId) { toast.error("단지를 선택해주세요"); return; }
    if (items.length === 0) { toast.error("점검 항목을 1개 이상 추가해주세요"); return; }
    let effectiveOrg = orgId;
    if (!effectiveOrg && user) {
      const { data } = await supabase.from("users").select("organization_id").eq("auth_id", user.id).maybeSingle();
      effectiveOrg = data?.organization_id ?? "";
    }
    if (!effectiveOrg) { toast.error("조직 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요."); return; }
    setSaving(true);
    const { data, error } = await (supabase as any).from("safety_inspections").insert({
      complex_id: complexId,
      organization_id: effectiveOrg,
      title: title.trim() || `${category} 안전점검`,
      inspection_type: type,
      checklist_category: category,
      scheduled_date: scheduledDate || null,
      recurrence,
      status: "예정",
      items,
      created_by: userRowId || null,
    }).select("id").maybeSingle();
    setSaving(false);
    if (error) { toast.error(writeErrorMessage(error)); return; }
    toast.success("점검이 생성되었습니다. 이제 점검을 실시하세요.");
    navigate({ to: "/safety-inspection/$id", params: { id: data.id } });
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-4">
      <Link to="/safety-inspection"><Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />목록</Button></Link>
      <h1 className="text-2xl font-bold">점검 만들기</h1>

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
          <Label>시설 분류 (선택하면 표준 점검 항목이 채워집니다)</Label>
          <select value={category} onChange={(e) => applyPreset(e.target.value)} className="w-full h-11 px-3 rounded-md border bg-background text-sm mt-1">
            {INSPECTION_PRESETS.map((p) => <option key={p.category} value={p.category}>{p.category}</option>)}
          </select>
          {preset && <p className="text-xs text-muted-foreground mt-1">권장 주기: {preset.cycle}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>점검 구분</Label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full h-11 px-3 rounded-md border bg-background text-sm mt-1">
              {INSPECTION_TYPES.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <Label>점검 예정일</Label>
            <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="h-11 mt-1" />
          </div>
        </div>
        <div>
          <Label>제목 (비우면 자동 생성)</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${category} 안전점검`} className="h-11 mt-1" />
        </div>
        <div>
          <Label>반복 주기</Label>
          <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)} className="w-full h-11 px-3 rounded-md border bg-background text-sm mt-1">
            {RECURRENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <p className="text-xs text-muted-foreground mt-1">완료 처리하면 다음 회차 점검이 예정일로 자동 생성됩니다.</p>
        </div>

        <div>
          <Label>점검 항목 ({items.length}개)</Label>
          <div className="mt-2 space-y-1.5">
            {items.map((it, i) => (
              <div key={i} className="flex items-center gap-2 text-sm bg-muted/40 rounded-md px-3 py-2">
                <span className="flex-1">{it.text}</span>
                <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-danger">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <Input value={newItemText} onChange={(e) => setNewItemText(e.target.value)} placeholder="항목 직접 추가" className="h-10"
              onKeyDown={(e) => { if (e.key === "Enter" && newItemText.trim()) { setItems([...items, blankItem(category, newItemText.trim())]); setNewItemText(""); } }} />
            <Button type="button" variant="outline" className="h-10 shrink-0" onClick={() => { if (newItemText.trim()) { setItems([...items, blankItem(category, newItemText.trim())]); setNewItemText(""); } }}>
              <Plus className="h-4 w-4" />추가
            </Button>
          </div>
        </div>

        <Button onClick={submit} disabled={saving} className="w-full h-12">
          {saving ? "생성 중..." : "점검 생성하고 실시하기"}
        </Button>
      </CardContent></Card>
    </div>
  );
}
