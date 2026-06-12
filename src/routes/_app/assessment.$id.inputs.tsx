import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Trash2, MessageCircle, Mic, Camera, Loader2, X } from "lucide-react";

export const Route = createFileRoute("/_app/assessment/$id/inputs")({
  component: Inputs,
});

type InputType = "hearing" | "open_chat";

function Inputs() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [me, setMe] = useState<{ id: string; org_role: string } | null>(null);
  const [a, setA] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [tab, setTab] = useState<InputType>("hearing");

  // form state
  const [respondentName, setRespondentName] = useState("");
  const [respondentRole, setRespondentRole] = useState("");
  const [content, setContent] = useState("");
  const [occurredAt, setOccurredAt] = useState<string>(() =>
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  );
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("users").select("id, org_role").eq("auth_id", user.id).maybeSingle()
      .then(({ data }) => setMe(data as any));
  }, [user]);

  async function load() {
    const { data: ass } = await supabase.from("assessments").select("*").eq("id", id).maybeSingle();
    setA(ass);
    const { data } = await supabase.from("employee_inputs")
      .select("*").eq("assessment_id", id).order("occurred_at", { ascending: false });
    setItems(data ?? []);
  }
  useEffect(() => { load(); }, [id]);

  async function uploadFiles(files: FileList) {
    setUploading(true);
    const urls = [...attachments];
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${id}/inputs/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
        const { error } = await supabase.storage.from("assessment-photos").upload(path, file, {
          contentType: file.type, upsert: false,
        });
        if (error) throw error;
        const { data } = supabase.storage.from("assessment-photos").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      setAttachments(urls);
    } catch (e: any) {
      toast.error(e.message ?? "업로드 실패");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!content.trim()) { toast.error("내용을 입력하세요"); return; }
    if (!me) return;
    setSaving(true);
    const { error } = await supabase.from("employee_inputs").insert({
      assessment_id: id,
      complex_id: a?.complex_id ?? null,
      organization_id: a?.organization_id ?? null,
      created_by: me.id,
      input_type: tab,
      respondent_name: respondentName.trim() || null,
      respondent_role: respondentRole.trim() || null,
      content: content.trim(),
      occurred_at: new Date(occurredAt).toISOString(),
      attachments,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("등록되었습니다");
    setRespondentName(""); setRespondentRole(""); setContent(""); setAttachments([]);
    load();
  }

  async function del(rowId: string) {
    if (!confirm("삭제하시겠습니까?")) return;
    const { error } = await supabase.from("employee_inputs").delete().eq("id", rowId);
    if (error) toast.error(error.message); else { toast.success("삭제됨"); load(); }
  }

  const hearings = items.filter(i => i.input_type === "hearing");
  const chats = items.filter(i => i.input_type === "open_chat");

  if (!a) return <div className="p-8 text-muted-foreground">불러오는 중...</div>;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/assessment/$id" params={{ id }} className="text-sm text-muted-foreground inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" />돌아가기
          </Link>
          <h1 className="text-2xl font-bold mt-1">직원 참여 의견</h1>
          <p className="text-xs text-muted-foreground mt-1">
            산업안전보건법 제36조 제2항에 따른 근로자 의견 청취 기록. 청취조사 응답과 단지 오픈채팅 이력을 보관합니다.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as InputType)}>
        <TabsList>
          <TabsTrigger value="hearing" className="gap-1"><Mic className="h-4 w-4" />청취조사 ({hearings.length})</TabsTrigger>
          <TabsTrigger value="open_chat" className="gap-1"><MessageCircle className="h-4 w-4" />오픈채팅 이력 ({chats.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="hearing" className="space-y-4 mt-4">
          <FormCard
            title="청취조사 응답 추가"
            namePh="응답자 이름 (선택)"
            rolePh="직책/소속 (선택)"
            contentPh="청취조사 응답 내용을 입력하세요 (예: 위험요인, 개선 의견)"
            respondentName={respondentName} setRespondentName={setRespondentName}
            respondentRole={respondentRole} setRespondentRole={setRespondentRole}
            content={content} setContent={setContent}
            occurredAt={occurredAt} setOccurredAt={setOccurredAt}
            attachments={attachments} setAttachments={setAttachments}
            uploading={uploading} uploadFiles={uploadFiles}
            saving={saving} submit={submit}
          />
          <List items={hearings} me={me} onDelete={del} />
        </TabsContent>

        <TabsContent value="open_chat" className="space-y-4 mt-4">
          <FormCard
            title="오픈채팅 이력 추가"
            namePh="채팅방/작성자명 (선택)"
            rolePh="역할 (선택)"
            contentPh="오픈채팅에서 공유된 안전 관련 대화 내용을 입력하거나 캡처를 첨부하세요"
            respondentName={respondentName} setRespondentName={setRespondentName}
            respondentRole={respondentRole} setRespondentRole={setRespondentRole}
            content={content} setContent={setContent}
            occurredAt={occurredAt} setOccurredAt={setOccurredAt}
            attachments={attachments} setAttachments={setAttachments}
            uploading={uploading} uploadFiles={uploadFiles}
            saving={saving} submit={submit}
          />
          <List items={chats} me={me} onDelete={del} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FormCard(props: any) {
  const {
    title, namePh, rolePh, contentPh,
    respondentName, setRespondentName, respondentRole, setRespondentRole,
    content, setContent, occurredAt, setOccurredAt,
    attachments, setAttachments, uploading, uploadFiles, saving, submit,
  } = props;
  return (
    <Card><CardContent className="p-5 space-y-3">
      <div className="font-semibold">{title}</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div><Label className="text-xs">이름/채팅방</Label><Input value={respondentName} onChange={e=>setRespondentName(e.target.value)} placeholder={namePh} /></div>
        <div><Label className="text-xs">직책/역할</Label><Input value={respondentRole} onChange={e=>setRespondentRole(e.target.value)} placeholder={rolePh} /></div>
        <div><Label className="text-xs">일시</Label><Input type="datetime-local" value={occurredAt} onChange={e=>setOccurredAt(e.target.value)} /></div>
      </div>
      <div>
        <Label className="text-xs">내용</Label>
        <Textarea rows={4} value={content} onChange={e=>setContent(e.target.value)} placeholder={contentPh} />
      </div>
      <div>
        <Label className="text-xs">첨부 (사진/캡처)</Label>
        <div className="flex flex-wrap gap-2 mt-1">
          {attachments.map((url: string, i: number) => (
            <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border bg-muted">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button onClick={() => setAttachments(attachments.filter((_: any, j: number) => j !== i))} type="button"
                className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <label className="w-20 h-20 rounded-md border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary text-[10px] gap-1 cursor-pointer">
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
            {uploading ? "업로드" : "추가"}
            <input type="file" accept="image/*" multiple className="hidden"
              onChange={e => e.target.files && uploadFiles(e.target.files)} />
          </label>
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={submit} disabled={saving || uploading || !content.trim()}>{saving ? "저장 중..." : "등록"}</Button>
      </div>
    </CardContent></Card>
  );
}

function List({ items, me, onDelete }: { items: any[]; me: any; onDelete: (id: string) => void }) {
  if (items.length === 0) {
    return <div className="text-center text-sm text-muted-foreground py-8 border rounded-md">등록된 항목이 없습니다.</div>;
  }
  return (
    <div className="space-y-2">
      {items.map(it => {
        const canDel = me && (it.created_by === me.id || me.org_role === "admin" || me.org_role === "manager");
        return (
          <Card key={it.id}><CardContent className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="outline">{it.input_type === "hearing" ? "청취조사" : "오픈채팅"}</Badge>
                  {it.respondent_name && <span className="font-medium">{it.respondent_name}</span>}
                  {it.respondent_role && <span className="text-xs text-muted-foreground">{it.respondent_role}</span>}
                  <span className="text-xs text-muted-foreground ml-auto">{new Date(it.occurred_at).toLocaleString("ko-KR")}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap mt-2">{it.content}</p>
                {it.attachments?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
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
