import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer, Pencil, Save, X, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { TrialWatermark } from "@/components/trial-watermark";
import { DEFAULT_REGULATION_HTML } from "@/components/regulation-document";
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
  const [html, setHtml] = useState<string>(DEFAULT_REGULATION_HTML);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [renderKey, setRenderKey] = useState(0);       // 취소 시 편집 DOM을 원상 복구
  const ref = useRef<HTMLDivElement>(null);

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
      const saved = (row?.overrides as any)?.full_html as string | undefined;
      if (saved) setHtml(saved);
    })();
  }, [user]);

  async function save() {
    if (!orgId || !ref.current) return;
    const newHtml = ref.current.innerHTML;
    setSaving(true);
    const { data: existing } = await supabase.from("regulation_content").select("overrides").eq("organization_id", orgId).maybeSingle();
    const overrides = { ...((existing?.overrides as any) || {}), full_html: newHtml };
    const res = existing
      ? await supabase.from("regulation_content").update({ overrides }).eq("organization_id", orgId).select("organization_id")
      : await supabase.from("regulation_content").insert({ organization_id: orgId, overrides }).select("organization_id");
    setSaving(false);
    if (res.error || !res.data?.length) { toast.error(writeErrorMessage(res.error)); return; }
    setHtml(newHtml);
    setEditing(false);
    setRenderKey((k) => k + 1);
    toast.success("저장되었습니다");
  }

  function cancel() {
    setEditing(false);
    setRenderKey((k) => k + 1);   // 편집 중 바뀐 DOM을 저장된 html로 되돌림
  }

  async function resetToDefault() {
    if (!window.confirm("원본 서식으로 되돌릴까요? 지금까지 수정한 내용은 사라집니다.")) return;
    setHtml(DEFAULT_REGULATION_HTML);
    setRenderKey((k) => k + 1);
    setEditing(false);
    if (orgId) {
      const { data: existing } = await supabase.from("regulation_content").select("overrides").eq("organization_id", orgId).maybeSingle();
      const overrides = { ...((existing?.overrides as any) || {}), full_html: DEFAULT_REGULATION_HTML };
      if (existing) await supabase.from("regulation_content").update({ overrides }).eq("organization_id", orgId);
      else await supabase.from("regulation_content").insert({ organization_id: orgId, overrides });
    }
    toast.success("원본 서식으로 되돌렸습니다");
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {sub.isTrial && <TrialWatermark expired={sub.isExpired} />}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">위험성평가 실시규정</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {editing
              ? "문서를 직접 클릭해 내용을 고친 뒤 저장하세요. (표 칸·문구 수정 가능)"
              : "제출용 원본 서식입니다. 사업장명·결재란 등은 수정하기로 채워 넣으세요."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && !editing && (
            <>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" />수정하기</Button>
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={resetToDefault}><RotateCcw className="h-4 w-4" />원본 초기화</Button>
            </>
          )}
          {editing && (
            <>
              <Button size="sm" className="gap-1.5" onClick={save} disabled={saving}><Save className="h-4 w-4" />{saving ? "저장 중..." : "저장"}</Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={cancel} disabled={saving}><X className="h-4 w-4" />취소</Button>
            </>
          )}
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" />인쇄</Button>
          )}
        </div>
      </div>

      <div className={`bg-white text-black rounded-lg border p-5 md:p-8 print:border-0 print:p-0 overflow-x-auto ${editing ? "ring-2 ring-primary/50" : ""}`}>
        <div
          key={renderKey}
          ref={ref}
          contentEditable={editing}
          suppressContentEditableWarning
          className="outline-none"
          dangerouslySetInnerHTML={{ __html: html.replaceAll("{{사업장}}", orgName || "○○○○") }}
        />
      </div>
      {editing && <p className="text-xs text-muted-foreground mt-2 print:hidden">※ 표에 줄을 추가/삭제하는 큰 변경은 어렵습니다. 칸 안의 글자·문구 수정 위주로 사용하세요.</p>}
    </div>
  );
}
