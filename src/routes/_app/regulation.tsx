import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Printer, Pencil, Check, X, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/regulation")({
  component: RegulationPage,
});

// ============ 기본 텍스트 (조직 override가 없으면 사용) ============
const DEFAULTS: Record<string, string> = {
  header_site: "○○○○상록아파트 관리사무소",
  header_date: "○○○○년 ○○월 ○○일",
  policy_intro:
    "공무원연금공단은 국민의 생명과 안전을 경영의 최우선 가치로 두며 이를 위해 최선의 노력을 다한다.",
  policy_bullets: `근로자의 참여와 협의를 바탕으로 안전보건경영 시스템을 구축·운영한다.
잠재적 유해·위험요인을 선제적으로 발굴하고 지속적으로 개선한다.
관계 수급업체를 비롯한 이해관계자의 안전협력체계를 유지하고 성숙한 안전문화를 조성한다.
안전보건관련 법령 및 규정을 철저히 준수한다.`,
  policy_goal: "위험성평가 중심의 「자기규율 예방체계」 확립 (중대재해 Zero, 산업재해 Zero)",
  article_1: `이 실시규정은 공무원연금공단 ○○○○상록아파트(이하 "공단 임대주택"이라 한다) 전체의 유해·위험요인을 파악하고, 그 유해·위험요인별 위험성의 수준을 결정한 후 위험성을 감소시키기 위해 필요한 조치를 마련하여 실시함을 목적으로 한다. 이 규정에서 정하지 않는 사항에 대해서는 고용노동부의 「사업장 위험성평가에 관한 지침」 및 「새로운 위험성평가 안내서」를 적용한다.`,
  article_2: `이 실시규정은 공단 임대주택에서 수행하는 모든 작업, 설비 및 공정, 업무에 대한 활동, 또한 외부환경에서 발생할 수 있는 유해·위험요인 위험성평가에 대한 범위, 절차, 책임과 권한에 대하여 적용한다.`,
  article_3: `위험성평가 실시 담당 조직의 구성은 아래표와 같이 하되, 공단 임대주택의 특성을 고려하여 구성하며, 담당자는 위·수탁용역업체 내부지침에 따른다.`,
  article_4: `위험성평가 실시 담당 조직 구성원별 역할과 책임은 다음과 같이 한다.`,
  article_5: `근로자(협력업체, 방문객 포함)에게 안전·보건상 영향을 주는 다음 사항 등을 평가대상으로 한다.
  1. 회사 내부 또는 외부에서 작업장에 제공되는 모든 기계·기구 및 설비
  2. 작업장에서 보유 또는 취급하고 있는 모든 유해물질
  3. 일상적인 작업(협력업체 포함) 및 비일상적인 작업(수리 또는 정비 등)
  4. 발생할 수 있는 비상조치 작업
  5. 사업장 내에서 발생이 확인된 아차사고`,
  article_6: `공단 임대주택 위험성평가 실시 시기는 다음과 같다.
  1. 최초평가 : 처음으로 실시하는 위험성평가를 말하며 전체 사업장의 모든 작업을 대상으로 ○○○○년 ○○월 ○○일까지 실시한다.
  2. 정기평가 : 최초평가를 실시한 날로부터 1년이 되는 날 이전까지 실시하고, 이후 매 1년마다 매년 실시한다.
    - 정기평가는 최초평가 및 그간의 수시평가 결과를 전반적으로 재검토하는 방법으로 실시하며, 기존 위험성 감소대책이 잘 유지되고 있는지 점검한다.
  3. 수시평가 : 해당 작업 개시(재개) 전에 실시한다.
    가. 중대산업사고 또는 산업재해가 발생한 때
    나. 작업장 변경 시(작업자, 설비, 작업방법 및 절차 등의 변경)
    다. 건설물, 기계·기구, 설비 등의 정비 또는 보수 작업 시`,
  article_7: `  1. 사업주가 위험성평가 실시를 총괄 관리한다.
  2. 위험성평가 전담직원을 지정하는 등 위험성평가를 위한 체제를 구축한다.
  3. 작업내용 등을 상세하게 파악하고 있는 관리감독자가 유해·위험요인을 파악하고 그 결과에 따라 개선조치를 실행한다.
  4. 위험성평가의 전체 과정에 근로자의 참여를 보장한다.
  5. 위험성평가의 결과는 게시 등을 통해 전체 근로자에게 알리고, 근로자 안전보건교육내용 및 작업 전 안전점검회의 내용에 포함한다.
  6. 필요 시 전담직원들에게 위험성평가 전문교육을 실시한다.`,
  article_8: `위험성평가의 추진 절차는 다음과 같다.
  1. 1단계 : 사전준비
    - 정확한 작업(공정)의 분류가 중요하며, 작업(공정) 흐름도에 따라 평가대상 작업(공정)들을 정의한다.
    - 위험성평가 담당자는 위험성평가에 필요한 안전보건 정보를 수집하여 정리한다.
    - 사업주, 위험성평가 담당자, 근로자가 모두 함께 위험성의 수준 및 그 판단기준을 설정한다.
  2. 2단계 : 유해·위험요인 파악
    - 가장 중요한 단계로, 작업공정(단위작업)별 유해·위험요인을 상세히 파악한다. 베테랑 근로자들을 참여시킨다.
  3. 3단계 : 위험성 결정
    - 파악된 유해위험요인과 현재의 조치 사항이 산업안전보건법에서 정한 기준 이상을 만족하도록 합리적으로 실행 가능한 조치가 모두 이루어졌는지 확인하여, 허용할 수 있는 위험성인지 허용할 수 없는 위험성인지를 결정한다.
  4. 4단계 : 위험성 감소대책 수립 및 실행
    - 위험성의 크기가 허용 불가능한 것으로 결정된 위험성에 대해서는 위험성 감소대책을 수립·실행하여 허용 가능한 위험성의 범위로 들어오도록 하고, 필요시 추가 감소대책을 수립·실행한다.
  5. 5단계 : 기록
    - 위험성평가를 수행한 결과를 관계자들에게 교육하거나 공유하기 위하여 기록한다.`,
  article_9: `공단 임대주택의 위험성평가 방법은 3단계 판단법을 사용한다.`,
  article_10: `위험성 수준과 그 판단 기준은 다음과 같다.`,
  article_11: `  1. 근로자들이 많이 다니고 잘 볼 수 있는 곳에, 잘 볼 수 있는 방법(가독성 높은 큰 글씨, 전광판 등)으로 위험성평가 결과 게시
  2. 안전보건교육 내용에 교육 대상 근로자의 작업(공정)에 대한 위험성평가 결과 내용 포함
  3. 작업 전 안전점검회의 시 위험성평가 내용 포함`,
  article_12: `공단 임대주택의 위험성평가 대상 작업(공정)의 모든 과정에 근로자 1명 이상 참여하도록 한다.`,
  article_13: `① 산업안전보건법 기타 요구사항에 적합한 상태인지를 확인하고 미달하고 있는 경우에는 사업주에게 보고한 후 위험성 수준이 높은 것부터 우선적으로 위험성 감소대책을 반영하여 개선한다.

[감소대책 수립 시 주의사항]
  1. 새로운 위험성의 유무를 확인하고 위험성 감소조치 전의 위험성보다 커지지 않는가를 확인
  2. 작업자의 판단, 행동에만 의존하는 대책, 위험성 감소의 근거가 불분명한 조치 등에 의해 위험성을 낮게 판단하고 있지 않은가를 확인
  3. 작업성·생산성에 지장이 없는지, 품질에 문제가 없는지 등을 의견청취에 의해 작업자에게 확인
  4. 각 단계에서는 현장에서의 노하우, 아이디어를 적극적으로 활용

② 사업주는 감소조치 결과 당해 위험성 감소조치가 충분하지 않다고 판단하는 경우 담당자에게 조치의 재검토를 지시할 수 있다.
③ 사업주는 감소대책 수립·실행 시 소요되는 예산을 지원하여야 한다.
④ 위험성평가 참여자는 위험성 결정 시 최악의 상황에서 가장 큰 부상 또는 질병을 기준으로 판단한다.`,
  article_14: `① 위험성평가의 이행에 대한 점검은 위험성평가 담당자 및 이행 책임자가 확인하여야 한다.
② 위험성평가의 이행 점검 결과, 미이행 사항이나 추가적 유해·위험요인이 발견된 경우 시정조치를 하여야 하며, 시정조치 내용은 차기(다음번) 위험성평가에 반영되도록 하여야 한다.`,
  article_15: `① 위험성평가 기록은 사업주에게 승인을 받는다.
② 위험성평가 기록은 공단 안전보건 기록 관련 규정에 준하여 보관하되 5년 이상 보관한다.
③ 위험성평가 기록물은 연 1회 정도 정기적으로 검토하고, 수정·보완이 필요한 경우에는 근로자의 의견을 반영한 후에 변경 여부를 결정하며, 모든 근로자가 알 수 있도록 배부 또는 게시한다.`,
  article_16: `① 위험성평가 기록물은 연 1회 정기적으로 검토 및 재평가하고, 개선 방안이 적절치 않아 수정·보완이 필요한 경우에는 근로자의 의견을 수렴한 후에 변경 여부를 결정하며, 이를 당해연도 정기위험성평가 내용에 반영한다. 이 내용을 모든 근로자가 알 수 있도록 배부 또는 게시한다.
② 전년도 위험성평가 미이행 사항 또는 시행예정 사항을 포함하여 재평가를 실시하여야 한다.`,
  article_17: ``,
};

