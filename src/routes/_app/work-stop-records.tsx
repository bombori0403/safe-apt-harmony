import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SignedImg } from "@/components/signed-img";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, ShieldAlert, Camera, X, Loader2, CheckCircle2, Printer, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { writeErrorMessage } from "@/lib/write-error";
import { getCurrentUserContext } from "@/lib/user-context";
import { compressImage } from "@/lib/image-compress";

export const Route = createFileRoute("/_app/work-stop-records")({
  component: WorkStopRecords,
});

const MIN_PHOTOS = 2;

// datetime-local 입력은 "로컬" 벽시계 문자열을 다룬다. UTC(toISOString)를 그대로
// 넣으면 시간대만큼 어긋나므로 로컬 기준 YYYY-MM-DDTHH:mm 으로 변환한다.
function toLocalInput(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function PhotoPicker({
  label, photos, onChange, disabled,
}: { label: string; photos: string[]; onChange: (urls: string[]) => void; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(files: FileList) {
    setBusy(true);
    const urls = [...photos];
    try {
      for (const file of Array.from(files)) {
        const blob = await compressImage(file);
        const path = `work-stop/${Date.now()}-${Math.random().toString(36).slice(2,8)}.jpg`;
        const { error } = await supabase.storage.from("near-miss-photos").upload(path, blob, {
          contentType: "image/jpeg", upsert: false,
        });
        if (error) throw error;
        const { data } = supabase.storage.from("near-miss-photos").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      onChange(urls);
    } catch (e: any) {
      toast.error(e.message ?? "업로드 실패");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div>
      <Label className="text-sm">{label} <span className="text-xs text-muted-foreground">(최소 {MIN_PHOTOS}장)</span></Label>
      <div className="flex flex-wrap gap-2 mt-1.5">
        {photos.map((url, i) => (
          <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border bg-muted">
            <SignedImg src={url} alt="" className="w-full h-full object-cover" />
            {!disabled && (
              <button type="button" onClick={() => onChange(photos.filter((_, idx) => idx !== i))}
                className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
        {!disabled && (
          <button type="button" onClick={() => ref.current?.click()} disabled={busy}
            className="w-20 h-20 rounded-md border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary text-[10px] gap-1">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
            {busy ? "업로드" : "사진 추가"}
          </button>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" capture="environment" multiple
        className="hidden" onChange={e => e.target.files && upload(e.target.files)} />
    </div>
  );
}

function WorkStopRecords() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [userRowId, setUserRowId] = useState("");
  const [complexes, setComplexes] = useState<{id:string;name:string}[]>([]);
  const [complexId, setComplexId] = useState("");

  const [exercisedAt, setExercisedAt] = useState(toLocalInput(new Date()));
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [contractorName, setContractorName] = useState("");
  const [workerName, setWorkerName] = useState("");
  const [supName, setSupName] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [workDesc, setWorkDesc] = useState("");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState("작업중단");
  const [resultDetail, setResultDetail] = useState("");
  const [causePhotos, setCausePhotos] = useState<string[]>([]);
  const [resolutionPhotos, setResolutionPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Resume dialog state
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [resumeDetail, setResumeDetail] = useState("");
  const [beforeFixPhotos, setBeforeFixPhotos] = useState<string[]>([]);
  const [resumePhotos, setResumePhotos] = useState<string[]>([]);
  const [existingCausePhotos, setExistingCausePhotos] = useState<string[]>([]);
  const [resumeSaving, setResumeSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    getCurrentUserContext(user.id).then(async ({ userId, complexId: ctx, userRow }) => {
      if (userId) setUserRowId(userId);
      let list: any[] = [];
      if (userRow?.org_role === "admin") {
        list = (await supabase.from("complexes").select("id,name").order("name")).data ?? [];
      } else {
        const { data: members } = await supabase.from("complex_members").select("complex_id").eq("user_id", userId ?? "");
        const ids = [...new Set((members ?? []).map((m:any)=>m.complex_id).filter(Boolean))];
        list = ids.length ? (await supabase.from("complexes").select("id,name").in("id", ids)).data ?? [] : [];
      }
      setComplexes(list);
      setComplexId(ctx ?? list[0]?.id ?? "");
    });
  }, [user]);

  useEffect(() => { load(); }, []);
  async function load() {
    const { data } = await (supabase as any).from("work_stop_records").select("*").order("exercised_at", { ascending: false });
    setItems(data ?? []);
  }

  function resetForm() {
    setEditId(null);
    setExercisedAt(toLocalInput(new Date()));
    setName(""); setPosition(""); setContractorName(""); setWorkerName(""); setWorkDesc(""); setReason(""); setResultDetail(""); setSupName(""); setSupPhone("");
    setCausePhotos([]); setResolutionPhotos([]); setResult("작업중단");
  }

  function openEdit(it: any) {
    setEditId(it.id);
    setComplexId(it.complex_id ?? "");
    setExercisedAt(toLocalInput(new Date(it.exercised_at)));
    setName(it.exerciser_name ?? "");
    setPosition(it.exerciser_position ?? "");
    setContractorName(it.contractor_name ?? "");
    setWorkerName(it.worker_name ?? "");
    setSupName(it.supervisor_name ?? "");
    setSupPhone(it.supervisor_phone ?? "");
    setWorkDesc(it.work_description ?? "");
    setReason(it.stop_reason ?? "");
    setResult(it.result ?? "작업중단");
    setResultDetail(it.result_detail ?? "");
    setCausePhotos(Array.isArray(it.cause_photos) ? it.cause_photos : []);
    setResolutionPhotos(Array.isArray(it.resolution_photos) ? it.resolution_photos : []);
    setOpen(true);
  }

  async function submit() {
    if (!complexId) { toast.error("단지를 선택해주세요"); return; }
    if (!name || !workDesc || !reason) { toast.error("필수 항목을 입력해주세요"); return; }
    if (causePhotos.length < MIN_PHOTOS) { toast.error(`중지 원인 사진을 최소 ${MIN_PHOTOS}장 첨부해주세요`); return; }
    if (result === "작업재개" && resolutionPhotos.length < MIN_PHOTOS) {
      toast.error(`시정 완료 사진을 최소 ${MIN_PHOTOS}장 첨부해주세요`); return;
    }
    setSaving(true);
    const payload = {
      complex_id: complexId,
      exercised_at: new Date(exercisedAt).toISOString(),
      exerciser_name: name,
      exerciser_position: position || null,
      contractor_name: contractorName || null,
      worker_name: workerName || null,
      work_description: workDesc,
      stop_reason: reason,
      result,
      result_detail: resultDetail || null,
      cause_photos: causePhotos,
      resolution_photos: resolutionPhotos,
      supervisor_name: supName || null,
      supervisor_phone: supPhone || null,
    };
    const { error } = editId
      ? await (supabase as any).from("work_stop_records").update(payload).eq("id", editId)
      : await (supabase as any).from("work_stop_records").insert({ ...payload, reported_by: userRowId || null, reflected_in_assessment: false });
    setSaving(false);
    if (error) { toast.error(writeErrorMessage(error)); return; }
    toast.success(editId ? "수정되었습니다" : "등록되었습니다");
    setOpen(false);
    resetForm();
    load();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const { data: del, error } = await (supabase as any).from("work_stop_records").delete().eq("id", deleteId).select("id");
    setDeleting(false);
    if (error) { toast.error(writeErrorMessage(error)); return; }
    if (!del || del.length === 0) { toast.error("삭제할 수 없습니다. 체험 기간이 종료되었거나 권한이 없습니다."); return; }
    toast.success("삭제되었습니다");
    setDeleteId(null);
    load();
  }

  async function submitResume() {
    if (!resumeId) return;
    if (resumePhotos.length < MIN_PHOTOS) { toast.error(`시정 완료 사진을 최소 ${MIN_PHOTOS}장 첨부해주세요`); return; }
    setResumeSaving(true);
    const mergedCause = [...existingCausePhotos, ...beforeFixPhotos];
    const { error } = await (supabase as any).from("work_stop_records").update({
      result: "작업재개",
      result_detail: resumeDetail || null,
      cause_photos: mergedCause,
      resolution_photos: resumePhotos,
    }).eq("id", resumeId);
    setResumeSaving(false);
    if (error) { toast.error(writeErrorMessage(error)); return; }
    toast.success("작업 재개 처리되었습니다");
    setResumeId(null); setResumeDetail(""); setResumePhotos([]); setBeforeFixPhotos([]); setExistingCausePhotos([]);
    load();
  }

  function openResume(it: any) {
    setResumeId(it.id);
    setResumeDetail("");
    setBeforeFixPhotos([]);
    setResumePhotos([]);
    setExistingCausePhotos(Array.isArray(it.cause_photos) ? it.cause_photos : []);
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">작업중지권 행사 기록</h1>
          <p className="text-sm text-muted-foreground mt-1">산업안전보건법 제52조에 따른 작업중지권 행사 이력입니다.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/work-stop-right"><Button variant="outline" size="sm">법령 안내</Button></Link>
          <Link to="/work-stop-records/ledger"><Button variant="outline" size="sm" className="gap-1.5"><Printer className="h-4 w-4"/>실적 관리대장</Button></Link>
          <Dialog open={open} onOpenChange={(o)=>{ setOpen(o); if(!o) resetForm(); }}>
            <DialogTrigger asChild><Button className="gap-1.5" onClick={()=>resetForm()}><Plus className="h-4 w-4"/>신규 등록</Button></DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editId ? "작업중지권 행사 수정" : "작업중지권 행사 등록"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                {complexes.length > 1 && (
                  <div>
                    <Label>단지</Label>
                    <select value={complexId} onChange={e=>setComplexId(e.target.value)} className="w-full h-10 px-3 rounded-md border bg-background text-sm mt-1">
                      {complexes.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <Label>행사 일시</Label>
                  <Input type="datetime-local" value={exercisedAt} onChange={e=>setExercisedAt(e.target.value)} className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>행사자 성명</Label><Input value={name} onChange={e=>setName(e.target.value)} className="mt-1" /></div>
                  <div><Label>직책</Label><Input value={position} onChange={e=>setPosition(e.target.value)} className="mt-1" /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>업체명</Label><Input value={contractorName} onChange={e=>setContractorName(e.target.value)} placeholder="예: ○○건설" className="mt-1" /></div>
                  <div><Label>작업자</Label><Input value={workerName} onChange={e=>setWorkerName(e.target.value)} placeholder="작업자 성명" className="mt-1" /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>관리감독자 성명</Label><Input value={supName} onChange={e=>setSupName(e.target.value)} placeholder="예: 관리사무소장" className="mt-1" /></div>
                  <div><Label>관리감독자 연락처</Label><Input value={supPhone} onChange={e=>setSupPhone(e.target.value)} placeholder="010-0000-0000" className="mt-1" /></div>
                </div>
                <div><Label>작업 내용</Label><Textarea value={workDesc} onChange={e=>setWorkDesc(e.target.value)} rows={2} className="mt-1" /></div>
                <div><Label>중지 사유</Label><Textarea value={reason} onChange={e=>setReason(e.target.value)} rows={3} className="mt-1" placeholder="급박한 위험 요인을 구체적으로 작성" /></div>
                <PhotoPicker label="중지 원인 사진" photos={causePhotos} onChange={setCausePhotos} />
                <div>
                  <Label>처리 결과</Label>
                  <div className="flex gap-2 mt-1">
                    {["작업중단","작업재개"].map(r=>(
                      <button key={r} type="button" onClick={()=>setResult(r)}
                        className={`flex-1 py-2 rounded-md border text-sm ${result===r?"bg-primary text-primary-foreground border-primary":"bg-background"}`}>{r}</button>
                    ))}
                  </div>
                </div>
                <div><Label>결과 상세</Label><Textarea value={resultDetail} onChange={e=>setResultDetail(e.target.value)} rows={2} className="mt-1" /></div>
                {result === "작업재개" && (
                  <PhotoPicker label="시정 완료 / 작업 재개 사진" photos={resolutionPhotos} onChange={setResolutionPhotos} />
                )}
                <Button onClick={submit} disabled={saving} className="w-full">{saving?(editId?"수정 중...":"등록 중..."):(editId?"수정":"등록")}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">등록된 기록이 없습니다.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {items.map((it:any)=>(
            <Card key={it.id}>
              <CardContent className="p-4 flex gap-3">
                <div className="p-2 rounded-md bg-warning/15 text-warning h-fit"><ShieldAlert className="h-4 w-4"/></div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <span>{new Date(it.exercised_at).toLocaleString("ko-KR")}</span>
                    <span>· {it.exerciser_name}{it.exerciser_position ? ` (${it.exerciser_position})` : ""}</span>
                    <span className={`ml-auto px-2 py-0.5 rounded text-[11px] ${it.result==="작업재개"?"bg-success/15 text-success":"bg-warning/15 text-warning"}`}>{it.result}</span>
                  </div>
                  <div className="text-sm font-medium">{it.work_description}</div>
                  <div className="text-xs text-muted-foreground">사유: {it.stop_reason}</div>
                  {Array.isArray(it.cause_photos) && it.cause_photos.length > 0 && (
                    <div>
                      <div className="text-[11px] text-muted-foreground mb-1">중지 원인 사진</div>
                      <div className="flex flex-wrap gap-1.5">
                        {it.cause_photos.map((u:string,i:number)=>(
                          <span key={i} className="w-16 h-16 rounded border overflow-hidden bg-muted block">
                            <SignedImg src={u} alt="" className="w-full h-full object-cover" />
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {it.result_detail && <div className="text-xs">결과: {it.result_detail}</div>}
                  {Array.isArray(it.resolution_photos) && it.resolution_photos.length > 0 && (
                    <div>
                      <div className="text-[11px] text-muted-foreground mb-1">시정 완료 사진</div>
                      <div className="flex flex-wrap gap-1.5">
                        {it.resolution_photos.map((u:string,i:number)=>(
                          <span key={i} className="w-16 h-16 rounded border overflow-hidden bg-muted block">
                            <SignedImg src={u} alt="" className="w-full h-full object-cover" />
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Link to="/work-stop-records/$id" params={{ id: it.id }}>
                      <Button size="sm" variant="outline" className="gap-1.5"><Printer className="h-4 w-4"/>기록서 보기 / 출력</Button>
                    </Link>
                    {it.result !== "작업재개" && (
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={()=>openResume(it)}>
                        <CheckCircle2 className="h-4 w-4"/>시정 완료 · 작업 재개 처리
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={()=>openEdit(it)}>
                      <Pencil className="h-4 w-4"/>수정
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:text-destructive" onClick={()=>setDeleteId(it.id)}>
                      <Trash2 className="h-4 w-4"/>삭제
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!resumeId} onOpenChange={(o)=>{ if(!o){ setResumeId(null); setResumePhotos([]);} }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>작업 재개 처리</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {existingCausePhotos.length > 0 && (
              <div>
                <Label className="text-sm">기존 중지 원인 사진</Label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {existingCausePhotos.map((u,i)=>(
                    <div key={i} className="w-16 h-16 rounded border overflow-hidden bg-muted">
                      <SignedImg src={u} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <PhotoPicker label="시정 전 사진 (추가)" photos={beforeFixPhotos} onChange={setBeforeFixPhotos} />
            <div><Label>시정 내용</Label><Textarea value={resumeDetail} onChange={e=>setResumeDetail(e.target.value)} rows={3} className="mt-1" placeholder="시정 조치 내용 및 안전 확인 사항" /></div>
            <PhotoPicker label="시정 후 / 작업 재개 사진" photos={resumePhotos} onChange={setResumePhotos} />
            <Button onClick={submitResume} disabled={resumeSaving} className="w-full">{resumeSaving?"처리 중...":"작업 재개 처리"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o)=>{ if(!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>작업중지권 기록 삭제</AlertDialogTitle>
            <AlertDialogDescription>이 기록을 삭제하시겠습니까? 삭제된 기록은 복구할 수 없습니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deleting?"삭제 중...":"삭제"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
