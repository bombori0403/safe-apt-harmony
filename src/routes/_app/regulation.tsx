import { createFileRoute } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Printer, Pencil, Save, X, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { TrialWatermark } from "@/components/trial-watermark";
import { REGULATION_DEFAULTS, resolveOrgTokens } from "@/components/regulation-document";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/regulation")({
  component: RegulationPage,
});

// ============ 기본 텍스트 (조직 override가 없으면 사용) ============
const DEFAULTS: Record<string, string> = REGULATION_DEFAULTS;

// ============ Context ============
type Draft = Record<string, string>;
const EditCtx = createContext<{
  editing: boolean;
  isAdmin: boolean;
  get: (k: string) => string;
  setDraft: (k: string, v: string) => void;
  draft: Draft;
}>({ editing: false, isAdmin: false, get: (k) => DEFAULTS[k] ?? "", setDraft: () => {}, draft: {} });

function useRegulationData() {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user) { setLoading(false); return; }
      const { data: u } = await supabase
        .from("users")
        .select("organization_id, org_role")
        .eq("auth_id", user.id)
        .maybeSingle();
      if (!u?.organization_id) { setLoading(false); return; }
      setOrgId(u.organization_id);
      setIsAdmin(u.org_role === "admin");
      const { data: o } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", u.organization_id)
        .maybeSingle();
      setOrgName(o?.name ?? null);
      const { data: row } = await supabase
        .from("regulation_content")
        .select("overrides")
        .eq("organization_id", u.organization_id)
        .maybeSingle();
      if (row?.overrides && typeof row.overrides === "object") {
        setOverrides(row.overrides as Record<string, string>);
      }
      setLoading(false);
    })();
  }, [user]);

  const saveAll = async (next: Record<string, string>) => {
    if (!orgId) return false;
    // draft에는 "실제로 손댄 항목"만 들어오므로 기존 저장값과 병합한다.
    // 손대지 않은 항목은 기본값(=자리표시자)으로 남아 사업장명 변경을 계속 따라간다.
    const merged = { ...overrides, ...next };
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== null && v !== DEFAULTS[k]) cleaned[k] = v;
    }
    const { error } = await supabase
      .from("regulation_content")
      .upsert({ organization_id: orgId, overrides: cleaned, updated_at: new Date().toISOString() });
    if (error) { toast.error("저장 실패: " + error.message); return false; }
    setOverrides(cleaned);
    toast.success("저장되었습니다");
    return true;
  };

  const resetAll = async () => {
    if (!orgId) return;
    const { error } = await supabase
      .from("regulation_content")
      .upsert({ organization_id: orgId, overrides: {}, updated_at: new Date().toISOString() });
    if (error) { toast.error("초기화 실패: " + error.message); return; }
    setOverrides({});
    toast.success("모든 내용을 기본값으로 되돌렸습니다");
  };

  // 치환 전 원본(자리표시자 포함). 실제 표시용 get은 사업장명을 아는 화면단에서 만든다.
  const rawGet = (k: string) => overrides[k] ?? DEFAULTS[k] ?? "";

  return { rawGet, orgName, saveAll, resetAll, isAdmin, loading, overrides };
}

// ============ Editable field ============
function F({ k, singleLine, className }: { k: string; singleLine?: boolean; className?: string }) {
  const { editing, get, setDraft, draft } = useContext(EditCtx);
  const current = draft[k] ?? get(k);
  if (editing) {
    return singleLine ? (
      <Input
        value={current}
        onChange={(e) => setDraft(k, e.target.value)}
        className={"h-8 " + (className ?? "")}
      />
    ) : (
      <Textarea
        value={current}
        onChange={(e) => setDraft(k, e.target.value)}
        rows={Math.max(3, current.split("\n").length + 1)}
        className={"font-sans text-sm leading-7 " + (className ?? "")}
      />
    );
  }
  return <span className={"whitespace-pre-wrap " + (className ?? "")}>{current}</span>;
}

// 표 셀 편집 안내
function TableBlock({ k }: { k: string }) {
  const { editing, get, setDraft, draft } = useContext(EditCtx);
  const current = draft[k] ?? get(k);
  if (editing) {
    return (
      <Textarea
        value={current}
        onChange={(e) => setDraft(k, e.target.value)}
        rows={Math.max(6, current.split("\n").length + 1)}
        className="font-mono text-xs leading-6"
      />
    );
  }
  return (
    <pre className="text-xs leading-6 whitespace-pre-wrap border rounded-md p-3 bg-muted/30 font-sans">
      {current}
    </pre>
  );
}