const ARTICLE_TITLES: Record<string, string> = {
  article_1: "목적",
  article_2: "적용",
  article_3: "조직의 구성",
  article_4: "역할과 책임",
  article_5: "평가대상",
  article_6: "실시시기",
  article_7: "실시원칙",
  article_8: "추진절차",
  article_9: "위험성평가의 방법",
  article_10: "위험성의 수준 판단 기준",
  article_11: "근로자에 대한 공유",
  article_12: "근로자의 참여 방법",
  article_13: "유의사항",
  article_14: "점검 및 개선활동",
  article_15: "기록",
  article_16: "재평가",
  article_17: "추진절차 일정",
};

function useRegulationOverrides() {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
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

  const save = async (key: string, value: string) => {
    if (!orgId) return;
    const next = { ...overrides, [key]: value };
    const { error } = await supabase
      .from("regulation_content")
      .upsert({ organization_id: orgId, overrides: next, updated_at: new Date().toISOString() });
    if (error) { toast.error("저장 실패: " + error.message); return; }
    setOverrides(next);
    toast.success("저장되었습니다");
  };

  const reset = async (key: string) => {
    if (!orgId) return;
    const next = { ...overrides };
    delete next[key];
    const { error } = await supabase
      .from("regulation_content")
      .upsert({ organization_id: orgId, overrides: next, updated_at: new Date().toISOString() });
    if (error) { toast.error("초기화 실패: " + error.message); return; }
    setOverrides(next);
    toast.success("기본값으로 초기화되었습니다");
  };

  const get = (key: string) => overrides[key] ?? DEFAULTS[key] ?? "";

  return { get, save, reset, isAdmin, loading };
}

