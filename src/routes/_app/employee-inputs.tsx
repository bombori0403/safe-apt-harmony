import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2, MessageCircle, Mic, Camera, Loader2, X, Users, Pencil, Printer } from "lucide-react";
import { compressImage } from "@/lib/image-compress";

export const Route = createFileRoute("/_app/employee-inputs")({
  component: EmployeeInputs,
});

type InputType = "hearing" | "open_chat";

const EMPTY_APPROVAL = {
  drafter_name: "",
  reviewer_name: "",
  approver_name: "",
  drafter_signed_at: "",
  reviewer_signed_at: "",
  approver_signed_at: "",
};

const EMPTY_HEARING = {
  conductor_name: "",
  worker_name: "",
  experience_1: "",
  experience_2: "",
  experience_3: "",
  worker_opinion: "",
  conductor_opinion: "",
  approval: { ...EMPTY_APPROVAL },
};

const EMPTY_CHAT = {
  room_name: "",
  author_name: "",
  summary: "",
  approval: { ...EMPTY_APPROVAL },
};

function nowLocal() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function EmployeeInputs() {
  const { user } = useAuth();
  const [me, setMe] = useState<{ id: string; org_role: string; organization_id: string } | null>(null);
  const [complexes, setComplexes] = useState<{ id: string; name: string }[]>([]);
  const [filterComplex, setFilterComplex] = useState<string>("all");
  const [formComplex, setFormComplex] = useState<string>("");
  const [items, setItems] = useState<any[]>([]);
  const [tab, setTab] = useState<InputType>("hearing");

  const [hearing, setHearing] = useState({ ...EMPTY_HEARING });
  const [hearingAt, setHearingAt] = useState<string>(nowLocal);
  const [hearingFiles, setHearingFiles] = useState<string[]>([]);

  const [chat, setChat] = useState({ ...EMPTY_CHAT });
  const [chatAt, setChatAt] = useState<string>(nowLocal);
  const [chatFiles, setChatFiles] = useState<string[]>([]);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [printItemId, setPrintItemId] = useState<string | null>(null);

  const isAdmin = me?.org_role === "admin";

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: u } = await supabase.from("users")
        .select("id, org_role, organization_id").eq("auth_id", user.id).maybeSingle();
      if (!u) return;
      setMe(u as any);
      if (!u.organization_id) return;
      let q = supabase.from("complexes").select("id, name").eq("organization_id", u.organization_id).order("name");
      if (u.org_role !== "admin") {
        const { data: cm } = await supabase.from("complex_members").select("complex_id").eq("user_id", u.id);
        const ids = (cm ?? []).map((c: any) => c.complex_id);
        if (ids.length === 0) { setComplexes([]); return; }
        q = q.in("id", ids);
      }
      const { data: cx } = await q;
      setComplexes(cx ?? []);
      if ((cx ?? []).length > 0) setFormComplex(cx![0].id);
    })();
  }, [user]);

  async function load() {
    if (!me) return;
    let q = supabase.from("employee_inputs")
      .select("*")
      .is("assessment_id", null)
      .order("occurred_at", { ascending: false });
    if (filterComplex !== "all") q = q.eq("complex_id", filterComplex);
    const { data } = await q;
    setItems(data ?? []);
  }
  useEffect(() => { load(); }, [me, filterComplex]);

  useEffect(() => {
    const resetPrintTarget = () => setPrintItemId(null);
    window.addEventListener("afterprint", resetPrintTarget);
    return () => window.removeEventListener("afterprint", resetPrintTarget);
  }, []);

  const complexNameById = useMemo(() => {
    const m: Record<string, string> = {};
    complexes.forEach(c => { m[c.id] = c.name; });
    return m;
  }, [complexes]);

  async function uploadFiles(files: FileList, setter: (urls: string[]) => void, existing: string[], complexId?: string) {
    const cx = complexId || formComplex;
    if (!cx) { toast.error("단지를 먼저 선택하세요"); return; }
    setUploading(true);
    const urls = [...existing];
    try {
      for (const file of Array.from(files)) {
        const isImage = file.type.startsWith("image/");
        const uploadBody = isImage ? await compressImage(file, 1_200_000, 1600) : file;
        const ext = isImage ? "jpg" : (file.name.split(".").pop() || "bin");
        const contentType = isImage ? "image/jpeg" : (file.type || "application/octet-stream");
        const path = `employee/${cx}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
        const { error } = await supabase.storage.from("assessment-photos").upload(path, uploadBody, {
          contentType, upsert: false,
        });
        if (error) throw error;
        const { data } = supabase.storage.from("assessment-photos").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      setter(urls);
    } catch (e: any) {
      toast.error(`사진 업로드 실패: ${e.message ?? "권한 또는 파일 형식을 확인하세요"}`);
    } finally {
      setUploading(false);
    }
  }

  async function submitHearing() {
    if (!me || !formComplex) { toast.error("단지를 선택하세요"); return; }
    if (!hearing.experience_1.trim() && !hearing.experience_2.trim() && !hearing.experience_3.trim()) {
      toast.error("경험담을 최소 1건 입력하세요"); return;
    }
    setSaving(true);
    const content = [hearing.experience_1, hearing.experience_2, hearing.experience_3]
      .filter(Boolean).map((e, i) => `[경험담 ${i+1}] ${e}`).join("\n\n");
    const { error } = await supabase.from("employee_inputs").insert({
      assessment_id: null,
      complex_id: formComplex,
      organization_id: me.organization_id,
      created_by: me.id,
      input_type: "hearing",
      respondent_name: hearing.worker_name.trim() || null,
      respondent_role: "근로자",
      content,
      occurred_at: new Date(hearingAt).toISOString(),
      attachments: hearingFiles,
      meta: hearing as any,
    } as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("청취조사가 등록되었습니다");
    setHearing({ ...EMPTY_HEARING });
    setHearingFiles([]);
    setHearingAt(nowLocal());
    load();
  }

  async function submitChat() {
    if (!me || !formComplex) { toast.error("단지를 선택하세요"); return; }
    if (!chat.summary.trim()) { toast.error("내용을 입력하세요"); return; }
    setSaving(true);
    const { error } = await supabase.from("employee_inputs").insert({
      assessment_id: null,
      complex_id: formComplex,
      organization_id: me.organization_id,
      created_by: me.id,
      input_type: "open_chat",
      respondent_name: chat.room_name.trim() || null,
      respondent_role: chat.author_name.trim() || null,
      content: chat.summary.trim(),
      occurred_at: new Date(chatAt).toISOString(),
      attachments: chatFiles,
      meta: chat as any,
    } as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("오픈채팅 이력이 등록되었습니다");
    setChat({ ...EMPTY_CHAT });
    setChatFiles([]);
    setChatAt(nowLocal());
    load();
  }

  async function del(rowId: string) {
    if (!confirm("삭제하시겠습니까?")) return;
    const { error } = await supabase.from("employee_inputs").delete().eq("id", rowId);
    if (error) toast.error(error.message); else { toast.success("삭제됨"); load(); }
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    const meta = editing.meta ?? {};
    const patch: any = {
      complex_id: editing.complex_id,
      occurred_at: new Date(editing.occurred_at).toISOString(),
      attachments: editing.attachments ?? [],
      meta,
    };
    if (editing.input_type === "hearing") {
      patch.respondent_name = meta.worker_name?.trim() || null;
      patch.content = [meta.experience_1, meta.experience_2, meta.experience_3]
        .filter(Boolean).map((e: string, i: number) => `[경험담 ${i+1}] ${e}`).join("\n\n");
    } else {
      patch.respondent_name = meta.room_name?.trim() || null;
      patch.respondent_role = meta.author_name?.trim() || null;
      patch.content = (meta.summary ?? "").trim();
    }
    const { error } = await supabase.from("employee_inputs").update(patch).eq("id", editing.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("수정되었습니다");
    setEditing(null);
    load();
  }

  const hearings = items.filter(i => i.input_type === "hearing");
  const chats = items.filter(i => i.input_type === "open_chat");

  const printItem = printItemId ? items.find(i => i.id === printItemId) : null;
  const printTitle = printItem
    ? `청취조사 기록 — ${complexNameById[printItem.complex_id] ?? ""}${printItem.respondent_name ? ` / ${printItem.respondent_name}` : ""}`
    : `직원참여 기록 — ${filterComplex === "all" ? "전체 단지" : (complexNameById[filterComplex] ?? "")}`;

  function preloadImages(urls: string[]) {
    return Promise.all(urls.map(url => new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = url;
    })));
  }

  function printOne(rowId: string) {
    const target = items.find(i => i.id === rowId);
    setPrintItemId(rowId);
    window.setTimeout(async () => {
      await preloadImages(target?.attachments ?? []);
      document.body.classList.add("printing-single-active");
      window.print();
      document.body.classList.remove("printing-single-active");
    }, 200);
  }


  return (
    <div className={`employee-print-root p-4 md:p-8 max-w-5xl mx-auto space-y-5 ${printItemId ? "printing-single" : ""}`}>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 8mm; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          html, body { width: 210mm; background: white !important; margin: 0 !important; padding: 0 !important; }
          .employee-print-root { max-width: none !important; padding: 0 !important; }
          .print-card { break-inside: avoid; page-break-inside: avoid; }
          .print-attachment-img { width: 150px !important; height: 110px !important; object-fit: cover; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

          /* Single-sheet print: hide everything except the print-sheet */
          body.printing-single-active * { visibility: hidden !important; }
          body.printing-single-active .print-sheet,
          body.printing-single-active .print-sheet * { visibility: visible !important; }
          body.printing-single-active .print-sheet {
            position: absolute !important;
            left: 0; top: 0;
            margin: 0 !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        }
        .print-only { display: none; }
        .print-sheet { display: none; }
        @media print { .print-sheet { display: block !important; } }
      `}</style>



      {printItem && printItem.input_type === "hearing" && (
        <HearingReportSheet item={printItem} complexName={complexNameById[printItem.complex_id] ?? ""} />
      )}
      {printItem && printItem.input_type === "open_chat" && (
        <OpenChatReportSheet item={printItem} complexName={complexNameById[printItem.complex_id] ?? ""} />
      )}

      <div className="print-only mb-4">
        <h1 className="text-xl font-bold">{printTitle}</h1>
        <p className="text-xs text-muted-foreground">출력일: {new Date().toLocaleString("ko-KR")}</p>
      </div>


      <div className="flex items-start justify-between gap-3 flex-wrap no-print">
        <div>
          <h1 className="text-2xl font-bold inline-flex items-center gap-2"><Users className="h-6 w-6 text-primary" />직원 참여</h1>
          <p className="text-xs text-muted-foreground mt-1">
            청취조사 응답과 단지 오픈채팅 이력을 단지 단위로 기록·조회·출력합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs whitespace-nowrap">단지 필터</Label>
          <Select value={filterComplex} onValueChange={setFilterComplex}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {isAdmin && <SelectItem value="all">전체 단지</SelectItem>}
              {complexes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1">
            <Printer className="h-4 w-4" />출력
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as InputType)}>
        <TabsList className="no-print">
          <TabsTrigger value="hearing" className="gap-1"><Mic className="h-4 w-4" />청취조사 ({hearings.length})</TabsTrigger>
          <TabsTrigger value="open_chat" className="gap-1"><MessageCircle className="h-4 w-4" />오픈채팅 이력 ({chats.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="hearing" className="space-y-4 mt-4">
          <Card className="no-print"><CardContent className="p-5 space-y-3">
            <div className="space-y-1">
              <div className="font-semibold">청취조사에 의한 유해·위험요인 조사표</div>
              <p className="text-[11px] text-muted-foreground">현장 근로자와 면담을 통해 경험한 유해·위험요인을 기록합니다.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">단지 *</Label>
                <Select value={formComplex} onValueChange={setFormComplex}>
                  <SelectTrigger><SelectValue placeholder="단지 선택" /></SelectTrigger>
                  <SelectContent>{complexes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">수행 일시</Label>
                <Input type="datetime-local" value={hearingAt} onChange={e=>setHearingAt(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div><Label className="text-xs">수행자 성명</Label>
                <Input value={hearing.conductor_name} onChange={e=>setHearing({...hearing, conductor_name: e.target.value})} placeholder="예: 문상식" /></div>
              <div><Label className="text-xs">근로자 성명</Label>
                <Input value={hearing.worker_name} onChange={e=>setHearing({...hearing, worker_name: e.target.value})} placeholder="응답한 근로자" /></div>
            </div>

            <p className="text-[11px] text-muted-foreground">※ 육하원칙(누가, 언제, 어디서, 무엇을, 어떻게, 왜)에 따라 작성</p>
            {[1,2,3].map(n => {
              const key = `experience_${n}` as "experience_1"|"experience_2"|"experience_3";
              return (
                <div key={n}>
                  <Label className="text-xs">경험담 {n}</Label>
                  <Textarea rows={3} value={hearing[key]} onChange={e=>setHearing({...hearing, [key]: e.target.value})}
                    placeholder={n===1 ? "예) 지하주차장 청소 중 미끄러져 넘어질 뻔함…" : ""} />
                </div>
              );
            })}

            <div>
              <Label className="text-xs">근로자 의견</Label>
              <Textarea rows={3} value={hearing.worker_opinion} onChange={e=>setHearing({...hearing, worker_opinion: e.target.value})} />
            </div>
            <div>
              <Label className="text-xs">수행자 의견</Label>
              <Textarea rows={3} value={hearing.conductor_opinion} onChange={e=>setHearing({...hearing, conductor_opinion: e.target.value})} />
            </div>

            <AttachmentPicker files={hearingFiles} setFiles={setHearingFiles} uploading={uploading}
              onPick={(f: FileList) => uploadFiles(f, setHearingFiles, hearingFiles)} />

            <ApprovalLineEditor value={hearing.approval} onChange={(a) => setHearing({ ...hearing, approval: a })} />

            <div className="flex justify-end">
              <Button onClick={submitHearing} disabled={saving || uploading}>{saving ? "저장 중..." : "청취조사 등록"}</Button>
            </div>
          </CardContent></Card>

          <List items={hearings} me={me} onDelete={del} onEdit={setEditing} onPrint={printOne} printItemId={printItemId} complexNameById={complexNameById} />
        </TabsContent>

        <TabsContent value="open_chat" className="space-y-4 mt-4">
          <Card className="no-print"><CardContent className="p-5 space-y-3">
            <div className="font-semibold">오픈채팅 이력 추가</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">단지 *</Label>
                <Select value={formComplex} onValueChange={setFormComplex}>
                  <SelectTrigger><SelectValue placeholder="단지 선택" /></SelectTrigger>
                  <SelectContent>{complexes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">채팅방명</Label>
                <Input value={chat.room_name} onChange={e=>setChat({...chat, room_name: e.target.value})} placeholder="단지 안전 오픈채팅" /></div>
              <div><Label className="text-xs">일시</Label>
                <Input type="datetime-local" value={chatAt} onChange={e=>setChatAt(e.target.value)} /></div>
            </div>
            <div>
              <Label className="text-xs">작성자</Label>
              <Input value={chat.author_name} onChange={e=>setChat({...chat, author_name: e.target.value})} placeholder="작성자명/직책" />
            </div>
            <div>
              <Label className="text-xs">대화 내용 / 요약</Label>
              <Textarea rows={4} value={chat.summary} onChange={e=>setChat({...chat, summary: e.target.value})}
                placeholder="오픈채팅에서 공유된 안전 관련 대화 내용을 입력하거나 캡처를 첨부하세요" />
            </div>
            <AttachmentPicker files={chatFiles} setFiles={setChatFiles} uploading={uploading}
              onPick={(f: FileList) => uploadFiles(f, setChatFiles, chatFiles)} />
            <ApprovalLineEditor value={chat.approval} onChange={(a) => setChat({ ...chat, approval: a })} />
            <div className="flex justify-end">
              <Button onClick={submitChat} disabled={saving || uploading || !chat.summary.trim()}>{saving ? "저장 중..." : "등록"}</Button>
            </div>
          </CardContent></Card>
          <List items={chats} me={me} onDelete={del} onEdit={setEditing} onPrint={printOne} printItemId={printItemId} complexNameById={complexNameById} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.input_type === "hearing" ? "청취조사 수정" : "오픈채팅 이력 수정"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">단지</Label>
                  <Select value={editing.complex_id ?? ""} onValueChange={(v) => setEditing({ ...editing, complex_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{complexes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">일시</Label>
                  <Input type="datetime-local" value={toLocalInput(editing.occurred_at)}
                    onChange={(e) => setEditing({ ...editing, occurred_at: new Date(e.target.value).toISOString() })} />
                </div>
              </div>

              {editing.input_type === "hearing" ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div><Label className="text-xs">수행자 성명</Label>
                      <Input value={editing.meta?.conductor_name ?? ""}
                        onChange={e => setEditing({ ...editing, meta: { ...editing.meta, conductor_name: e.target.value } })} /></div>
                    <div><Label className="text-xs">근로자 성명</Label>
                      <Input value={editing.meta?.worker_name ?? ""}
                        onChange={e => setEditing({ ...editing, meta: { ...editing.meta, worker_name: e.target.value } })} /></div>
                  </div>
                  {[1,2,3].map(n => {
                    const key = `experience_${n}`;
                    return (
                      <div key={n}>
                        <Label className="text-xs">경험담 {n}</Label>
                        <Textarea rows={3} value={editing.meta?.[key] ?? ""}
                          onChange={e => setEditing({ ...editing, meta: { ...editing.meta, [key]: e.target.value } })} />
                      </div>
                    );
                  })}
                  <div>
                    <Label className="text-xs">근로자 의견</Label>
                    <Textarea rows={3} value={editing.meta?.worker_opinion ?? ""}
                      onChange={e => setEditing({ ...editing, meta: { ...editing.meta, worker_opinion: e.target.value } })} />
                  </div>
                  <div>
                    <Label className="text-xs">수행자 의견</Label>
                    <Textarea rows={3} value={editing.meta?.conductor_opinion ?? ""}
                      onChange={e => setEditing({ ...editing, meta: { ...editing.meta, conductor_opinion: e.target.value } })} />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div><Label className="text-xs">채팅방명</Label>
                      <Input value={editing.meta?.room_name ?? ""}
                        onChange={e => setEditing({ ...editing, meta: { ...editing.meta, room_name: e.target.value } })} /></div>
                    <div><Label className="text-xs">작성자</Label>
                      <Input value={editing.meta?.author_name ?? ""}
                        onChange={e => setEditing({ ...editing, meta: { ...editing.meta, author_name: e.target.value } })} /></div>
                  </div>
                  <div>
                    <Label className="text-xs">대화 내용 / 요약</Label>
                    <Textarea rows={5} value={editing.meta?.summary ?? ""}
                      onChange={e => setEditing({ ...editing, meta: { ...editing.meta, summary: e.target.value } })} />
                  </div>
                </>
              )}

              <AttachmentPicker
                files={editing.attachments ?? []}
                setFiles={(urls: string[]) => setEditing({ ...editing, attachments: urls })}
                uploading={uploading}
                onPick={(f: FileList) => uploadFiles(f,
                  (urls) => setEditing((cur: any) => ({ ...cur, attachments: urls })),
                  editing.attachments ?? [],
                  editing.complex_id)}
              />

              <ApprovalLineEditor
                value={editing.meta?.approval ?? { ...EMPTY_APPROVAL }}
                onChange={(a: any) => setEditing({ ...editing, meta: { ...editing.meta, approval: a } })}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>취소</Button>
            <Button onClick={saveEdit} disabled={saving || uploading}>{saving ? "저장 중..." : "저장"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AttachmentPicker({ files, setFiles, uploading, onPick }: any) {
  return (
    <div>
      <Label className="text-xs">첨부 (사진/캡처)</Label>
      <div className="flex flex-wrap gap-2 mt-1">
        {files.map((url: string, i: number) => (
          <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border bg-muted">
            <img src={url} alt="" className="w-full h-full object-cover" />
            <button type="button" onClick={() => setFiles(files.filter((_: any, j: number) => j !== i))}
              className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5">
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <label className="w-20 h-20 rounded-md border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary text-[10px] gap-1 cursor-pointer">
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
          {uploading ? "업로드" : "추가"}
          <input type="file" accept="image/*" multiple className="hidden"
            onChange={e => e.target.files && onPick(e.target.files)} />
        </label>
      </div>
    </div>
  );
}

function List({ items, me, onDelete, onEdit, onPrint, printItemId, complexNameById }: { items: any[]; me: any; onDelete: (id: string) => void; onEdit: (it: any) => void; onPrint?: (id: string) => void; printItemId?: string | null; complexNameById: Record<string,string> }) {
  if (items.length === 0) {
    return <div className="text-center text-sm text-muted-foreground py-8 border rounded-md">등록된 항목이 없습니다.</div>;
  }
  return (
    <div className="space-y-2">
      {items.map(it => {
        const canMutate = me && (it.created_by === me.id || me.org_role === "admin" || me.org_role === "manager");
        const m = it.meta ?? {};
        return (
          <Card key={it.id} className={`print-card ${printItemId === it.id ? "print-target" : ""}`}><CardContent className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="outline">{it.input_type === "hearing" ? "청취조사" : "오픈채팅"}</Badge>
                  {it.complex_id && complexNameById[it.complex_id] && (
                    <Badge variant="secondary">{complexNameById[it.complex_id]}</Badge>
                  )}
                  {it.respondent_name && <span className="font-medium">{it.respondent_name}</span>}
                  {it.respondent_role && <span className="text-xs text-muted-foreground">{it.respondent_role}</span>}
                  <span className="text-xs text-muted-foreground ml-auto">{new Date(it.occurred_at).toLocaleString("ko-KR")}</span>
                </div>

                {it.input_type === "hearing" ? (
                  <div className="text-sm space-y-1.5">
                    <div className="text-xs text-muted-foreground">
                      수행자: <span className="text-foreground">{m.conductor_name || "-"}</span>
                      {" · "}근로자: <span className="text-foreground">{m.worker_name || "-"}</span>
                    </div>
                    {[1,2,3].map(n => {
                      const v = m[`experience_${n}`];
                      if (!v) return null;
                      return <div key={n}><span className="text-xs font-semibold">경험담 {n}:</span> <span className="whitespace-pre-wrap">{v}</span></div>;
                    })}
                    {m.worker_opinion && <div><span className="text-xs font-semibold">근로자 의견:</span> <span className="whitespace-pre-wrap">{m.worker_opinion}</span></div>}
                    {m.conductor_opinion && <div><span className="text-xs font-semibold">수행자 의견:</span> <span className="whitespace-pre-wrap">{m.conductor_opinion}</span></div>}
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{it.content}</p>
                )}

                {it.attachments?.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {it.attachments.map((url: string, i: number) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt="" className="print-attachment-img w-20 h-20 object-cover rounded-md border" />
                      </a>
                    ))}
                  </div>
                )}

                <ApprovalLineView approval={m.approval} />

              </div>
              {(canMutate || onPrint) && (
                <div className="flex items-center gap-1 no-print">
                  {onPrint && (
                    <button onClick={() => onPrint(it.id)} className="text-muted-foreground hover:text-primary p-1" title="이 기록 출력">
                      <Printer className="h-4 w-4" />
                    </button>
                  )}
                  {canMutate && <>
                  <button onClick={() => onEdit(it)} className="text-muted-foreground hover:text-primary p-1" title="수정">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => onDelete(it.id)} className="text-muted-foreground hover:text-destructive p-1" title="삭제">
                    <Trash2 className="h-4 w-4" />
                  </button>
                  </>}
                </div>
              )}
            </div>
          </CardContent></Card>
        );
      })}
    </div>
  );
}

type Approval = {
  drafter_name: string;
  reviewer_name: string;
  approver_name: string;
  drafter_signed_at: string;
  reviewer_signed_at: string;
  approver_signed_at: string;
};

const APPROVAL_ROLES: { key: keyof Approval; nameKey: keyof Approval; label: string }[] = [
  { key: "drafter_signed_at", nameKey: "drafter_name", label: "담당" },
  { key: "reviewer_signed_at", nameKey: "reviewer_name", label: "검토" },
  { key: "approver_signed_at", nameKey: "approver_name", label: "승인" },
];

function ApprovalLineEditor({ value, onChange }: { value: Approval; onChange: (a: Approval) => void }) {
  const v = value ?? { drafter_name: "", reviewer_name: "", approver_name: "", drafter_signed_at: "", reviewer_signed_at: "", approver_signed_at: "" };
  function setField<K extends keyof Approval>(k: K, val: string) { onChange({ ...v, [k]: val }); }
  function sign(nameKey: keyof Approval, dateKey: keyof Approval) {
    if (!v[nameKey]) { toast.error("성명을 먼저 입력하세요"); return; }
    setField(dateKey, new Date().toISOString());
  }
  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="text-xs font-semibold">결재라인</div>
      <div className="grid grid-cols-3 gap-2">
        {APPROVAL_ROLES.map(({ key, nameKey, label }) => (
          <div key={label} className="space-y-1">
            <Label className="text-[11px]">{label}</Label>
            <Input className="h-8 text-xs" placeholder="성명" value={(v[nameKey] as string) || ""}
              onChange={e => setField(nameKey, e.target.value)} />
            <div className="text-[10px] text-muted-foreground min-h-[14px]">
              {v[key] ? new Date(v[key] as string).toLocaleString("ko-KR") : "미결재"}
            </div>
            <Button type="button" variant={v[key] ? "secondary" : "outline"} size="sm" className="w-full h-7 text-xs"
              onClick={() => v[key] ? setField(key, "") : sign(nameKey, key)}>
              {v[key] ? "결재취소" : "결재"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ApprovalLineView({ approval }: { approval?: Approval }) {
  const a = approval;
  if (!a || (!a.drafter_name && !a.reviewer_name && !a.approver_name)) return null;
  return (
    <div className="mt-2 border rounded-md overflow-hidden text-xs">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            {APPROVAL_ROLES.map(r => <th key={r.label} className="px-2 py-1 border-r last:border-r-0 font-medium">{r.label}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr>
            {APPROVAL_ROLES.map(({ key, nameKey, label }) => (
              <td key={label} className="px-2 py-2 border-r last:border-r-0 text-center align-top">
                <div className="font-medium">{(a[nameKey] as string) || "-"}</div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {a[key] ? new Date(a[key] as string).toLocaleDateString("ko-KR") : "미결재"}
                </div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ReportText({ value, height }: { value?: string; height: string }) {
  return (
    <div style={{ height, overflow: "hidden", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {value || ""}
    </div>
  );
}

function HearingReportSheet({ item, complexName }: { item: any; complexName: string }) {
  const m = item.meta ?? {};
  const a: Approval | undefined = m.approval;
  const occurred = new Date(item.occurred_at);
  const dateStr = occurred.toLocaleDateString("ko-KR");
  const timeStr = occurred.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  const photos: string[] = item.attachments ?? [];

  return (
    <div className="print-sheet" style={{ fontFamily: "'Malgun Gothic', system-ui, sans-serif", color: "#000" }}>
      <style>{`
        @media print {
          .print-sheet {
            display: block !important;
            width: 194mm;
            height: 281mm;
            box-sizing: border-box;
            font-size: 9pt;
            line-height: 1.2;
            overflow: hidden;
            page-break-after: avoid;
            break-after: avoid;
          }
          .print-sheet table { page-break-inside: avoid; break-inside: avoid; }
        }
        .hr-title { text-align: center; font-size: 16pt; font-weight: 800; margin: 0; letter-spacing: 0; }
        .hr-subtitle { text-align: center; font-size: 8pt; margin: 1mm 0 0; color: #333; }
        .hr-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .hr-table th, .hr-table td { border: 1px solid #111; padding: 1.2mm 2mm; vertical-align: middle; box-sizing: border-box; }
        .hr-label { background: #f1f1f1; text-align: center; font-weight: 700; }
        .hr-content { white-space: pre-wrap; word-break: break-word; overflow: hidden; vertical-align: top !important; }
        .hr-small { font-size: 7.5pt; color: #444; }
        .hr-photo-row { display: flex; gap: 2mm; width: 100%; height: 100%; }
        .hr-photo-box { flex: 1 1 0; min-width: 0; height: 100%; border: 1px solid #555; background: #fafafa; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .hr-photo-box img { width: 100%; height: 100%; object-fit: contain; display: block; }
        .hr-photo-empty { color: #aaa; font-size: 8pt; }
      `}</style>

      <table className="hr-table" style={{ height: "26mm", marginBottom: "2mm" }}>
        <tbody>
          <tr>
            <td style={{ border: "none", padding: 0 }}>
              <h1 className="hr-title">청취조사에 의한 유해·위험요인 조사표</h1>
              <p className="hr-subtitle">산업안전보건법 제36조 제2항 · 근로자 의견 청취 기록</p>
            </td>
            <td style={{ border: "none", padding: 0, width: "66mm", verticalAlign: "top" }}>
              <table className="hr-table" style={{ height: "24mm" }}>
                <tbody>
                  <tr style={{ height: "6mm" }}>
                    <th className="hr-label" rowSpan={2} style={{ width: "9mm", padding: "1mm", writingMode: "vertical-rl" }}>결재</th>
                    {APPROVAL_ROLES.map(r => <th key={r.label} className="hr-label">{r.label}</th>)}
                  </tr>
                  <tr>
                    {APPROVAL_ROLES.map(({ key, nameKey, label }) => (
                      <td key={label} style={{ textAlign: "center", height: "18mm", padding: "1mm" }}>
                        <div style={{ minHeight: "8mm", fontWeight: 700 }}>{(a?.[nameKey] as string) || ""}</div>
                        <div className="hr-small">{a?.[key] ? new Date(a[key] as string).toLocaleDateString("ko-KR") : ""}</div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      <table className="hr-table" style={{ height: "26mm" }}>
        <tbody>
          <tr style={{ height: "8mm" }}>
            <th className="hr-label" style={{ width: "24mm" }}>단지</th>
            <td>{complexName || "-"}</td>
            <th className="hr-label" style={{ width: "24mm" }}>수행일시</th>
            <td>{dateStr} {timeStr}</td>
          </tr>
          <tr style={{ height: "8mm" }}>
            <th className="hr-label">수행자</th>
            <td>{m.conductor_name || "-"}</td>
            <th className="hr-label">근로자</th>
            <td>{m.worker_name || "-"}</td>
          </tr>
          <tr style={{ height: "10mm" }}>
            <th className="hr-label">실시방법</th>
            <td colSpan={3}>위험성평가 수행자가 현장 근로자와 면담을 통해 직접 경험한 유해·위험요인을 조사</td>
          </tr>
        </tbody>
      </table>

      <table className="hr-table" style={{ height: "168mm", marginTop: "2mm" }}>
        <tbody>
          {[1, 2, 3].map(n => (
            <tr key={n} style={{ height: "28mm" }}>
              <th className="hr-label" style={{ width: "24mm" }}>경험담 {n}</th>
              <td className="hr-content"><ReportText value={m[`experience_${n}`]} height="24mm" /></td>
            </tr>
          ))}
          <tr style={{ height: "38mm" }}>
            <th className="hr-label">근로자 의견<br/><span className="hr-small">(원인·반성)</span></th>
            <td className="hr-content"><ReportText value={m.worker_opinion} height="34mm" /></td>
          </tr>
          <tr style={{ height: "46mm" }}>
            <th className="hr-label">수행자 의견<br/><span className="hr-small">(조언)</span></th>
            <td className="hr-content"><ReportText value={m.conductor_opinion} height="42mm" /></td>
          </tr>
        </tbody>
      </table>

      <table className="hr-table" style={{ height: "38mm", marginTop: "2mm" }}>
        <tbody>
          <tr>
            <th className="hr-label" style={{ width: "24mm" }}>첨부사진</th>
            <td style={{ padding: "1.5mm", height: "38mm" }}>
              <div className="hr-photo-row">
                {Array.from({ length: 4 }).map((_, i) => {
                  const url = photos[i];
                  return (
                    <div key={i} className="hr-photo-box">
                      {url ? <img src={url} alt={`첨부사진 ${i + 1}`} /> : <span className="hr-photo-empty">사진 {i + 1}</span>}
                    </div>
                  );
                })}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ textAlign: "right", fontSize: "7.5pt", color: "#555", marginTop: "1mm" }}>
        출력일: {new Date().toLocaleString("ko-KR")}
      </div>
    </div>
  );
}