// 조직도 박스: 상단 역할 라벨(파란색), 하단 이름
function OrgBox({ roleKey, nameKey }: { roleKey: string; nameKey: string }) {
  return (
    <div className="border border-slate-400 rounded-sm overflow-hidden bg-white text-center text-xs min-w-[110px]">
      <div className="bg-sky-100 border-b border-slate-400 px-2 py-1 font-semibold">
        <F k={roleKey} singleLine className="text-center" />
      </div>
      <div className="px-2 py-1">
        <F k={nameKey} singleLine className="text-center" />
      </div>
    </div>
  );
}

function OrgChart() {
  const V = <div className="w-px h-4 bg-slate-600" />;
  return (
    <div className="border rounded-md p-4 md:p-6 bg-muted/20 print:bg-white overflow-x-auto">
      <div className="mx-auto w-full max-w-[720px] min-w-[560px]">
        {/* 총괄 책임자 - centered */}
        <div className="flex justify-center">
          <OrgBox roleKey="org_lead_role" nameKey="org_lead_name" />
        </div>
        {/* vertical line */}
        <div className="flex justify-center">{V}</div>
        {/* 안전보건관리 책임자 (centered) + 위험성평가 담당자 (to the right, connected by horizontal line) */}
        <div className="flex justify-center">
          <div className="relative">
            <OrgBox roleKey="org_safety_role" nameKey="org_safety_name" />
            <div className="absolute top-1/2 left-full -translate-y-1/2 flex items-center">
              <div className="h-px w-10 bg-slate-600" />
              <OrgBox roleKey="org_assessor_role" nameKey="org_assessor_name" />
            </div>
          </div>
        </div>
        {/* vertical line below safety */}
        <div className="flex justify-center">{V}</div>
        {/* horizontal bar spanning 4 columns */}
        <div className="grid grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="relative h-0">
              <div
                className={`absolute top-0 h-px bg-slate-600 ${
                  i === 0 ? "left-1/2 right-0" : i === 3 ? "left-0 right-1/2" : "left-0 right-0"
                }`}
              />
            </div>
          ))}
        </div>
        {/* 4 columns: vline → 관리자 → vline → 근로자 */}
        <div className="grid grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col items-center">
              {V}
              <OrgBox roleKey={`org_mgr${i}_role`} nameKey={`org_mgr${i}_name`} />
              {V}
              <OrgBox roleKey={`org_worker${i}_role`} nameKey={`org_worker${i}_name`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ArticleSec({ no, k }: { no: string; k: string }) {
  return (
    <section className="space-y-2">
      <h3 className="font-bold text-base">
        제{no}조(<F k={`${k}_title`} singleLine />)
      </h3>
      <div className="text-sm leading-7 text-foreground/90">
        <F k={k} />
      </div>
    </section>
  );
}

function RegulationPage() {
  const reg = useRegulationData();
  const sub = useSubscription();
  const [editing, setEditing] = useState(false);
  const [draft, setDraftState] = useState<Draft>({});
  const [saving, setSaving] = useState(false);

  const setDraft = (k: string, v: string) => setDraftState((d) => ({ ...d, [k]: v }));

  // 맨 위 "사업장명"이 문서 전체의 사업장 표기를 결정한다.
  // 편집 중에는 입력값(draft)을 즉시 반영해 본문이 실시간으로 따라 바뀐다.
  const siteName = resolveOrgTokens(draft.header_site ?? reg.rawGet("header_site"), reg.orgName);
  // 손대지 않은 항목은 자리표시자가 살아있어 사업장명 변경을 계속 따라간다.
  const get = (k: string) => resolveOrgTokens(reg.rawGet(k), siteName);

  const startEdit = () => {
    // 미리 채우지 않는다. 실제로 수정한 항목만 draft에 담겨야
    // 나머지 본문이 사업장명 변경을 계속 따라갈 수 있다.
    setDraftState({});
    setEditing(true);
  };
  const cancelEdit = () => { setEditing(false); setDraftState({}); };
  const saveEdit = async () => {
    setSaving(true);
    const ok = await reg.saveAll(draft);
    setSaving(false);
    if (ok) { setEditing(false); setDraftState({}); }
  };
  const resetAll = async () => {
    if (!confirm("모든 내용을 기본값으로 되돌립니다. 계속하시겠습니까?")) return;
    await reg.resetAll();
    setEditing(false);
    setDraftState({});
  };

  return (
    <EditCtx.Provider value={{ editing, isAdmin: reg.isAdmin, get, setDraft, draft }}>
      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        {sub.isTrial && <TrialWatermark expired={sub.isExpired} />}
        <div className="flex items-center justify-between print:hidden gap-2 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">위험성평가 실시규정</h1>
            <p className="text-sm text-muted-foreground">
              {reg.isAdmin
                ? (editing
                    ? "편집 모드 — 사업장명, 기관명, 표 내용까지 모두 자유롭게 수정하세요."
                    : "관리자: 우측 [전체 편집] 버튼으로 문서 전체 내용을 수정할 수 있습니다.")
                : "현장별 위험성평가 실시규정"}
            </p>
          </div>
          <div className="flex gap-2">
            {reg.isAdmin && !editing && (
              <>
                <Button variant="outline" onClick={startEdit}>
                  <Pencil className="w-4 h-4 mr-2" /> 전체 편집
                </Button>
                {Object.keys(reg.overrides).length > 0 && (
                  <Button variant="ghost" onClick={resetAll}>
                    <RotateCcw className="w-4 h-4 mr-2" /> 전체 초기화
                  </Button>
                )}
              </>
            )}
            {reg.isAdmin && editing && (
              <>
                <Button onClick={saveEdit} disabled={saving}>
                  <Save className="w-4 h-4 mr-2" /> {saving ? "저장 중..." : "저장"}
                </Button>
                <Button variant="outline" onClick={cancelEdit} disabled={saving}>
                  <X className="w-4 h-4 mr-2" /> 취소
                </Button>
              </>
            )}
            {!editing && (
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-2" /> 인쇄
              </Button>
            )}
          </div>
        </div>

        <Card className="print:shadow-none print:border-0">
          <CardHeader className="text-center border-b">
            <CardTitle className="text-3xl">
              <F k="doc_title" singleLine className="text-center text-3xl font-bold" />
            </CardTitle>
            <div className="text-sm text-muted-foreground mt-2 flex flex-wrap gap-x-6 gap-y-2 justify-center items-center">
              <div className="flex items-center gap-2">
                ▢ 사업장명:
                <span className="inline-block min-w-[220px] text-left">
                  <F k="header_site" singleLine />
                </span>
              </div>
              <div className="flex items-center gap-2">
                ▢ 작성일자:
                <span className="inline-block min-w-[200px] text-left">
                  <F k="header_date" singleLine />
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 md:p-10 space-y-8">
            <section className="bg-muted/30 rounded-md p-5 space-y-3">
              <h2 className="font-bold text-lg">
                <F k="policy_heading" singleLine />
              </h2>
              <div className="text-sm leading-7"><F k="policy_intro" /></div>
              <div className="text-sm leading-7">
                {editing ? (
                  <>
                    <div className="text-xs text-muted-foreground mb-1">(줄바꿈으로 항목 구분 — 표시 시 자동으로 • 목록)</div>
                    <F k="policy_bullets" />
                  </>
                ) : (
                  <ul className="list-disc pl-5 space-y-1">
                    {get("policy_bullets").split("\n").filter(Boolean).map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="text-sm font-semibold pt-2"><F k="policy_goal" /></div>
            </section>

            <ArticleSec no="1" k="article_1" />
            <ArticleSec no="2" k="article_2" />

            <section className="space-y-3">
              <h3 className="font-bold text-base">제3조(<F k="article_3_title" singleLine />)</h3>
              <div className="text-sm leading-7"><F k="article_3" /></div>
              <OrgChart />
            </section>

            <section className="space-y-2">
              <h3 className="font-bold text-base">제4조(<F k="article_4_title" singleLine />)</h3>
              <div className="text-sm leading-7"><F k="article_4" /></div>
              <TableBlock k="article_4_table" />
            </section>

            <ArticleSec no="5" k="article_5" />
            <ArticleSec no="6" k="article_6" />
            <ArticleSec no="7" k="article_7" />
            <ArticleSec no="8" k="article_8" />
            <ArticleSec no="9" k="article_9" />

            <section className="space-y-2">
              <h3 className="font-bold text-base">제10조(<F k="article_10_title" singleLine />)</h3>
              <div className="text-sm leading-7"><F k="article_10" /></div>
              <TableBlock k="article_10_table" />
            </section>

            <ArticleSec no="11" k="article_11" />
            <ArticleSec no="12" k="article_12" />
            <ArticleSec no="13" k="article_13" />
            <ArticleSec no="14" k="article_14" />
            <ArticleSec no="15" k="article_15" />
            <ArticleSec no="16" k="article_16" />

            <section className="space-y-2">
              <h3 className="font-bold text-base">제17조(<F k="article_17_title" singleLine />)</h3>
              <div className="text-sm leading-7"><F k="article_17" /></div>
              <TableBlock k="article_17_table" />
            </section>

            <section className="space-y-2 pt-4 border-t">
              <h3 className="font-bold text-base">
                <F k="appendix_title" singleLine />
              </h3>
              <TableBlock k="appendix_table" />
            </section>
          </CardContent>
        </Card>
      </div>
    </EditCtx.Provider>
  );
}
