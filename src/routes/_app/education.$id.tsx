import { createFileRoute, useParams, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SignedImg } from "@/components/signed-img";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Camera, Loader2, X, CheckCircle2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { writeErrorMessage } from "@/lib/write-error";
import { uploadPhotos } from "@/lib/photo-upload";
import { ATTENDEE_ROLES } from "@/lib/tbm-presets";

export const Route = createFileRoute("/_app/education/$id")({
  component: EducationDetail,
});

type Attendee = { name: string; role: string; attended: boolean; completed: boolean; source: string; note: string };

function EducationDetail() {
  const { id } = useParams({ from: "/_app/education/$id" });
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [row, setRow] = useState<any>(null);
  const [content, setContent] = useState("");
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState(ATTENDEE_ROLES[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  async function load() {
    setLoading(true);
    const { data } = await (supabase as any).from("safety_educations").select("*").eq("id", id).maybeSingle();
    setRow(data);
    setContent(data?.content ?? "");
    setAttendees((data?.attendees ?? []) as Attendee[]);
    setPhotos((data?.photos ?? []) as string[]);
    setLoading(false);
  }

  function addAttendee() {
    if (!newName.trim()) return;
    setAttendees([...attendees, { name: newName.trim(), role: newRole, attended: true, completed: true, source: "내부", note: "" }]);
    setNewName("");
  }
  function patch(i: number, p: Partial<Attendee>) {
    setAttendees((prev) => prev.map((a, j) => (j === i ? { ...a, ...p } : a)));
  }

  async function addPhotos(files: FileList) {
    setBusy(true);
    try { setPhotos([...photos, ...(await uploadPhotos(files, "safety-photos", "education"))]); }
    catch (e: any) { toast.error(e.message ?? "업로드 실패"); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function save(extra: Record<string, any> = {}, silent = false) {
    setSaving(true);
    const { error } = await (supabase as any).from("safety_educations").update({ content: content || null, attendees, photos, ...extra }).eq("id", id);
    setSaving(false);
    if (error) { toast.error(writeErrorMessage(error)); return false; }
    if (!silent) toast.success("저장되었습니다");
    return true;
  }

  async function complete() {
    if (attendees.length === 0) { toast.error("참석자를 1명 이상 추가해주세요"); return; }
    if (await save({ status: "완료" }, true)) { toast.success("교육이 완료 처리되었습니다"); navigate({ to: "/education" }); }
  }
  async function remove() {
    if (!confirm("이 교육을 삭제할까요? 되돌릴 수 없습니다.")) return;
    const { error } = await (supabase as any).from("safety_educations").delete().eq("id", id);
    if (error) { toast.error(writeErrorMessage(error)); return; }
    toast.success("삭제되었습니다"); navigate({ to: "/education" });
  }

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground">불러오는 중...</div>;
  if (!row) return <div className="p-8 text-center text-sm text-muted-foreground">교육을 찾을 수 없습니다.</div>;
  const done = row.status === "완료";

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-4">
      <Link to="/education"><Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />목록</Button></Link>

      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{row.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="px-1.5 py-0.5 rounded bg-muted font-medium">{row.category}</span> · {row.method}
            {row.edu_date && <> · {row.edu_date}</>}
            {" · "}<span className={done ? "text-success font-medium" : "text-warning font-medium"}>{row.status}</span>
          </p>
          {row.legal_basis && <p className="text-xs text-primary mt-1">{row.legal_basis}</p>}
        </div>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-danger" onClick={remove}><Trash2 className="h-4 w-4" /></Button>
      </div>

      <Card><CardContent className="p-4">
        <Label>교육 내용 (선택)</Label>
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} className="mt-1" placeholder="교육 주제·요점" />
      </CardContent></Card>

      <Card><CardContent className="p-4 space-y-3">
        <Label>참석자 / 이수 ({attendees.length}명)</Label>
        {attendees.map((a, i) => (
          <div key={i} className="rounded-md border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm flex-1">{a.name} <span className="text-xs text-muted-foreground">{a.role}</span></span>
              <select value={a.source} onChange={(e) => patch(i, { source: e.target.value })} className="h-8 px-2 rounded-md border bg-background text-xs">
                <option value="내부">내부</option>
                <option value="외부">외부(수료증)</option>
              </select>
              <button type="button" onClick={() => setAttendees(attendees.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-danger"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => patch(i, { attended: !a.attended })}
                className={`flex-1 py-1.5 rounded-md border text-xs font-medium ${a.attended ? "bg-primary/10 text-primary border-primary/40" : "bg-background"}`}>
                {a.attended ? "참석" : "불참"}
              </button>
              <button type="button" onClick={() => patch(i, { completed: !a.completed })}
                className={`flex-1 py-1.5 rounded-md border text-xs font-medium ${a.completed ? "bg-success text-white border-success" : "bg-background"}`}>
                {a.completed ? "이수 완료" : "미이수"}
              </button>
            </div>
          </div>
        ))}
        <div className="flex gap-2">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="참석자 이름" className="h-10 flex-1" onKeyDown={(e) => e.key === "Enter" && addAttendee()} />
          <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="h-10 px-2 rounded-md border bg-background text-sm">
            {ATTENDEE_ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
          <Button type="button" variant="outline" className="h-10 shrink-0" onClick={addAttendee}><UserPlus className="h-4 w-4" /></Button>
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-4">
        <Label>교육 사진 / 수료증 (선택)</Label>
        <div className="mt-1 flex flex-wrap gap-2">
          {photos.map((url, i) => (
            <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border">
              <SignedImg src={url} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => setPhotos(photos.filter((_, j) => j !== i))} className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5"><X className="h-3 w-3" /></button>
            </div>
          ))}
          <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="w-20 h-20 rounded-md border-2 border-dashed flex items-center justify-center text-muted-foreground hover:border-primary">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => e.target.files && addPhotos(e.target.files)} />
      </CardContent></Card>

      <div className="sticky bottom-16 md:bottom-4 bg-background/80 backdrop-blur rounded-xl border p-3 flex gap-2">
        <Button variant="outline" className="flex-1 h-11" onClick={() => save()} disabled={saving}>{saving ? "저장 중..." : "임시 저장"}</Button>
        <Button className="flex-1 h-11 gap-1.5" onClick={complete} disabled={saving || done}><CheckCircle2 className="h-4 w-4" />{done ? "완료됨" : "교육 완료"}</Button>
      </div>
    </div>
  );
}
