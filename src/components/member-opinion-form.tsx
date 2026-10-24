import { myComplexMemberships } from "@/lib/my-complexes";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getCurrentUserContext } from "@/lib/user-context";
import { useDraft } from "@/hooks/use-draft";
import { DraftBanner, SaveStatus, type SaveState } from "@/components/save-status";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SignedImg } from "@/components/signed-img";
import { compressImage } from "@/lib/image-compress";
import { writeErrorMessage } from "@/lib/write-error";
import { toast } from "sonner";
import { Camera, CheckCircle2, Loader2, X } from "lucide-react";

/**
 * 직원(member)용 "안전 의견 남기기" — 한 화면, 결정 하나.
 *
 * - 단지는 소속이 하나면 자동, 여럿이면 선택.
 * - 의견 글 또는 사진 중 하나만 있어도 제출 가능 (타이핑은 마지막 수단).
 * - 이 기기에 자동 임시 저장(useDraft) + 저장 상태 지속 표시(SaveStatus).
 * - 저장되는 곳: employee_inputs (input_type = "opinion"). 근로자 참여 기록으로 쓰기 위해
 *   작성자·단지·참여일·방법(meta.method)을 함께 남기고, 진행 중인 평가가 있으면 assessment_id 로 연결한다.
 *   이 창구는 순회점검 등 다른 참여 방법을 대체하지 않는다 (관리자 화면에 안내).
 */

export type OpinionReviewStatus = "new" | "reviewed" | "applied";
export const OPINION_STATUS_LABEL: Record<OpinionReviewStatus, string> = {
  new: "접수됨",
  reviewed: "관리자 확인",
  applied: "평가에 반영됨",
};

type Form = { complexId: string; text: string; photos: string[] };
const EMPTY: Form = { complexId: "", text: "", photos: [] };

type Me = { id: string; name: string; job_title: string | null; organization_id: string | null };