function EditableBlock({
  k,
  value,
  isAdmin,
  onSave,
  onReset,
  hasOverride,
  singleLine,
  className,
}: {
  k: string;
  value: string;
  isAdmin: boolean;
  onSave: (v: string) => void;
  onReset: () => void;
  hasOverride: boolean;
  singleLine?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  if (editing) {
    return (
      <div className="space-y-2 print:hidden">
        {singleLine ? (
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} />
        ) : (
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.max(4, draft.split("\n").length + 1)}
            className="font-sans text-sm leading-7"
          />
        )}
        <div className="flex gap-2">
          <Button size="sm" onClick={() => { onSave(draft); setEditing(false); }}>
            <Check className="w-4 h-4 mr-1" />저장
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setDraft(value); setEditing(false); }}>
            <X className="w-4 h-4 mr-1" />취소
          </Button>
          {hasOverride && (
            <Button size="sm" variant="ghost" onClick={() => { onReset(); setEditing(false); }}>
              <RotateCcw className="w-4 h-4 mr-1" />기본값
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={"group relative " + (className ?? "")}>
      <div className="whitespace-pre-wrap">{value}</div>
      {isAdmin && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="print:hidden absolute -top-1 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
          title={`편집 (${k})`}
        >
          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

function Article({
  k,
  no,
  title,
  reg,
  children,
}: {
  k: string;
  no: string;
  title: string;
  reg: ReturnType<typeof useRegulationOverrides>;
  children?: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="font-bold text-base">
        제{no}조({title})
      </h3>
      <div className="text-sm leading-7 text-foreground/90">
        <EditableBlock
          k={k}
          value={reg.get(k)}
          isAdmin={reg.isAdmin}
          onSave={(v) => reg.save(k, v)}
          onReset={() => reg.reset(k)}
          hasOverride={reg.get(k) !== DEFAULTS[k]}
        />
        {children}
      </div>
    </section>
  );
}

function RegulationPage() {
  const reg = useRegulationOverrides();

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold">위험성평가 실시규정</h1>
          <p className="text-sm text-muted-foreground">
            {reg.isAdmin ? "관리자: 각 조항 위 연필 아이콘을 눌러 내용을 수정할 수 있습니다." : "공무원연금공단 임대주택 위험성평가 실시규정 (참고 문서)"}
          </p>
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-2" /> 인쇄
        </Button>
      </div>

      <Card className="print:shadow-none print:border-0">
        <CardHeader className="text-center border-b">
          <CardTitle className="text-3xl">위험성평가 실시규정</CardTitle>
          <div className="text-sm text-muted-foreground mt-2 flex flex-wrap gap-x-6 gap-y-2 justify-center">
            <div>
              ▢ 사업장명:{" "}
              <span className="inline-block min-w-[200px] text-left align-top">
                <EditableBlock
                  k="header_site"
                  value={reg.get("header_site")}
                  isAdmin={reg.isAdmin}
                  onSave={(v) => reg.save("header_site", v)}
                  onReset={() => reg.reset("header_site")}
                  hasOverride={reg.get("header_site") !== DEFAULTS.header_site}
                  singleLine
                />
              </span>
            </div>
            <div>
              ▢ 작성일자:{" "}
              <span className="inline-block min-w-[180px] text-left align-top">
                <EditableBlock
                  k="header_date"
                  value={reg.get("header_date")}
                  isAdmin={reg.isAdmin}
                  onSave={(v) => reg.save("header_date", v)}
                  onReset={() => reg.reset("header_date")}
                  hasOverride={reg.get("header_date") !== DEFAULTS.header_date}
                  singleLine
                />
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 md:p-10 space-y-8">
          <section className="bg-muted/30 rounded-md p-5 space-y-3">
            <h2 className="font-bold text-lg">안전보건경영방침 및 추진목표</h2>
            <div className="text-sm leading-7">
              <EditableBlock
                k="policy_intro"
                value={reg.get("policy_intro")}
                isAdmin={reg.isAdmin}
                onSave={(v) => reg.save("policy_intro", v)}
                onReset={() => reg.reset("policy_intro")}
                hasOverride={reg.get("policy_intro") !== DEFAULTS.policy_intro}
              />
            </div>
            <div className="text-sm leading-7">
              <div className="text-xs text-muted-foreground mb-1 print:hidden">(줄바꿈으로 항목 구분 — 자동으로 • 목록으로 표시)</div>
              {reg.isAdmin ? (
                <EditableBlock
                  k="policy_bullets"
                  value={reg.get("policy_bullets")}
                  isAdmin={reg.isAdmin}
                  onSave={(v) => reg.save("policy_bullets", v)}
                  onReset={() => reg.reset("policy_bullets")}
                  hasOverride={reg.get("policy_bullets") !== DEFAULTS.policy_bullets}
                />
              ) : (
                <ul className="list-disc pl-5 space-y-1">
                  {reg.get("policy_bullets").split("\n").filter(Boolean).map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              )}
              <div className="hidden print:block">
                <ul className="list-disc pl-5 space-y-1">
                  {reg.get("policy_bullets").split("\n").filter(Boolean).map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="text-sm font-semibold pt-2">
              <EditableBlock
                k="policy_goal"
                value={reg.get("policy_goal")}
                isAdmin={reg.isAdmin}
                onSave={(v) => reg.save("policy_goal", v)}
                onReset={() => reg.reset("policy_goal")}
                hasOverride={reg.get("policy_goal") !== DEFAULTS.policy_goal}
              />
            </div>
          </section>

          <Article k="article_1" no="1" title={ARTICLE_TITLES.article_1} reg={reg} />
          <Article k="article_2" no="2" title={ARTICLE_TITLES.article_2} reg={reg} />

          <Article k="article_3" no="3" title={ARTICLE_TITLES.article_3} reg={reg}>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs border">
                <tbody>
                  <tr className="bg-muted"><td className="border p-2 font-semibold" colSpan={4}>총괄 책임자 — 관리용역 위탁사 대표</td></tr>
                  <tr><td className="border p-2 font-semibold" colSpan={4}>안전보건관리 책임자 — 관리사무소장 &nbsp;/&nbsp; 위험성평가 담당자 — 안전관리자</td></tr>
                  <tr>
                    <td className="border p-2 text-center">관리팀장 (관리자)</td>
                    <td className="border p-2 text-center">시설팀장 (관리자)</td>
                    <td className="border p-2 text-center">미화반장 (관리자)</td>
                    <td className="border p-2 text-center">경비반장 (관리자)</td>
                  </tr>
                  <tr>
                    <td className="border p-2 text-center">관리직원</td>
                    <td className="border p-2 text-center">기술요원</td>
                    <td className="border p-2 text-center">미화원</td>
                    <td className="border p-2 text-center">경비원</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Article>

          <Article k="article_4" no="4" title={ARTICLE_TITLES.article_4} reg={reg}>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs border">
                <thead className="bg-muted">
                  <tr>
                    <th className="border p-2 w-1/3 text-left">조직</th>
                    <th className="border p-2 text-left">역할과 책임(권한)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border p-2 align-top">안전보건관리 책임자 (관리사무소장)</td>
                    <td className="border p-2 whitespace-pre-wrap">{`《위험성평가의 총괄 관리》
· 위험성평가 총괄 관리 및 의지 표명
  - 안전보건방침과 추진목표를 문서화하고 게시
  - 위험성평가 실시 지원
  - 위험성평가 실행을 위한 조직구성과 역할 부여
  - 아차사고 사례 등 유해·위험요인 발굴 지원
· 위험성평가 사업주 교육 이수
· 예산지원 및 산업재해예방 노력
· 작업 전 안전점검 활동 독려`}</td>
                  </tr>
                  <tr>
                    <td className="border p-2 align-top">관리자 및 근로자 (작업자)</td>
                    <td className="border p-2 whitespace-pre-wrap">{`《위험성평가 참여》
· 담당업무와 관련된 위험성평가 전체 과정의 활동에 참여
· 담당업무에 대한 안전보건수칙 및 위험성평가결과 감소대책 확인
· 비상상황에 대한 대비 및 대응방법 숙지
· 출입허가절차 및 위험한 장소 인지
· 아차사고 사례의 적극적 제보`}</td>
                  </tr>
                  <tr>
                    <td className="border p-2 align-top">위험성평가 담당자 (관리감독자 및 근로자와 겸직가능)</td>
                    <td className="border p-2 whitespace-pre-wrap">{`《위험성평가의 실시 및 실행 관리·지원》
· 위험성평가 실시규정 수립 및 실행
· 유해·위험요인을 빠짐없이 파악하고 위험성 결정
· 위험성 감소대책의 수립 및 실행
· 위험성평가 실시 시기, 절차와 내용 숙지
· 책임과 권한 인지 및 이행
· 안전보건정보 수집 및 재해조사 관련 자료 등을 기록
· 근로자에게 위험성평가 교육을 실시하고 기록유지
· 위험성평가 검토 및 결과에 대한 기록, 보관`}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Article>

          <Article k="article_5" no="5" title={ARTICLE_TITLES.article_5} reg={reg} />
          <Article k="article_6" no="6" title={ARTICLE_TITLES.article_6} reg={reg} />
          <Article k="article_7" no="7" title={ARTICLE_TITLES.article_7} reg={reg} />
          <Article k="article_8" no="8" title={ARTICLE_TITLES.article_8} reg={reg} />
          <Article k="article_9" no="9" title={ARTICLE_TITLES.article_9} reg={reg} />

          <Article k="article_10" no="10" title={ARTICLE_TITLES.article_10} reg={reg}>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs border">
                <thead className="bg-muted">
                  <tr>
                    <th className="border p-2">위험성 크기</th>
                    <th className="border p-2">내용</th>
                    <th className="border p-2">허용 가능 여부</th>
                    <th className="border p-2">개선시기</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border p-2 text-center font-semibold">상 (매우 높음)</td>
                    <td className="border p-2 whitespace-pre-wrap">{`· 사망 또는 장애가 남을 수 있는 위험
· 필요한 안전조치가 되어 있지 않고, 안전수칙·안전표시·표지 부착 부적정
· 산업재해 사례가 있는 경우`}</td>
                    <td className="border p-2 text-center">허용 불가능</td>
                    <td className="border p-2 text-center">즉시 개선</td>
                  </tr>
                  <tr>
                    <td className="border p-2 text-center font-semibold">중 (보통)</td>
                    <td className="border p-2 whitespace-pre-wrap">{`· 3일 이상의 휴업이 필요한 위험
· 필요한 안전조치가 되어있으나, 안전수칙·안전표시·표지 부착 부적정
· 아차사고 사례가 있는 경우`}</td>
                    <td className="border p-2 text-center">-</td>
                    <td className="border p-2 text-center">계획적으로 개선</td>
                  </tr>
                  <tr>
                    <td className="border p-2 text-center font-semibold">하 (매우 낮음)</td>
                    <td className="border p-2 whitespace-pre-wrap">{`· 법령에 따른 안전조치, 방호덮개 등 안전장치, 안전수칙·안전표시·표지 부착이 적정
· 휴업을 요하지 않는 경미한 부상 또는 질병이 예상되는 경우`}</td>
                    <td className="border p-2 text-center">허용 가능</td>
                    <td className="border p-2 text-center">필요에 따라 개선</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Article>

          <Article k="article_11" no="11" title={ARTICLE_TITLES.article_11} reg={reg} />
          <Article k="article_12" no="12" title={ARTICLE_TITLES.article_12} reg={reg} />
          <Article k="article_13" no="13" title={ARTICLE_TITLES.article_13} reg={reg} />
          <Article k="article_14" no="14" title={ARTICLE_TITLES.article_14} reg={reg} />
          <Article k="article_15" no="15" title={ARTICLE_TITLES.article_15} reg={reg} />
          <Article k="article_16" no="16" title={ARTICLE_TITLES.article_16} reg={reg} />

          <Article k="article_17" no="17" title={ARTICLE_TITLES.article_17} reg={reg}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border">
                <thead className="bg-muted">
                  <tr>
                    <th className="border p-2">1단계</th>
                    <th className="border p-2">2단계</th>
                    <th className="border p-2">3단계</th>
                    <th className="border p-2">4단계</th>
                    <th className="border p-2">5단계</th>
                    <th className="border p-2">6단계</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-center">
                    <td className="border p-2">사전준비</td>
                    <td className="border p-2">유해·위험요인 파악</td>
                    <td className="border p-2">위험성 추정·결정</td>
                    <td className="border p-2">감소대책 수립<br/>(평가표 제출)</td>
                    <td className="border p-2">위험성 감소대책 실행</td>
                    <td className="border p-2">기록 및 평가결과 주지</td>
                  </tr>
                  <tr className="text-center text-muted-foreground">
                    <td className="border p-2">~5월</td>
                    <td className="border p-2">~8월</td>
                    <td className="border p-2">8월</td>
                    <td className="border p-2">9월</td>
                    <td className="border p-2">~11월</td>
                    <td className="border p-2">~12월</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Article>

          <section className="space-y-2 pt-4 border-t">
            <h3 className="font-bold text-base">[붙임] 유형·그룹별 유해·위험요인 예시</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border">
                <thead className="bg-muted">
                  <tr>
                    <th className="border p-2 w-16">구분</th>
                    <th className="border p-2 w-32">유형/그룹</th>
                    <th className="border p-2">근원 (Origin)</th>
                    <th className="border p-2">잠재적 결과 (Potential consequences)</th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  {[
                    ["1","기계","가속·감속, 뾰족한 부품, 움직이는 요소, 낙하물, 중력, 고소, 고압, 회전요소, 미끄러운 표면, 날카로운 가장자리, 저장에너지 등","충돌, 절단, 끌려 들어감, 말림, 마찰, 충격, 미끄러짐·추락, 찔림·관통, 질식"],
                    ["2","전기","아크, 정전기, 고전압 작동 부품, 과부하, 단락 회로, 열 복사","화상, 감전, 화재, 전격"],
                    ["3","열","폭발, 화염, 고온/저온 물체, 복사열","화상, 탈수, 동상, 데임"],
                    ["4","소음","공동현상, 배기시스템, 고속 가스누출, 스탬핑·절단 공정, 마모된 부품","청력 손실, 스트레스, 이명, 피로, 균형감각 상실"],
                    ["5","진동","정렬되지 않은 움직이는 부품, 이동 장비, 진동 장비","요통, 신경장애, 관절장애, 척추 손상, 혈관 질환"],
                    ["6","방사선","이온화 방사선, 저주파 전자기, 복사선(적외선/가시광선/자외선), 무선주파수","화상, 눈·피부 손상, 생식능력 영향, 돌연변이, 두통·불면"],
                    ["7","재료/물질","에어로졸, 생물학적 시료, 가연성/인화성 물질, 먼지, 폭약, 흄, 가스, 미스트, 산화제","호흡곤란·질식, 암, 폭발, 화재, 감염, 중독, 과민성"],
                    ["8","인간공학","제어장치 설계/위치, 힘든 작업, 눈부심, 자세, 반복작업, 가시성","불쾌감, 피로, 근골격계 질환, 스트레스, 휴먼에러"],
                    ["9","기기 사용환경","먼지·안개, 전자기 방해, 번개, 습도, 오염, 눈, 물, 바람, 산소부족","화상, 미끄러짐·넘어짐, 질식, 경미한 질병"],
                    ["10","복합요소","예: 반복작업 + 힘든 작업 + 고온환경","탈수, 기절, 열사병"],
                  ].map(([n,t,o,c])=>(
                    <tr key={n}>
                      <td className="border p-2 text-center">{n}</td>
                      <td className="border p-2 font-semibold">{t}</td>
                      <td className="border p-2">{o}</td>
                      <td className="border p-2">{c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
