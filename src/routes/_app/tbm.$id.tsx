import { createFileRoute, useParams, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SignedImg } from "@/components/signed-img";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Camera, Loader2, X, CheckCircle2, Trash2, Plus, Printer } from "lucide-react";
import { toast } from "sonner";
import { writeErrorMessage } from "@/lib/write-error";
import { uploadPhotos } from "@/lib/photo-upload";
import { TBM_HAZARD_PRESETS, HEALTH_CHECKS } from "@/lib/tbm-presets";
import { ApprovalLineEditor, EMPTY_APPROVAL, type Approval } from "@/components/approval-line";
import { PrintSheet, printSheet } from "@/components/print-sheet";
import { AttendeePicker } from "@/components/attendee-picker";
import { SignatureButton } from "@/components/signature-pad";

export const Route = createFileRoute("/_app/tbm/$id")({
  component: TbmDetail,
});

type Attendee = { name: string; role: string; fever: boolean; alcohol: boolean; drug: boolean; ppe: boolean; signed: boolean; signature?: string };
type Hazard = { hazard: string; measure: string };

function TbmDetail() {
  const { id } = useParams({ from: "/_app/tbm/$id" });
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [row, setRow] = useState<any>(null);
  const [workContent, setWorkContent] = useState("");
  const [leaderName, setLeaderName] = useState("");
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [resultNote, setResultNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [eduMinutes, setEduMinutes] = useState(0);
  const [approval, setApproval] = useState<Approval>({ ...EMPTY_APPROVAL });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  async function load() {
    setLoading(true);
    const { data } = await (supabase as any).from("tbm_meetings").select("*").eq("id", id).maybeSingle();
    setRow(data);
    setWorkContent(data?.work_content ?? "");
    setLeaderName(data?.leader_name ?? "");
    setAttendees((data?.attendees ?? []) as Attendee[]);
    setHazards((data?.hazards ?? []) as Hazard[]);
    setResultNote(data?.result_note ?? "");
    setPhotos((data?.photos ?? []) as string[]);
    setEduMinutes(data?.edu_minutes ?? 0);
    setApproval({ ...EMPTY_APPROVAL, ...(data?.approval ?? {}) });
    setLoading(false);
  }

  function pickAttendee(name: string, role: string) {
    if (attendees.some((a) => a.name === name)) return;
    setAttendees([...attendees, { name, role, fever: false, alcohol: false, drug: false, ppe: true, signed: false }]);
  }
  function patchAttendee(i: number, p: Partial<Attendee>) {
    setAttendees((prev) => prev.map((a, j) => (j === i ? { ...a, ...p } : a)));
  }

  async function addPhotos(files: FileList) {
    setBusy(true);
    try {
      const urls = await uploadPhotos(files, "safety-photos", "tbm");
      setPhotos([...photos, ...urls]);
    } catch (e: any) {
      toast.error(e.message ?? "업로드 실패");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function payload(extra: Record<string, any> = {}) {
    return { work_content: workContent || null, leader_name: leaderName || null, attendees, hazards, result_note: resultNote || null, photos, edu_minutes: eduMinutes, approval, ...extra };
  }

  async function save(extra: Record<string, any> = {}, silent = false) {
    setSaving(true);
    const { error } = await (supabase as any).from("tbm_meetings").update(payload(extra)).eq("id", id);
    setSaving(false);
    if (error) { toast.error(writeErrorMessage(error)); return false; }
    if (!silent) toast.success("저장되었습니다");
    return true;
  }

  async function complete() {
    if (attendees.length === 0) { toast.error("참석자를 1명 이상 추가해주세요"); return; }
    const ok = await save({ status: "완료" }, true);
    if (ok) { toast.success("TBM이 완료되었습니다"); navigate({ to: "/tbm" }); }
  }

  async function remove() {
    if (!confirm("이 TBM을 삭제할까요? 되돌릴 수 없습니다.")) return;
    const { error } = await (supabase as any).from("tbm_meetings").delete().eq("id", id);
    if (error) { toast.error(writeErrorMessage(error)); return; }
    toast.success("삭제되었습니다");
    navigate({ to: "/tbm" });
  }

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground">불러오는 중...</div>;
  if (!row) return <div className="p-8 text-center text-sm text-muted-foreground">TBM을 찾을 수 없습니다.</div>;

  const done = row.status === "완료";

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-4">
      <Link to="/tbm"><Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />목록</Button></Link>

      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{row.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date(row.held_at).toLocaleString("ko-KR")}{row.location && <> · {row.location}</>}
            {" · "}<span className={done ? "text-success font-medium" : "text-warning font-medium"}>{row.status}</span>
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => printSheet(photos)}><Printer className="h-4 w-4" />출력</Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-danger" onClick={remove}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      <Card><CardContent className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>진행자(리더)</Label>
            <Input value={leaderName} onChange={(e) => setLeaderName(e.target.value)} className="h-10 mt-1" placeholder="예: 시설반장" />
          </div>
          <div>
            <Label>교육 인정 시간(분)</Label>
            <Input type="number" min={0} value={eduMinutes} onChange={(e) => setEduMinutes(Number(e.target.value) || 0)} className="h-10 mt-1" placeholder="예: 10" />
          </div>
        </div>
        <div>
          <Label>작업 내용</Label>
          <Textarea value={workContent} onChange={(e) => setWorkContent(e.target.value)} rows={2} className="mt-1" placeholder="오늘 수행할 작업" />
        </div>
      </CardContent></Card>

      {/* 참석자 + 건강상태 */}
      <Card><CardContent className="p-4 space-y-3">
        <Label>참석자 건강상태 확인 ({attendees.length}명)</Label>
        {attendees.map((a, i) => (
          <div key={i} className="rounded-md border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm flex-1">{a.name} <span className="text-xs text-muted-foreground">{a.role}</span></span>
              <SignatureButton value={a.signature} onChange={(d) => patchAttendee(i, { signature: d })} name={a.name} />
              <button type="button" onClick={() => setAttendees(attendees.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-danger"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {HEALTH_CHECKS.map((h) => {
                const on = (a as any)[h.key] as boolean;
                const bad = h.badWhenTrue ? on : !on;
                return (
                  <button key={h.key} type="button" onClick={() => patchAttendee(i, { [h.key]: !on } as any)}
                    className={`px-2.5 py-1.5 rounded-md border text-xs font-medium ${on ? (h.badWhenTrue ? "bg-danger text-white border-danger" : "bg-success text-white border-success") : (h.badWhenTrue ? "bg-background" : "bg-danger/10 text-danger border-danger/40")}`}>
                    {h.label}{bad ? " ⚠" : ""}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <AttendeePicker complexId={row.complex_id} orgId={row.organization_id} selectedNames={attendees.map((a) => a.name)} onPick={pickAttendee} />
      </CardContent></Card>

      {/* 유해위험요인 + 대책 */}
      <Card><CardContent className="p-4 space-y-3">
        <Label>오늘의 유해위험요인 · 대책 ({hazards.length}건)</Label>
        {hazards.map((h, i) => (
          <div key={i} className="rounded-md border p-3 space-y-2">
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <Input value={h.hazard} onChange={(e) => setHazards(hazards.map((x, j) => j === i ? { ...x, hazard: e.target.value } : x))} className="h-10" placeholder="위험요인" />
                <Input value={h.measure} onChange={(e) => setHazards(hazards.map((x, j) => j === i ? { ...x, measure: e.target.value } : x))} className="h-10" placeholder="대책" />
              </div>
              <button type="button" onClick={() => setHazards(hazards.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-danger mt-2"><X className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
        <div>
          <div className="text-xs text-muted-foreground mb-1.5">자주 쓰는 항목 추가:</div>
          <div className="flex flex-wrap gap-1.5">
            {TBM_HAZARD_PRESETS.map((p, i) => (
              <button key={i} type="button" onClick={() => setHazards([...hazards, { ...p }])}
                className="px-2.5 py-1.5 rounded-full border text-xs hover:border-primary hover:bg-primary/5">
                + {p.hazard.length > 16 ? p.hazard.slice(0, 16) + "…" : p.hazard}
              </button>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" className="mt-2 gap-1" onClick={() => setHazards([...hazards, { hazard: "", measure: "" }])}>
            <Plus className="h-3.5 w-3.5" />직접 추가
          </Button>
        </div>
      </CardContent></Card>

      {/* 결과 · 사진 */}
      <Card><CardContent className="p-4 space-y-3">
        <div>
          <Label>회의 결과 / 특이사항 (선택)</Label>
          <Textarea value={resultNote} onChange={(e) => setResultNote(e.target.value)} rows={2} className="mt-1" />
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
        <ApprovalLineEditor value={approval} onChange={setApproval} />
      </CardContent></Card>

      <div className="sticky bottom-16 md:bottom-4 bg-background/80 backdrop-blur rounded-xl border p-3 flex gap-2">
        <Button variant="outline" className="flex-1 h-11" onClick={() => save()} disabled={saving}>{saving ? "저장 중..." : "임시 저장"}</Button>
        <Button className="flex-1 h-11 gap-1.5" onClick={complete} disabled={saving || done}><CheckCircle2 className="h-4 w-4" />{done ? "완료됨" : "TBM 완료"}</Button>
      </div>

      <PrintSheet title="작업 전 안전미팅(TBM) 일지" subtitle="산업안전보건법 근로자 안전보건교육 · 작업 전 안전점검회의" approval={approval}>
        <table className="ps-table">
          <tbody>
            <tr><th className="ps-label" style={{ width: "24mm" }}>조/작업명</th><td>{row.title}</td><th className="ps-label" style={{ width: "24mm" }}>일시</th><td>{new Date(row.held_at).toLocaleString("ko-KR")}</td></tr>
            <tr><th className="ps-label">장소</th><td>{row.location || "-"}</td><th className="ps-label">진행자</th><td>{leaderName || "-"}</td></tr>
            <tr><th className="ps-label">교육 인정시간</th><td>{eduMinutes}분</td><th className="ps-label">작성상태</th><td>{row.status}</td></tr>
            <tr><th className="ps-label">작업내용</th><td colSpan={3} style={{ whiteSpace: "pre-wrap" }}>{workContent || "-"}</td></tr>
          </tbody>
        </table>

        <table className="ps-table">
          <thead>
            <tr><th className="ps-label">성명</th><th className="ps-label" style={{ width: "16mm" }}>구분</th><th className="ps-label" style={{ width: "13mm" }}>발열</th><th className="ps-label" style={{ width: "13mm" }}>음주</th><th className="ps-label" style={{ width: "13mm" }}>약물</th><th className="ps-label" style={{ width: "14mm" }}>보호구</th><th className="ps-label" style={{ width: "28mm" }}>서명</th></tr>
          </thead>
          <tbody>
            {attendees.length === 0 ? (
              <tr><td colSpan={7} className="ps-center">참석자 없음</td></tr>
            ) : attendees.map((a, i) => (
              <tr key={i}>
                <td>{a.name}</td><td className="ps-center">{a.role}</td>
                <td className="ps-center">{a.fever ? "이상" : "정상"}</td>
                <td className="ps-center">{a.alcohol ? "유" : "무"}</td>
                <td className="ps-center">{a.drug ? "유" : "무"}</td>
                <td className="ps-center">{a.ppe ? "착용" : "미착용"}</td>
                <td className="ps-center" style={{ height: "12mm" }}>{a.signature ? <img src={a.signature} style={{ height: "10mm", maxWidth: "26mm", objectFit: "contain" }} /> : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <table className="ps-table">
          <thead><tr><th className="ps-label" style={{ width: "50%" }}>유해위험요인</th><th className="ps-label">감소대책</th></tr></thead>
          <tbody>
            {hazards.length === 0 ? (
              <tr><td colSpan={2} className="ps-center">등록된 위험요인 없음</td></tr>
            ) : hazards.map((h, i) => (
              <tr key={i}><td>{h.hazard}</td><td>{h.measure}</td></tr>
            ))}
          </tbody>
        </table>

        {resultNote && (
          <table className="ps-table"><tbody>
            <tr><th className="ps-label" style={{ width: "24mm" }}>회의결과</th><td style={{ whiteSpace: "pre-wrap" }}>{resultNote}</td></tr>
          </tbody></table>
        )}

        {photos.length > 0 && (
          <table className="ps-table"><tbody>
            <tr><th className="ps-label" style={{ width: "24mm" }}>현장사진</th><td>
              <div className="ps-photo-row">
                {photos.map((url, i) => <div key={i} className="ps-photo-box"><SignedImg src={url} alt="" /></div>)}
              </div>
            </td></tr>
          </tbody></table>
        )}
      </PrintSheet>
    </div>
  );
}