export function MemberOpinionForm({ onSubmitted }: { onSubmitted?: () => void }) {
  const { user } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [complexes, setComplexes] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState<Form>(EMPTY);
  const [uploading, setUploading] = useState(false);
  const [save, setSave] = useState<SaveState>("idle");
  const [errorText, setErrorText] = useState<string | undefined>();
  const [done, setDone] = useState(false);

  // 키에 사용자 ID — 사무소 공동 PC에서 남의 초안이 보이면 안 된다.
  const draft = useDraft(me ? `opinion:${me.id}` : null, form, { enabled: !done });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { userRow } = await getCurrentUserContext(user.id);
      if (!userRow) return;
      setMe({ id: userRow.id, name: userRow.name, job_title: userRow.job_title, organization_id: userRow.organization_id });
      const { data: cm } = await myComplexMemberships(userRow.id);
      const ids = (cm ?? []).map((c: any) => c.complex_id);
      if (ids.length === 0) { setComplexes([]); return; }
      const { data: cx } = await supabase.from("complexes").select("id, name").in("id", ids).order("name");
      const list = cx ?? [];
      setComplexes(list);
      if (list.length === 1) setForm((f) => (f.complexId ? f : { ...f, complexId: list[0].id }));
    })();
  }, [user]);

  async function uploadPhotos(files: FileList) {
    const cx = form.complexId || complexes[0]?.id;
    if (!cx) { toast.error("단지를 먼저 선택해 주세요"); return; }
    setUploading(true);
    const urls = [...form.photos];
    try {
      for (const file of Array.from(files)) {
        const isImage = file.type.startsWith("image/");
        const body = isImage ? await compressImage(file, 1_200_000, 1600) : file;
        const jpg = body !== file;
        const ext = jpg ? "jpg" : (file.name.split(".").pop() || "bin");
        const path = `employee/${cx}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from("assessment-photos").upload(path, body, {
          contentType: jpg ? "image/jpeg" : (file.type || "application/octet-stream"), upsert: false,
        });
        if (error) throw error;
        const { data } = supabase.storage.from("assessment-photos").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      setForm((f) => ({ ...f, photos: urls }));
    } catch (e: any) {
      toast.error(`사진 올리기 실패: ${e?.message ?? "다시 시도해 주세요"}`);
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!me) return;
    if (!form.complexId) { toast.error("단지를 선택해 주세요"); return; }
    const text = form.text.trim();
    if (text.length < 2 && form.photos.length === 0) { toast.error("의견을 적거나 사진을 한 장 올려 주세요"); return; }
    if (save === "saving") return; // 중복 제출 방지
    setSave("saving");
    setErrorText(undefined);

    // 진행 중인 평가가 있으면 그 평가의 근로자 참여 기록으로 연결한다 (없으면 단지 기록으로만).
    const { data: active } = await supabase
      .from("assessments").select("id").eq("complex_id", form.complexId)
      .in("status", ["작성중", "협의중"]).order("created_at", { ascending: false }).limit(1).maybeSingle();

    const { data, error } = await supabase.from("employee_inputs").insert({
      assessment_id: active?.id ?? null,
      complex_id: form.complexId,
      organization_id: me.organization_id,
      created_by: me.id,
      input_type: "opinion",
      respondent_name: me.name,
      respondent_role: me.job_title || "직원",
      content: text || "(사진으로 제출)",
      occurred_at: new Date().toISOString(),
      attachments: form.photos,
      meta: { method: "온라인 의견(앱)", review_status: "new" as OpinionReviewStatus, submitted_from: "member_form" } as any,
    } as any).select("id");

    if (error || !data?.length) {
      setSave("error");
      setErrorText(writeErrorMessage(error, "체험 기간이 끝났거나 권한이 없어 저장하지 못했습니다. 입력은 이 기기에 남아 있습니다."));
      return;
    }
    draft.clear();
    setSave("idle");
    setDone(true);
    onSubmitted?.();
  }

  function reset() {
    setForm(complexes.length === 1 ? { ...EMPTY, complexId: complexes[0].id } : EMPTY);
    setDone(false);
    setSave("idle");
  }

  if (done) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center space-y-4" role="status" aria-live="polite">
        <CheckCircle2 className="h-16 w-16 text-success mx-auto" />
        <h2 className="text-2xl font-bold">접수됐습니다</h2>
        <p className="text-base text-muted-foreground">
          관리자가 확인한 뒤 위험성평가에 반영합니다.<br />이 의견은 근로자 참여 기록으로 보관됩니다.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button type="button" size="lg" onClick={reset}>의견 하나 더 남기기</Button>
          <Link to="/dashboard"><Button type="button" size="lg" variant="outline" className="w-full">처음 화면으로</Button></Link>
        </div>
      </div>
    );
  }

  const status: SaveState = save !== "idle" ? save : draft.savedAt ? "draft" : "idle";
  // 복구 여부를 고르기 전에는 입력·제출을 잠근다 — 그 사이 입력한 내용이 저장되지 않거나 복구로 덮이는 사고 방지.
  const locked = !!draft.pending;
  const canSubmit = !locked && !!me && !!form.complexId && !uploading && save !== "saving" && (form.text.trim().length >= 2 || form.photos.length > 0);

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => { e.preventDefault(); submit(); }}
    >
      {draft.pending && (
        <DraftBanner
          at={draft.pendingAt}
          onResume={() => { const v = draft.take(); if (v) setForm(v); }}
          onDiscard={() => draft.discard()}
        />
      )}

      <SaveStatus state={status} draftAt={draft.savedAt} errorText={errorText} onRetry={submit} />

      <fieldset disabled={locked} className="space-y-5 min-w-0 disabled:opacity-60">

      {complexes.length > 1 && (
        <div className="space-y-1.5">
          <Label htmlFor="opinion-complex" className="text-base">어느 단지 이야기인가요?</Label>
          <Select value={form.complexId} onValueChange={(v) => setForm((f) => ({ ...f, complexId: v }))}>
            <SelectTrigger id="opinion-complex"><SelectValue placeholder="단지를 선택해 주세요" /></SelectTrigger>
            <SelectContent>
              {complexes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      {complexes.length === 1 && (
        <p className="text-base"><span className="text-muted-foreground">단지:</span> <b>{complexes[0].name}</b></p>
      )}
      {me && complexes.length === 0 && (
        <p className="text-base text-destructive">아직 소속 단지가 정해지지 않았습니다. 관리자에게 단지 배정을 요청해 주세요.</p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="opinion-text" className="text-base">어디가, 왜 위험하다고 느끼셨나요?</Label>
        <Textarea
          id="opinion-text"
          rows={5}
          value={form.text}
          onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
          placeholder="예) 지하 2층 계단에 물이 자주 고여 미끄럽습니다"
          className="text-base"
        />
        <p className="text-sm text-muted-foreground">글 대신 사진만 올려도 됩니다.</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-base">사진 (선택)</Label>
        <div className="flex flex-wrap gap-2">
          {form.photos.map((url, i) => (
            <div key={url} className="relative w-24 h-24 rounded-md overflow-hidden border bg-muted">
              <SignedImg src={url} alt={`첨부 사진 ${i + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                aria-label="이 사진 삭제"
                onClick={() => setForm((f) => ({ ...f, photos: f.photos.filter((_, j) => j !== i) }))}
                className="absolute top-1 right-1 h-9 w-9 flex items-center justify-center bg-black/60 text-white rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          ))}
          {/* 파일 input 은 숨기되(sr-only) 키보드 포커스는 받게 — Tab 으로도 사진 입력에 닿아야 한다 */}
          <label className="w-24 h-24 rounded-md border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary focus-within:border-primary focus-within:ring-2 focus-within:ring-ring text-sm gap-1 cursor-pointer">
            {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
            {uploading ? "올리는 중" : "사진 찍기"}
            <input type="file" accept="image/*" capture="environment" multiple className="sr-only" aria-label="사진 찍기 또는 고르기"
              onChange={(e) => e.target.files && uploadPhotos(e.target.files)} />
          </label>
        </div>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={!canSubmit}>
        {save === "saving" ? "보내는 중…" : "의견 보내기"}
      </Button>
      </fieldset>
      <p className="text-sm text-muted-foreground text-center">
        보낸 의견은 관리소장·담당자가 확인하며, 누가 언제 냈는지 기록으로 남습니다.
      </p>
    </form>
  );
}

/** 내가 남긴 의견 목록 (직원 홈·의견 화면 공용) */
export function MemberOpinionList({ limit = 10, refreshKey = 0 }: { limit?: number; refreshKey?: number }) {
  const { user } = useAuth();
  const [items, setItems] = useState<any[] | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { userRow } = await getCurrentUserContext(user.id);
      if (!userRow) { setItems([]); return; }
      const { data } = await supabase
        .from("employee_inputs").select("id, content, occurred_at, attachments, meta, assessment_id")
        .eq("created_by", userRow.id).eq("input_type", "opinion")
        .order("occurred_at", { ascending: false }).limit(limit);
      setItems(data ?? []);
    })();
  }, [user, limit, refreshKey]);

  if (items === null) return <p className="text-base text-muted-foreground">불러오는 중…</p>;
  if (items.length === 0) return <p className="text-base text-muted-foreground">아직 남긴 의견이 없습니다.</p>;

  return (
    <ul className="divide-y">
      {items.map((it) => {
        const st = ((it.meta as any)?.review_status ?? "new") as OpinionReviewStatus;
        return (
          <li key={it.id} className="py-3 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">{new Date(it.occurred_at).toLocaleDateString("ko-KR")}</span>
              <Badge variant={st === "applied" ? "default" : st === "reviewed" ? "secondary" : "outline"}>{OPINION_STATUS_LABEL[st]}</Badge>
            </div>
            <p className="text-base whitespace-pre-wrap break-words">{it.content}</p>
            {Array.isArray(it.attachments) && it.attachments.length > 0 && (
              <p className="text-sm text-muted-foreground">사진 {it.attachments.length}장</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
