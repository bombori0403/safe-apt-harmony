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
import { toast } from "sonner";
import { Trash2, MessageCircle, Mic, Camera, Loader2, X, Users } from "lucide-react";

export const Route = createFileRoute("/_app/employee-inputs")({
  component: EmployeeInputs,
});

type InputType = "hearing" | "open_chat";

const EMPTY_HEARING = {
  conductor_name: "",
  worker_name: "",
  experience_1: "",
  experience_2: "",
  experience_3: "",
  worker_opinion: "",
  conductor_opinion: "",
};

const EMPTY_CHAT = {
  room_name: "",
  author_name: "",
  summary: "",
};

function nowLocal() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
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

  const isAdmin = me?.org_role === "admin";

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: u } = await supabase.from("users")
        .select("id, org_role, organization_id").eq("auth_id", user.id).maybeSingle();
      if (!u) return;
      setMe(u as any);
      // Load complexes
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

  const complexNameById = useMemo(() => {
    const m: Record<string, string> = {};
    complexes.forEach(c => { m[c.id] = c.name; });
    return m;
  }, [complexes]);

  async function uploadFiles(files: FileList, setter: (urls: string[]) => void, existing: string[]) {
    setUploading(true);
    const urls = [...existing];
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `employee-inputs/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
        const { error } = await supabase.storage.from("assessment-photos").upload(path, file, {
          contentType: file.type, upsert: false,
        });
        if (error) throw error;
        const { data } = supabase.storage.from("assessment-photos").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      setter(urls);
    } catch (e: any) {
      toast.error(e.message ?? "업로드 실패");
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

  const hearings = items.filter(i => i.input_type === "hearing");
  const chats = items.filter(i => i.input_type === "open_chat");

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold inline-flex items-center gap-2"><Users className="h-6 w-6 text-primary" />직원 참여</h1>
          <p className="text-xs text-muted-foreground mt-1">
            청취조사 응답과 단지 오픈채팅 이력을 단지 단위로 기록·조회합니다.
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
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as InputType)}>
        <TabsList>
          <TabsTrigger value="hearing" className="gap-1"><Mic className="h-4 w-4" />청취조사 ({hearings.length})</TabsTrigger>
          <TabsTrigger value="open_chat" className="gap-1"><MessageCircle className="h-4 w-4" />오픈채팅 이력 ({chats.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="hearing" className="space-y-4 mt-4">
          <Card><CardContent className="p-5 space-y-3">
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

            <div className="flex justify-end">
              <Button onClick={submitHearing} disabled={saving || uploading}>{saving ? "저장 중..." : "청취조사 등록"}</Button>
            </div>
          </CardContent></Card>

          <List items={hearings} me={me} onDelete={del} complexNameById={complexNameById} />
        </TabsContent>

        <TabsContent value="open_chat" className="space-y-4 mt-4">
          <Card><CardContent className="p-5 space-y-3">
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
            <div className="flex justify-end">
              <Button onClick={submitChat} disabled={saving || uploading || !chat.summary.trim()}>{saving ? "저장 중..." : "등록"}</Button>
            </div>
          </CardContent></Card>
          <List items={chats} me={me} onDelete={del} complexNameById={complexNameById} />
        </TabsContent>
      </Tabs>
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

function List({ items, me, onDelete, complexNameById }: { items: any[]; me: any; onDelete: (id: string) => void; complexNameById: Record<string,string> }) {
  if (items.length === 0) {
    return <div className="text-center text-sm text-muted-foreground py-8 border rounded-md">등록된 항목이 없습니다.</div>;
  }
  return (
    <div className="space-y-2">
      {items.map(it => {
        const canDel = me && (it.created_by === me.id || me.org_role === "admin" || me.org_role === "manager");
        const m = it.meta ?? {};
        return (
          <Card key={it.id}><CardContent className="p-4 space-y-2">
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
                        <img src={url} alt="" className="w-20 h-20 object-cover rounded-md border" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
              {canDel && (
                <button onClick={() => onDelete(it.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </CardContent></Card>
        );
      })}
    </div>
  );
}
