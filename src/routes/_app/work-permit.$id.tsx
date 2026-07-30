import { createFileRoute, useParams, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SignedImg } from "@/components/signed-img";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Camera, Loader2, X, CheckCircle2, Trash2, ShieldCheck, UserPlus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { writeErrorMessage } from "@/lib/write-error";
import { uploadPhotos } from "@/lib/photo-upload";
import { GAS_FIELDS } from "@/lib/permit-presets";

export const Route = createFileRoute("/_app/work-permit/$id")({
  component: PermitDetail,
});

type Check = { text: string; required: boolean; result: string };
const RESULTS = ["양호", "불량", "해당없음"];

function PermitDetail() {
  const { id } = useParams({ from: "/_app/work-permit/$id" });
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [row, setRow] = useState<any>(null);
  const [checklist, setChecklist] = useState<Check[]>([]);
  const [gas, setGas] = useState<Record<string, string>>({});
  const [workers, setWorkers] = useState<string[]>([]);
  const [newWorker, setNewWorker] = useState("");
  const [supervisor, setSupervisor] = useState("");
  const [watcher, setWatcher] = useState("");
  const [approver, setApprover] = useState("");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  async function load() {
    setLoading(true);
    const { data } = await (supabase as any).from("work_permits").select("*").eq("id", id).maybeSingle();
    setRow(data);
    setChecklist((data?.checklist ?? []) as Check[]);
    setGas((data?.gas ?? {}) as Record<string, string>);
    setWorkers((data?.workers ?? []) as string[]);
    setSupervisor(data?.supervisor_name ?? "");
    setWatcher(data?.safety_watcher ?? "");
    setApprover(data?.approver_name ?? "");
    setNote(data?.note ?? "");
    setPhotos((data?.photos ?? []) as string[]);
    setLoading(false);
  }

  async function addPhotos(files: FileList) {
    setBusy(true);
    try { setPhotos([...photos, ...(await uploadPhotos(files, "safety-photos", "permit"))]); }
    catch (e: any) { toast.error(e.message ?? "업로드 실패"); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  function payload(extra: Record<string, any> = {}) {
    return {
      checklist, gas, workers, supervisor_name: supervisor || null, safety_watcher: watcher || null,
      approver_name: approver || null, note: note || null, photos, ...extra,
    };
  }

  async function save(extra: Record<string, any> = {}, silent = false) {
    setSaving(true);
    const { error } = await (supabase as any).from("work_permits").update(payload(extra)).eq("id", id);
    setSaving(false);
    if (error) { toast.error(writeErrorMessage(error)); return false; }
    if (!silent) toast.success("저장되었습니다");
    return true;
  }

  const unchecked = checklist.filter((c) => c.required && !c.result).length;
  const failed = checklist.filter((c) => c.result === "불량").length;
  const gasMissing = row?.gas_required && GAS_FIELDS.some((f) => !gas[f.key]);

  async function approve() {
    if (unchecked > 0) { toast.error(`점검하지 않은 필수 항목이 ${unchecked}개 있습니다`); return; }
    if (failed > 0) { toast.error("'불량' 항목이 있어 승인할 수 없습니다. 조치 후 다시 점검하세요."); return; }
    if (gasMissing) { toast.error("가스농도 측정값을 모두 입력해야 승인할 수 있습니다"); return; }
    if (!approver.trim()) { toast.error("승인자(관리소장 등)를 입력하세요"); return; }
    if (await save({ status: "승인", approved_at: new Date().toISOString() }, true)) {
      toast.success("작업이 허가(승인)되었습니다"); load();
    }
  }
  async function complete() {
    if (await save({ status: "완료" }, true)) { toast.success("작업이 완료 처리되었습니다"); navigate({ to: "/work-permit" }); }
  }
  async function remove() {
    if (!confirm("이 허가서를 삭제할까요? 되돌릴 수 없습니다.")) return;
    const { error } = await (supabase as any).from("work_permits").delete().eq("id", id);
    if (error) { toast.error(writeErrorMessage(error)); return; }
    toast.success("삭제되었습니다"); navigate({ to: "/work-permit" });
  }

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground">불러오는 중...</div>;
  if (!row) return <div className="p-8 text-center text-sm text-muted-foreground">허가서를 찾을 수 없습니다.</div>;

  const approved = row.status === "승인" || row.status === "완료";
  const done = row.status === "완료";

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-4">
      <Link to="/work-permit"><Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />목록</Button></Link>

      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{row.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="px-1.5 py-0.5 rounded bg-muted font-medium">{row.permit_type}</span>
            {row.work_date && <> · {row.work_date}</>}{row.work_location && <> · {row.work_location}</>}
            {" · "}<span className={done ? "text-success font-medium" : approved ? "text-primary font-medium" : "text-warning font-medium"}>{row.status}</span>
          </p>
        </div>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-danger" onClick={remove}><Trash2 className="h-4 w-4" /></Button>
      </div>

      {/* 작업자 · 책임자 */}
      <Card><CardContent className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>작업책임자</Label>
            <Input value={supervisor} onChange={(e) => setSupervisor(e.target.value)} className="h-10 mt-1" placeholder="예: 시설과장" />
          </div>
          <div>
            <Label>안전(화재)감시인</Label>
            <Input value={watcher} onChange={(e) => setWatcher(e.target.value)} className="h-10 mt-1" placeholder="밀폐·화기 필수" />
          </div>
        </div>
        <div>
          <Label>작업 인원 ({workers.length}명)</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {workers.map((w, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-sm">
                {w}<button type="button" onClick={() => setWorkers(workers.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-danger"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <Input value={newWorker} onChange={(e) => setNewWorker(e.target.value)} placeholder="작업자 이름" className="h-10" onKeyDown={(e) => { if (e.key === "Enter" && newWorker.trim()) { setWorkers([...workers, newWorker.trim()]); setNewWorker(""); } }} />
            <Button type="button" variant="outline" className="h-10 shrink-0" onClick={() => { if (newWorker.trim()) { setWorkers([...workers, newWorker.trim()]); setNewWorker(""); } }}><UserPlus className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardContent></Card>

      {/* 가스농도 측정 (밀폐·화기) */}
      {row.gas_required && (
        <Card className={gasMissing ? "border-danger/50" : ""}><CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-1.5 font-medium text-sm text-danger"><AlertTriangle className="h-4 w-4" />가스농도 측정 (필수)</div>
          <div className="grid grid-cols-2 gap-3">
            {GAS_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="text-xs text-muted-foreground">{f.label}</label>
                <Input value={gas[f.key] ?? ""} onChange={(e) => setGas({ ...gas, [f.key]: e.target.value })} className="h-10 mt-1" placeholder={f.hint} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">측정 시각</label>
              <Input type="datetime-local" value={gas.measuredAt ?? ""} onChange={(e) => setGas({ ...gas, measuredAt: e.target.value })} className="h-10 mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">측정자</label>
              <Input value={gas.measuredBy ?? ""} onChange={(e) => setGas({ ...gas, measuredBy: e.target.value })} className="h-10 mt-1" />
            </div>
          </div>
        </CardContent></Card>
      )}

      {/* 착수 전 점검 체크리스트 */}
      <Card><CardContent className="p-4 space-y-3">
        <Label>착수 전 안전점검</Label>
        {checklist.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="flex-1 text-sm">{c.text}</span>
            <div className="grid grid-cols-3 gap-1">
              {RESULTS.map((r) => (
                <button key={r} type="button" onClick={() => setChecklist(checklist.map((x, j) => j === i ? { ...x, result: r } : x))}
                  className={`px-2 py-1.5 rounded-md border text-xs font-medium ${c.result === r
                    ? r === "불량" ? "bg-danger text-white border-danger" : r === "양호" ? "bg-success text-white border-success" : "bg-muted-foreground text-white border-muted-foreground"
                    : "bg-background"}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
        ))}
      </CardContent></Card>

      {/* 승인 · 사진 */}
      <Card><CardContent className="p-4 space-y-3">
        <div>
          <Label>승인자 (관리소장 등)</Label>
          <Input value={approver} onChange={(e) => setApprover(e.target.value)} className="h-10 mt-1" placeholder="승인 시 필수" disabled={done} />
        </div>
        <div>
          <Label>특이사항 (선택)</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1" />
        </div>
        <div>
          <Label>현장 사진 (선택)</Label>
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
        </div>
      </CardContent></Card>

      <div className="sticky bottom-16 md:bottom-4 bg-background/80 backdrop-blur rounded-xl border p-3 space-y-2">
        {(unchecked > 0 || failed > 0 || gasMissing) && !approved && (
          <p className="text-xs text-center text-muted-foreground">
            {unchecked > 0 && <>미점검 {unchecked}개 </>}
            {failed > 0 && <span className="text-danger">· 불량 {failed}개 </span>}
            {gasMissing && <span className="text-danger">· 가스측정 미입력</span>}
          </p>
        )}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 h-11" onClick={() => save()} disabled={saving}>{saving ? "저장 중..." : "임시 저장"}</Button>
          {!approved ? (
            <Button className="flex-1 h-11 gap-1.5" onClick={approve} disabled={saving}><ShieldCheck className="h-4 w-4" />작업 허가(승인)</Button>
          ) : (
            <Button className="flex-1 h-11 gap-1.5" onClick={complete} disabled={saving || done}><CheckCircle2 className="h-4 w-4" />{done ? "완료됨" : "작업 완료"}</Button>
          )}
        </div>
      </div>
    </div>
  );
}
