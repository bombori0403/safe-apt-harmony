import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MessageCircle, Search, Pencil } from "lucide-react";
import { toast } from "sonner";
import { riskLevelClass, type RiskLevel } from "@/lib/types";
import { updateAssessment } from "@/lib/assessment.functions";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/history")({
  component: History,
});

function History() {
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const canManage = role === "admin" || role === "manager";
  const [items, setItems] = useState<any[]>([]);
  const [complexes, setComplexes] = useState<{ id: string; name: string }[]>([]);
  const [complexId, setComplexId] = useState<string>("");
  const [q, setQ] = useState("");

  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ work_name: "", assessment_date: "", location: "", status: "작성중" });
  const [saving, setSaving] = useState(false);
  const upd = useServerFn(updateAssessment);

  const load = () => {
    supabase.from("assessments").select("*").order("assessment_date", { ascending: false }).then(({ data }) => {
      setItems(data ?? []);
    });
  };

  useEffect(() => {
    load();
    supabase.from("complexes").select("id,name").order("name").then(({ data }) => {
      setComplexes((data as any) ?? []);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("users").select("org_role").eq("auth_id", user.id).maybeSingle()
      .then(({ data }) => setRole(data?.org_role ?? null));
  }, [user]);

  const complexName = useMemo(() => {
    const m = new Map<string, string>();
    complexes.forEach(c => m.set(c.id, c.name));
    return m;
  }, [complexes]);

  const filtered = items.filter(i =>
    (!q || i.work_name?.includes(q)) &&
    (!complexId || i.complex_id === complexId)
  );

  const openEdit = (a: any) => {
    setEditing(a);
    setForm({
      work_name: a.work_name ?? "",
      assessment_date: a.assessment_date ?? "",
      location: a.location ?? "",
      status: a.status ?? "작성중",
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await upd({ data: {
        assessmentId: editing.id,
        work_name: form.work_name.trim(),
        assessment_date: form.assessment_date,
        location: form.location.trim() || null,
        status: form.status as "작성중" | "협의중" | "완료",
      } });
      toast.success("저장되었습니다.");
      setEditing(null);
      load();
    } catch (e: any) {
      toast.error("저장 실패: " + (e?.message ?? e));
    } finally { setSaving(false); }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold">평가 이력</h1>
        <p className="text-sm text-muted-foreground mt-1">
          위험성평가 결과는 3년간 보존하여야 합니다 (산업안전보건법 시행규칙).
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px]">
          <Label className="text-xs">단지</Label>
          <select
            value={complexId}
            onChange={e => setComplexId(e.target.value)}
            className="h-10 px-3 rounded-md border bg-background text-sm block w-full mt-1"
          >
            <option value="">전체 단지</option>
            {complexes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Label className="text-xs">검색</Label>
          <div className="relative mt-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={e=>setQ(e.target.value)} placeholder="작업명 검색..." className="pl-9" />
          </div>
        </div>
        <div className="text-xs text-muted-foreground ml-auto">총 {filtered.length}건</div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {filtered.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">기록이 없습니다.</div>
            )}
            {filtered.map(a => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 p-4 hover:bg-muted/40 transition-colors">
                <Link to="/assessment/$id" params={{ id: a.id }} className="flex-1 min-w-0">
                  <div className="font-medium truncate">{a.work_name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {complexName.get(a.complex_id) ?? "-"} · {a.assessment_date} · {a.method} · {a.work_category ?? "-"}
                  </div>
                </Link>
                <Badge variant="outline">{a.status}</Badge>
                {a.allowable_level && (
                  <span className={`px-2 py-1 rounded-md text-xs font-medium ${riskLevelClass(a.allowable_level as RiskLevel)}`}>
                    허용 {a.allowable_level}
                  </span>
                )}
                {canManage && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(a)}
                    className="gap-1.5 h-8 text-xs"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    수정
                  </Button>
                )}
                <Link
                  to="/assessment/$id/inputs"
                  params={{ id: a.id }}
                  className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  직원 참여
                </Link>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>평가 정보 수정</DialogTitle>
            <DialogDescription>작업명, 날짜, 장소, 상태를 변경할 수 있습니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>작업명</Label><Input value={form.work_name} onChange={e => setForm({ ...form, work_name: e.target.value })} /></div>
            <div><Label>평가일</Label><Input type="date" value={form.assessment_date} onChange={e => setForm({ ...form, assessment_date: e.target.value })} /></div>
            <div><Label>장소</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
            <div>
              <Label>상태</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="작성중">작성중</SelectItem>
                  <SelectItem value="협의중">협의중</SelectItem>
                  <SelectItem value="완료">완료</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>취소</Button>
            <Button onClick={handleSave} disabled={saving || !form.work_name.trim() || !form.assessment_date}>
              {saving ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
