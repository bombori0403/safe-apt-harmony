import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer, Pencil, Save, X, RotateCcw, ImagePlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { TrialWatermark } from "@/components/trial-watermark";
import { DEFAULT_REGULATION_HTML, resolveRegulationHtml, stripOrgMarker } from "@/components/regulation-document";
import { uploadPhotos } from "@/lib/photo-upload";
import { writeErrorMessage } from "@/lib/write-error";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/regulation")({
  component: RegulationPage,
});

function RegulationPage() {
  const { user } = useAuth();
  const sub = useSubscription();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [html, setHtml] = useState<string>(DEFAULT_REGULATION_HTML); // 토큰 포함 원본
  const [orgChartUrl, setOrgChartUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [renderKey, setRenderKey] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: u } = await supabase.from("users").select("organization_id, org_role").eq("auth_id", user.id).maybeSingle();
      if (!u?.organization_id) return;
      setOrgId(u.organization_id);
      setIsAdmin(u.org_role === "admin");
      const { data: org } = await supabase.from("organizations").select("name").eq("id", u.organization_id).maybeSingle();
      setOrgName(org?.name ?? null);
      const { data: row } = await supabase.from("regulation_content").select("overrides").eq("organization_id", u.organization_id).maybeSingle();
      const ov = (row?.overrides as any) || {};
      if (ov.full_html) setHtml(ov.full_html);
      if (ov.org_chart_url) setOrgChartUrl(ov.org_chart_url);
    })();
  }, [user]);

  async function upsertOverrides(patch: Record<string, any>): Promise<{ error: any; data: any[] | null }> {
    if (!orgId) return { error: new Error("조직 정보 없음"), data: null };
    const { data: existing } = await supabase.from("regulation_content").select("overrides").eq("organization_id", orgId).maybeSingle();
    const overrides = { ...((existing?.overrides as any) || {}), ...patch };
    return existing
      ? await supabase.from("regulation_content").update({ overrides }).eq("organization_id", orgId).select("organization_id")
      : await supabase.from("regulation_content").insert({ organization_id: orgId, overrides }).select("organization_id");
  }

  async function save() {
    if (!ref.current) return;
    setSaving(true);
    const newHtml = stripOrgMarker(ref.current.innerHTML); // 조직도 자리는 토큰으로 복원
    const res = await upsertOverrides({ full_html: newHtml });
    setSaving(false);
    if (res.error || !res.data?.length) { toast.error(writeErrorMessage(res.error)); return; }
    setHtml(newHtml);
    setEditing(false);
    setRenderKey((k) => k + 1);
    toast.success("저장되었습니다");
  }

  function cancel() { setEditing(false); setRenderKey((k) => k + 1); }

  async function resetToDefault() {
    if (!window.confirm("본문을 원본 서식으로 되돌릴까요? (조직도 이미지는 유지됩니다)")) return;
    setHtml(DEFAULT_REGULATION_HTML);
    setEditing(false);
    setRenderKey((k) => k + 1);
    await upsertOverrides({ full_html: DEFAULT_REGULATION_HTML });
    toast.success("원본 서식으로 되돌렸습니다");
  }

  async function onOrgChart(files: FileList) {
    setUploading(true);
    try {
      const [url] = await uploadPhotos(files, "safety-photos", "regulation");
      const res = await upsertOverrides({ org_chart_url: url });
      if (res.error) { toast.error(writeErrorMessage(res.error)); return; }
      setOrgChartUrl(url);
      setRenderKey((k) => k + 1);
      toast.success("조직도 이미지가 적용되었습니다");
    } catch (e: any) {
      toast.error(e.message ?? "업로드 실패");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function clearOrgChart() {
    if (!window.confirm("업로드한 조직도 이미지를 지우고 기본 조직도로 되돌릴까요?")) return;
    await upsertOverrides({ org_chart_url: null });
    setOrgChartUrl(null);
    setRenderKey((k) => k + 1);
    toast.success("기본 조직도로 되돌렸습니다");
  }

  const shown = resolveRegulationHtml(html, orgName, orgChartUrl);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {sub.isTrial && <TrialWatermark expired={sub.isExpired} />}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">위험성평가 실시규정</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {editing
              ? "문서를 직접 클릭해 내용을 고친 뒤 저장하세요. (표 칸·문구 수정 가능)"
              : "제출용 원본 서식입니다. 사업장명은 자동으로 채워지며, 결재란 등은 수정하기로 채워 넣으세요."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && !editing && (
            <>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" />수정하기</Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}조직도 이미지
              </Button>
              {orgChartUrl && <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={clearOrgChart}>기본 조직도로</Button>}
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={resetToDefault}><RotateCcw className="h-4 w-4" />본문 초기화</Button>
            </>
          )}
          {editing && (
            <>
              <Button size="sm" className="gap-1.5" onClick={save} disabled={saving}><Save className="h-4 w-4" />{saving ? "저장 중..." : "저장"}</Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={cancel} disabled={saving}><X className="h-4 w-4" />취소</Button>
            </>
          )}
          {!editing && <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" />인쇄</Button>}
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files && e.target.files.length && onOrgChart(e.target.files)} />

      {isAdmin && !editing && (
        <p className="text-xs text-muted-foreground mb-3 print:hidden">
          💡 조직도를 원하는 대로 만들고 싶으면 한글·PPT에서 조직도를 만들어 캡처한 뒤 <b>조직도 이미지</b>로 올리면 그 그림이 실시규정에 들어갑니다.
        </p>
      )}

      <div className={`bg-white text-black rounded-lg border p-5 md:p-8 print:border-0 print:p-0 overflow-x-auto ${editing ? "ring-2 ring-primary/50" : ""}`}>
        <div key={renderKey} ref={ref} contentEditable={editing} suppressContentEditableWarning className="outline-none" dangerouslySetInnerHTML={{ __html: shown }} />
      </div>
    </div>
  );
}
