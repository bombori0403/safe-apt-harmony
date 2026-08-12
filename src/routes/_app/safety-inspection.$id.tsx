import { createFileRoute, useParams, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SignedImg } from "@/components/signed-img";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Camera, Loader2, X, CheckCircle2, Trash2, Printer } from "lucide-react";
import { toast } from "sonner";
import { writeErrorMessage } from "@/lib/write-error";
import { uploadPhotos } from "@/lib/photo-upload";
import { getCurrentUserContext } from "@/lib/user-context";
import { nextScheduledDate, inspectionDocTitle } from "@/lib/inspection-presets";
import { PrintSheet, printSheet } from "@/components/print-sheet";
import { InspectionApprovalEditor, InspectionApprovalBox, type InspApproval } from "@/components/approval-line";

export const Route = createFileRoute("/_app/safety-inspection/$id")({
  component: InspectionDetail,
});

type Item = { category: string; text: string; result: string; improvement: string; assignee: string; action: string; actionPhotos: string[]; actionDone: boolean };
const RESULTS = ["해당없음", "양호", "미흡", "불량"];
const isBad = (r: string) => r === "미흡" || r === "불량";

function InspectionDetail() {
  const { id } = useParams({ from: "/_app/safety-inspection/$id" });
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<number>(-1);
  const [row, setRow] = useState<any>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [approval, setApproval] = useState<InspApproval>({});
  const [userRowId, setUserRowId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) getCurrentUserContext(user.id).then(({ userId }) => userId && setUserRowId(userId));
    load(); /* eslint-disable-next-line */
  }, [id, user]);

  async function load() {
    setLoading(true);
    const { data } = await (supabase as any).from("safety_inspections").select("*").eq("id", id).maybeSingle();
    setRow(data);
    setItems((data?.items ?? []) as Item[]);
    setApproval((data?.approval ?? {}) as InspApproval);
    setLoading(false);
  }

  function patch(i: number, p: Partial<Item>) {
    setItems((prev) => prev.map((it, j) => (j === i ? { ...it, ...p } : it)));
  }

  async function addPhotos(files: FileList) {
    const idx = uploadTarget.current;
    if (idx < 0) return;
    setBusy(true);
    try {
      const urls = await uploadPhotos(files, "safety-photos", `${user?.id ?? "anon"}/inspection`);
      setItems((prev) => prev.map((it, j) => (j === idx ? { ...it, actionPhotos: [...(it.actionPhotos ?? []), ...urls] } : it)));
    } catch (e: any) {
      toast.error(e.message ?? "업로드 실패");
    } finally {
      setBusy(false);
      uploadTarget.current = -1;
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save(extra: Record<string, any> = {}, silent = false) {
    setSaving(true);
    const { data, error } = await (supabase as any).from("safety_inspections").update({ items, approval, ...extra }).eq("id", id).select("id");
    setSaving(false);
    if (error) { toast.error(writeErrorMessage(error)); return false; }
    if (!data || data.length === 0) { toast.error("저장 권한이 없거나 체험 기간이 종료되어 저장되지 않았습니다"); return false; }
    if (!silent) toast.success("저장되었습니다");
    return true;
  }

  const openActions = items.filter((it) => isBad(it.result) && !it.actionDone).length;
  const unrated = items.filter((it) => !it.result).length;
  // 인쇄용 구분(그룹) 세로병합 계산
  const groupRuns = items.map((it, i) => {
    const first = i === 0 || items[i - 1].category !== it.category;
    let span = 0;
    if (first) for (let j = i; j < items.length && items[j].category === it.category; j++) span++;
    return { first, span };
  });

  async function complete() {
    if (unrated > 0) { toast.error(`아직 판정하지 않은 항목이 ${unrated}개 있습니다`); return; }
    if (openActions > 0) { toast.error(`미흡·불량 항목의 개선조치를 완료해야 합니다 (남은 ${openActions}개)`); return; }
    const ok = await save({ status: "완료", performed_at: new Date().toISOString(), performed_by: userRowId || null }, true);
    if (!ok) return;
    // 반복 주기가 있으면 다음 회차 예정 점검 자동 생성
    if (row?.recurrence && row.recurrence !== "none") {
      const base = row.scheduled_date ? new Date(row.scheduled_date + "T00:00:00") : new Date();
      const next = nextScheduledDate(base, row.recurrence);
      const withinLimit = !row.recurrence_until || (next && next <= new Date(row.recurrence_until + "T23:59:59"));
      if (next && withinLimit) {
        // 로컬 날짜 문자열로 저장(next.toISOString()은 UTC라 KST에서 하루 당겨져 회차마다 날짜가 밀림)
        const nextStr = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
        const { error: genErr } = await (supabase as any).from("safety_inspections").insert({
          complex_id: row.complex_id,
          organization_id: row.organization_id,
          title: row.title,
          inspection_type: row.inspection_type,
          checklist_category: row.checklist_category,
          scheduled_date: nextStr,
          recurrence: row.recurrence,
          recurrence_until: row.recurrence_until,
          status: "예정",
          items: items.map((it) => ({ ...it, result: "", improvement: "", assignee: "", action: "", actionPhotos: [], actionDone: false })),
          created_by: userRowId || null,
        });
        // 다음 회차 생성이 실패하면(RLS/제약 등) 완료만 알리고 거짓 성공 문구를 띄우지 않는다
        toast.success(genErr ? "점검이 완료되었습니다" : "점검 완료 · 다음 회차가 예정으로 생성되었습니다");
      } else {
        toast.success("점검이 완료되었습니다");
      }
    } else {
      toast.success("점검이 완료되었습니다");
    }
    navigate({ to: "/safety-inspection" });
  }

  async function remove() {
    if (!confirm("이 점검을 삭제할까요? 되돌릴 수 없습니다.")) return;
    const { error } = await (supabase as any).from("safety_inspections").delete().eq("id", id);
    if (error) { toast.error(writeErrorMessage(error)); return; }
    toast.success("삭제되었습니다");
    navigate({ to: "/safety-inspection" });
  }

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground">불러오는 중...</div>;
  if (!row) return <div className="p-8 text-center text-sm text-muted-foreground">점검을 찾을 수 없습니다.</div>;

  const done = row.status === "완료";

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-4">
      <Link to="/safety-inspection"><Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />목록</Button></Link>

      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{row.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {row.checklist_category} · {row.inspection_type}
            {row.scheduled_date && <> · 예정 {row.scheduled_date}</>}
            {" · "}<span className={done ? "text-success font-medium" : "text-warning font-medium"}>{row.status}</span>
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => printSheet(items.flatMap((it) => it.actionPhotos ?? []))}><Printer className="h-4 w-4" />출력</Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-danger" onClick={remove}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      <InspectionApprovalEditor value={approval} onChange={setApproval} />

      <div className="space-y-3">
        {items.map((it, i) => {
          const showGroup = it.category && (i === 0 || items[i - 1].category !== it.category);
          return (
          <div key={i} className="space-y-3">
          {showGroup && <div className="text-xs font-bold text-primary bg-primary/5 border border-primary/20 rounded px-2 py-1">▸ {it.category}</div>}
          <Card className={isBad(it.result) && !it.actionDone ? "border-danger/50" : ""}>
            <CardContent className="p-4 space-y-3">
              <div className="font-medium text-sm">{i + 1}. {it.text}</div>
              <div className="grid grid-cols-4 gap-1.5">
                {RESULTS.map((r) => (
                  <button key={r} type="button" onClick={() => patch(i, { result: r })}
                    className={`py-2 rounded-md border text-xs font-medium ${it.result === r
                      ? r === "불량" ? "bg-danger text-white border-danger"
                        : r === "미흡" ? "bg-warning text-white border-warning"
                          : r === "양호" ? "bg-success text-white border-success"
                            : "bg-muted-foreground text-white border-muted-foreground"
                      : "bg-background"}`}>
                    {r}
                  </button>
                ))}
              </div>

              {isBad(it.result) && (
                <div className="space-y-2 pt-1 border-t">
                  <div>
                    <label className="text-xs text-muted-foreground">개선 필요사항</label>
                    <Textarea value={it.improvement} onChange={(e) => patch(i, { improvement: e.target.value })} rows={2} className="mt-1" placeholder="무엇이 문제이고 어떻게 개선할지" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">조치 담당</label>
                      <Input value={it.assignee} onChange={(e) => patch(i, { assignee: e.target.value })} className="h-10 mt-1" placeholder="예: 시설반장" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">조치 내용</label>
                      <Input value={it.action} onChange={(e) => patch(i, { action: e.target.value })} className="h-10 mt-1" placeholder="조치한 내용" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">조치 사진</label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {(it.actionPhotos ?? []).map((url, k) => (
                        <div key={k} className="relative w-16 h-16 rounded-md overflow-hidden border">
                          <SignedImg src={url} alt="" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => patch(i, { actionPhotos: it.actionPhotos.filter((_, m) => m !== k) })} className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5"><X className="h-3 w-3" /></button>
                        </div>
                      ))}
                      <button type="button" disabled={busy} onClick={() => { uploadTarget.current = i; fileRef.current?.click(); }}
                        className="w-16 h-16 rounded-md border-2 border-dashed flex items-center justify-center text-muted-foreground hover:border-primary">
                        {busy && uploadTarget.current === i ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer pt-1">
                    <input type="checkbox" checked={it.actionDone} onChange={(e) => patch(i, { actionDone: e.target.checked })} className="h-4 w-4" />
                    개선 완료
                  </label>
                </div>
              )}
            </CardContent>
          </Card>
          </div>
          );
        })}
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => e.target.files && addPhotos(e.target.files)} />

      <div className="sticky bottom-16 md:bottom-4 bg-background/80 backdrop-blur rounded-xl border p-3 space-y-2">
        {(unrated > 0 || openActions > 0) && (
          <p className="text-xs text-muted-foreground text-center">
            {unrated > 0 && <>미판정 {unrated}개 </>}
            {openActions > 0 && <span className="text-danger">· 개선 대기 {openActions}개</span>}
          </p>
        )}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 h-11" onClick={() => save()} disabled={saving}>
            {saving ? "저장 중..." : "임시 저장"}
          </Button>
          <Button className="flex-1 h-11 gap-1.5" onClick={complete} disabled={saving || done}>
            <CheckCircle2 className="h-4 w-4" />{done ? "완료됨" : "점검 완료"}
          </Button>
        </div>
      </div>

      <PrintSheet title={inspectionDocTitle(row.checklist_category)} subtitle={`${row.title ?? ""} · ${row.inspection_type} 점검`} headerRight={<InspectionApprovalBox approval={approval} />}>
        <table className="ps-table"><tbody>
          <tr><th className="ps-label" style={{ width: "24mm" }}>점검명</th><td>{row.title}</td><th className="ps-label" style={{ width: "24mm" }}>시설분류</th><td>{row.checklist_category || "-"}</td></tr>
          <tr><th className="ps-label">점검구분</th><td>{row.inspection_type}</td><th className="ps-label">예정일</th><td>{row.scheduled_date || "-"}</td></tr>
          <tr><th className="ps-label">상태</th><td>{row.status}</td><th className="ps-label">점검일시</th><td>{row.performed_at ? new Date(row.performed_at).toLocaleString("ko-KR") : "-"}</td></tr>
        </tbody></table>

        <table className="ps-table ps-compact ps-fill">
          <thead>
            <tr>
              <th className="ps-label" style={{ width: "22mm" }}>구분</th>
              <th className="ps-label">점검 내용</th>
              <th className="ps-label" style={{ width: "13mm" }}>점검결과</th>
              <th className="ps-label">조치 내용</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => {
              const bad = isBad(it.result);
              const action = bad ? ([it.improvement, it.action].filter(Boolean).join(" / ") || "개선 필요") : "";
              return (
                <tr key={i}>
                  {groupRuns[i].first && <td className="ps-center" rowSpan={groupRuns[i].span} style={{ verticalAlign: "middle" }}>{it.category || "-"}</td>}
                  <td>{it.text}</td>
                  <td className="ps-center">{it.result || "-"}</td>
                  <td>{action}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </PrintSheet>
    </div>
  );
}
