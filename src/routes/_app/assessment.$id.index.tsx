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
import { ListChecks, ShieldCheck, Users, FileText, Printer, Pencil, Trash2, Check, X } from "lucide-react";
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

  const [editHazardId, setEditHazardId] = useState<string | null>(null);
  const [editHazardDesc, setEditHazardDesc] = useState("");

  const upd = useServerFn(updateAssessment);
  const del = useServerFn(deleteAssessment);

  async function saveHazardDesc(hid: string) {
    if (!editHazardDesc.trim()) { toast.error("내용을 입력하세요"); return; }
    const { data, error } = await supabase.from("hazards").update({ description: editHazardDesc.trim() }).eq("id", hid).select();
    if (error) { toast.error(error.message); return; }
    if (!data || data.length === 0) { toast.error("권한이 없어 수정할 수 없습니다"); return; }
    toast.success("저장되었습니다");
    setEditHazardId(null);
    await load();
  }

  async function deleteHazard(hid: string) {
    if (!confirm("이 유해·위험요인을 삭제하시겠습니까? 관련 감소대책도 함께 삭제됩니다.")) return;
    const { error: mErr } = await supabase.from("measures").delete().eq("hazard_id", hid);
    if (mErr) { toast.error(mErr.message); return; }
    const { data, error } = await supabase.from("hazards").delete().eq("id", hid).select();
    if (error) { toast.error(error.message); return; }
    if (!data || data.length === 0) { toast.error("권한이 없어 삭제할 수 없습니다"); return; }
    toast.success("삭제되었습니다");
    await load();
  }

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
          <Link to="/assessment/$id/inputs" params={{ id }}><Button variant="outline" size="sm">직원 참여</Button></Link>
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => setDelOpen(true)} className="gap-1 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" />삭제</Button>
          )}
        </div>
      </div>

      {/* 진행 단계 스텝퍼 — 위험성평가 순서대로 */}
      {(() => {
        const total = hazards.length;
        const leveled = total > 0 && hazards.every((h: any) => h.level);
        const measured = hazards.reduce((s: number, h: any) => s + (h.measures?.length ?? 0), 0) > 0;
        const steps = [
          { label: "유해·위험요인 파악", to: "/assessment/$id/hazards", done: total > 0, show: true },
          { label: "위험성 결정", to: "/assessment/$id/results", done: leveled, show: canManage },
          { label: "감소대책", to: "/assessment/$id/measures", done: measured, show: true },
          { label: "협의·공유", to: "/assessment/$id/share", done: sigCount > 0, show: true },
          { label: "기록·결과서 출력", to: "/assessment/$id/report", done: false, show: canManage, output: true },
        ].filter((s) => s.show);
        const currentIdx = steps.findIndex((s) => !s.done && !(s as any).output);
        return (
          <div className="flex items-stretch gap-1.5 overflow-x-auto pb-1">
            {steps.map((s, i) => (
              <Link key={s.label} to={s.to as any} params={{ id }} className="shrink-0">
                <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  i === currentIdx ? "border-primary bg-primary/5"
                    : s.done ? "border-success/40 bg-success/5"
                    : (s as any).output ? "border-secondary bg-secondary/40"
                    : "border-border hover:bg-muted/40"}`}>
                  <span className={`flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold shrink-0 ${
                    s.done ? "bg-success text-white" : i === currentIdx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {s.done ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  <span className="whitespace-nowrap font-medium">{s.label}</span>
                  {i < steps.length - 1 && <span className="text-muted-foreground/40 ml-1">›</span>}
                </div>
              </Link>
            ))}
          </div>
        );
      })()}

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
                {editHazardId === h.id ? (
                  <div className="flex-1 flex gap-2">
                    <Input value={editHazardDesc} onChange={e => setEditHazardDesc(e.target.value)} className="h-9" />
                    <Button size="sm" variant="outline" onClick={() => saveHazardDesc(h.id)}><Check className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditHazardId(null)}><X className="h-4 w-4" /></Button>
                  </div>
                ) : (
                  <>
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
                    {canManage && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => { setEditHazardId(h.id); setEditHazardDesc(h.description); }}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2 text-destructive hover:text-destructive" onClick={() => deleteHazard(h.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    )}
                  </>
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
