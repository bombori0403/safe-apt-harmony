import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { riskLevelClass, type RiskLevel } from "@/lib/types";
import { ListChecks, ShieldCheck, Users, FileText, Printer, Pencil, Trash2 } from "lucide-react";
import { deleteAssessment, updateAssessment } from "@/lib/assessment.functions";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/assessment/$id/")({
  component: Detail,
});

function Detail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const canManage = role === "admin" || role === "manager";
  const [a, setA] = useState<any>(null);
  const [hazards, setHazards] = useState<any[]>([]);
  const [parts, setParts] = useState<any[]>([]);
  const [sigCount, setSigCount] = useState(0);

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ work_name: "", assessment_date: "", location: "", status: "작성중" });
  const [saving, setSaving] = useState(false);

  const [delOpen, setDelOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const upd = useServerFn(updateAssessment);
  const del = useServerFn(deleteAssessment);

  const load = async () => {
    const { data: ass } = await supabase.from("assessments").select("*").eq("id", id).maybeSingle();
    setA(ass);
    if (ass) {
      setForm({
        work_name: ass.work_name ?? "",
        assessment_date: ass.assessment_date ?? "",
        location: ass.location ?? "",
        status: ass.status ?? "작성중",
      });
    }
    const { data: h } = await supabase.from("hazards").select("*, measures(*)").eq("assessment_id", id);
    setHazards(h ?? []);
    const { data: p } = await supabase.from("participants").select("*").eq("assessment_id", id);
    setParts(p ?? []);
    const { count } = await supabase.from("signatures").select("*", { count: "exact", head: true }).eq("assessment_id", id);
    setSigCount(count ?? 0);
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (!user) return;
    supabase.from("users").select("org_role").eq("auth_id", user.id).maybeSingle()
      .then(({ data }) => setRole(data?.org_role ?? null));
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await upd({ data: {
        assessmentId: id,
        work_name: form.work_name.trim(),
        assessment_date: form.assessment_date,
        location: form.location.trim() || null,
        status: form.status as "작성중" | "협의중" | "완료",
      } });
      toast.success("저장되었습니다.");
      setEditOpen(false);
      await load();
    } catch (e: any) {
      toast.error("저장 실패: " + (e?.message ?? e));
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await del({ data: { assessmentId: id } });
      toast.success("삭제되었습니다.");
      navigate({ to: "/history" });
    } catch (e: any) {
      toast.error("삭제 실패: " + (e?.message ?? e));
      setDeleting(false);
    }
  };

  if (!a) return <div className="p-8 text-muted-foreground">불러오는 중...</div>;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="secondary">{a.method}</Badge>
            <Badge variant="outline">{a.assessment_type}</Badge>
            <Badge>{a.status}</Badge>
          </div>
          <h1 className="text-2xl font-bold mt-2">{a.work_name}</h1>
          <p className="text-sm text-muted-foreground">{a.assessment_date} · {a.location ?? "-"} · {a.work_category ?? "-"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-1"><Pencil className="h-4 w-4" />수정</Button>
          )}
          <Link to="/assessment/$id/hazards" params={{ id }}><Button variant="outline" size="sm">유해·위험요인</Button></Link>
          {canManage && (
            <Link to="/assessment/$id/results" params={{ id }}><Button variant="outline" size="sm">위험성 결정</Button></Link>
          )}
          <Link to="/assessment/$id/measures" params={{ id }}><Button variant="outline" size="sm">감소대책</Button></Link>
          <Link to="/assessment/$id/inputs" params={{ id }}><Button variant="outline" size="sm">직원 참여</Button></Link>
          <Link to="/assessment/$id/share" params={{ id }}><Button size="sm">협의·공유</Button></Link>
          {canManage && (
            <Link to="/assessment/$id/report" params={{ id }}><Button size="sm" variant="secondary" className="gap-1"><Printer className="h-4 w-4" />결과서</Button></Link>
          )}
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => setDelOpen(true)} className="gap-1 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" />삭제</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={ListChecks} title="유해·위험요인" value={hazards.length} />
        <Stat icon={ShieldCheck} title="감소대책 수립" value={hazards.reduce((s, h) => s + (h.measures?.length ?? 0), 0)} />
        <Stat icon={Users} title="참여자" value={parts.length} />
        <Stat icon={FileText} title="확인 서명" value={`${sigCount}/${parts.length}`} />
      </div>

      <Card><CardContent className="p-0">
        <div className="p-4 border-b font-semibold">유해·위험요인 목록</div>
        {hazards.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">아직 유해·위험요인이 없습니다.</div>
        ) : (
          <div className="divide-y">
            {hazards.map(h => (
              <div key={h.id} className="p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{h.description}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    감소대책 {h.measures?.length ?? 0}건
                    {h.likelihood && h.severity && ` · ${h.likelihood}×${h.severity}=${h.likelihood * h.severity}점`}
                  </div>
                </div>
                {h.level && (
                  <span className={`px-2 py-1 rounded text-xs font-medium ${riskLevelClass(h.level as RiskLevel)}`}>{h.level}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
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
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>취소</Button>
            <Button onClick={handleSave} disabled={saving || !form.work_name.trim() || !form.assessment_date}>{saving ? "저장 중..." : "저장"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={delOpen} onOpenChange={setDelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>평가를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              관련된 모든 유해·위험요인, 감소대책, 참여자, 서명이 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({ icon: Icon, title, value }: { icon: any; title: string; value: any }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground text-xs">
          <span>{title}</span><Icon className="h-4 w-4" />
        </div>
        <div className="text-2xl font-bold mt-1.5">{value}</div>
      </CardContent>
    </Card>
  );
}
