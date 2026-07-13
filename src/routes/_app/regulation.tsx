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
import { toast } from "sonner";

export const Route = createFileRoute("/_app/regulation")({
  component: RegulationPage,
});

// ============ 기본 텍스트 (조직 override가 없으면 사용) ============
const DEFAULTS: Record<string, string> = {
  doc_title: "위험성평가 실시규정",
  header_site: "○○○○상록아파트 관리사무소",
  header_date: "○○○○년 ○○월 ○○일",
  policy_heading: "안전보건경영방침 및 추진목표",
  policy_intro:
    "공무원연금공단은 국민의 생명과 안전을 경영의 최우선 가치로 두며 이를 위해 최선의 노력을 다한다.",
  policy_bullets: `근로자의 참여와 협의를 바탕으로 안전보건경영 시스템을 구축·운영한다.
잠재적 유해·위험요인을 선제적으로 발굴하고 지속적으로 개선한다.
관계 수급업체를 비롯한 이해관계자의 안전협력체계를 유지하고 성숙한 안전문화를 조성한다.
안전보건관련 법령 및 규정을 철저히 준수한다.`,
  policy_goal: "위험성평가 중심의 「자기규율 예방체계」 확립 (중대재해 Zero, 산업재해 Zero)",

  article_1_title: "목적",
  article_1: `이 실시규정은 공무원연금공단 ○○○○상록아파트(이하 "공단 임대주택"이라 한다) 전체의 유해·위험요인을 파악하고, 그 유해·위험요인별 위험성의 수준을 결정한 후 위험성을 감소시키기 위해 필요한 조치를 마련하여 실시함을 목적으로 한다. 이 규정에서 정하지 않는 사항에 대해서는 고용노동부의 「사업장 위험성평가에 관한 지침」 및 「새로운 위험성평가 안내서」를 적용한다.`,

  article_2_title: "적용",
  article_2: `이 실시규정은 공단 임대주택에서 수행하는 모든 작업, 설비 및 공정, 업무에 대한 활동, 또한 외부환경에서 발생할 수 있는 유해·위험요인 위험성평가에 대한 범위, 절차, 책임과 권한에 대하여 적용한다.`,

  article_3_title: "조직의 구성",
  article_3: `위험성평가 실시 담당 조직의 구성은 아래 조직도와 같이 하되, 공단 임대주택의 특성을 고려하여 구성하며, 담당자는 위·수탁용역업체 내부지침에 따른다.`,
  // 조직도 (역할 라벨 / 값)
  org_lead_role: "총괄 책임자",
  org_lead_name: "관리용역 위탁사 대표",
  org_safety_role: "안전보건관리 책임자",
  org_safety_name: "관리사무소장",
  org_assessor_role: "위험성평가 담당자",
  org_assessor_name: "안전관리자",
  org_mgr1_role: "관리자", org_mgr1_name: "관리팀장",
  org_mgr2_role: "관리자", org_mgr2_name: "시설팀장",
  org_mgr3_role: "관리자", org_mgr3_name: "미화반장",
  org_mgr4_role: "관리자", org_mgr4_name: "경비반장",
  org_worker1_role: "근로자", org_worker1_name: "관리직원",
  org_worker2_role: "근로자", org_worker2_name: "기술요원",
  org_worker3_role: "근로자", org_worker3_name: "미화원",
  org_worker4_role: "근로자", org_worker4_name: "경비원",

  article_4_title: "역할과 책임",
  article_4: `위험성평가 실시 담당 조직 구성원별 역할과 책임은 다음과 같이 한다.`,
  article_4_table: `■ 안전보건관리 책임자 (관리사무소장)
《위험성평가의 총괄 관리》
· 위험성평가 총괄 관리 및 의지 표명
  - 안전보건방침과 추진목표를 문서화하고 게시
  - 위험성평가 실시 지원
  - 위험성평가 실행을 위한 조직구성과 역할 부여
  - 아차사고 사례 등 유해·위험요인 발굴 지원
· 위험성평가 사업주 교육 이수
· 예산지원 및 산업재해예방 노력
· 작업 전 안전점검 활동 독려

■ 관리자 및 근로자 (작업자)
《위험성평가 참여》
· 담당업무와 관련된 위험성평가 전체 과정의 활동에 참여
· 담당업무에 대한 안전보건수칙 및 위험성평가결과 감소대책 확인
· 비상상황에 대한 대비 및 대응방법 숙지
· 출입허가절차 및 위험한 장소 인지
· 아차사고 사례의 적극적 제보

■ 위험성평가 담당자 (관리감독자 및 근로자와 겸직가능)
《위험성평가의 실시 및 실행 관리·지원》
· 위험성평가 실시규정 수립 및 실행
· 유해·위험요인을 빠짐없이 파악하고 위험성 결정
· 위험성 감소대책의 수립 및 실행
· 위험성평가 실시 시기, 절차와 내용 숙지
· 책임과 권한 인지 및 이행
· 안전보건정보 수집 및 재해조사 관련 자료 등을 기록
· 근로자에게 위험성평가 교육을 실시하고 기록유지
· 위험성평가 검토 및 결과에 대한 기록, 보관`,

  article_5_title: "평가대상",
  article_5: `근로자(협력업체, 방문객 포함)에게 안전·보건상 영향을 주는 다음 사항 등을 평가대상으로 한다.
  1. 회사 내부 또는 외부에서 작업장에 제공되는 모든 기계·기구 및 설비
  2. 작업장에서 보유 또는 취급하고 있는 모든 유해물질
  3. 일상적인 작업(협력업체 포함) 및 비일상적인 작업(수리 또는 정비 등)
  4. 발생할 수 있는 비상조치 작업
  5. 사업장 내에서 발생이 확인된 아차사고`,

  article_6_title: "실시시기",
  article_6: `공단 임대주택 위험성평가 실시 시기는 다음과 같다.
  1. 최초평가 : 처음으로 실시하는 위험성평가를 말하며 전체 사업장의 모든 작업을 대상으로 ○○○○년 ○○월 ○○일까지 실시한다.
  2. 정기평가 : 최초평가를 실시한 날로부터 1년이 되는 날 이전까지 실시하고, 이후 매 1년마다 매년 실시한다.
    - 정기평가는 최초평가 및 그간의 수시평가 결과를 전반적으로 재검토하는 방법으로 실시하며, 기존 위험성 감소대책이 잘 유지되고 있는지 점검한다.
  3. 수시평가 : 해당 작업 개시(재개) 전에 실시한다.
    가. 중대산업사고 또는 산업재해가 발생한 때
    나. 작업장 변경 시(작업자, 설비, 작업방법 및 절차 등의 변경)
    다. 건설물, 기계·기구, 설비 등의 정비 또는 보수 작업 시`,

  article_7_title: "실시원칙",
  article_7: `  1. 사업주가 위험성평가 실시를 총괄 관리한다.
  2. 위험성평가 전담직원을 지정하는 등 위험성평가를 위한 체제를 구축한다.
  3. 작업내용 등을 상세하게 파악하고 있는 관리감독자가 유해·위험요인을 파악하고 그 결과에 따라 개선조치를 실행한다.
  4. 위험성평가의 전체 과정에 근로자의 참여를 보장한다.
  5. 위험성평가의 결과는 게시 등을 통해 전체 근로자에게 알리고, 근로자 안전보건교육내용 및 작업 전 안전점검회의 내용에 포함한다.
  6. 필요 시 전담직원들에게 위험성평가 전문교육을 실시한다.`,

  article_8_title: "추진절차",
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

  article_9_title: "위험성평가의 방법",
  article_9: `공단 임대주택의 위험성평가 방법은 3단계 판단법을 사용한다.`,

  article_10_title: "위험성의 수준 판단 기준",
  article_10: `위험성 수준과 그 판단 기준은 다음과 같다.`,
  article_10_table: `[상 (매우 높음)]  허용 불가능 / 즉시 개선
· 사망 또는 장애가 남을 수 있는 위험
· 필요한 안전조치가 되어 있지 않고, 안전수칙·안전표시·표지 부착 부적정
· 산업재해 사례가 있는 경우

[중 (보통)]  계획적으로 개선
· 3일 이상의 휴업이 필요한 위험
· 필요한 안전조치가 되어있으나, 안전수칙·안전표시·표지 부착 부적정
· 아차사고 사례가 있는 경우

[하 (매우 낮음)]  허용 가능 / 필요에 따라 개선
· 법령에 따른 안전조치, 방호덮개 등 안전장치, 안전수칙·안전표시·표지 부착이 적정
· 휴업을 요하지 않는 경미한 부상 또는 질병이 예상되는 경우`,

  article_11_title: "근로자에 대한 공유",
  article_11: `  1. 근로자들이 많이 다니고 잘 볼 수 있는 곳에, 잘 볼 수 있는 방법(가독성 높은 큰 글씨, 전광판 등)으로 위험성평가 결과 게시
  2. 안전보건교육 내용에 교육 대상 근로자의 작업(공정)에 대한 위험성평가 결과 내용 포함
  3. 작업 전 안전점검회의 시 위험성평가 내용 포함`,

  article_12_title: "근로자의 참여 방법",
  article_12: `공단 임대주택의 위험성평가 대상 작업(공정)의 모든 과정에 근로자 1명 이상 참여하도록 한다.`,

  article_13_title: "유의사항",
  article_13: `① 산업안전보건법 기타 요구사항에 적합한 상태인지를 확인하고 미달하고 있는 경우에는 사업주에게 보고한 후 위험성 수준이 높은 것부터 우선적으로 위험성 감소대책을 반영하여 개선한다.

[감소대책 수립 시 주의사항]
  1. 새로운 위험성의 유무를 확인하고 위험성 감소조치 전의 위험성보다 커지지 않는가를 확인
  2. 작업자의 판단, 행동에만 의존하는 대책, 위험성 감소의 근거가 불분명한 조치 등에 의해 위험성을 낮게 판단하고 있지 않은가를 확인
  3. 작업성·생산성에 지장이 없는지, 품질에 문제가 없는지 등을 의견청취에 의해 작업자에게 확인
  4. 각 단계에서는 현장에서의 노하우, 아이디어를 적극적으로 활용

② 사업주는 감소조치 결과 당해 위험성 감소조치가 충분하지 않다고 판단하는 경우 담당자에게 조치의 재검토를 지시할 수 있다.
③ 사업주는 감소대책 수립·실행 시 소요되는 예산을 지원하여야 한다.
④ 위험성평가 참여자는 위험성 결정 시 최악의 상황에서 가장 큰 부상 또는 질병을 기준으로 판단한다.`,

  article_14_title: "점검 및 개선활동",
  article_14: `① 위험성평가의 이행에 대한 점검은 위험성평가 담당자 및 이행 책임자가 확인하여야 한다.
② 위험성평가의 이행 점검 결과, 미이행 사항이나 추가적 유해·위험요인이 발견된 경우 시정조치를 하여야 하며, 시정조치 내용은 차기(다음번) 위험성평가에 반영되도록 하여야 한다.`,

  article_15_title: "기록",
  article_15: `① 위험성평가 기록은 사업주에게 승인을 받는다.
② 위험성평가 기록은 공단 안전보건 기록 관련 규정에 준하여 보관하되 5년 이상 보관한다.
③ 위험성평가 기록물은 연 1회 정도 정기적으로 검토하고, 수정·보완이 필요한 경우에는 근로자의 의견을 반영한 후에 변경 여부를 결정하며, 모든 근로자가 알 수 있도록 배부 또는 게시한다.`,

  article_16_title: "재평가",
  article_16: `① 위험성평가 기록물은 연 1회 정기적으로 검토 및 재평가하고, 개선 방안이 적절치 않아 수정·보완이 필요한 경우에는 근로자의 의견을 수렴한 후에 변경 여부를 결정하며, 이를 당해연도 정기위험성평가 내용에 반영한다. 이 내용을 모든 근로자가 알 수 있도록 배부 또는 게시한다.
② 전년도 위험성평가 미이행 사항 또는 시행예정 사항을 포함하여 재평가를 실시하여야 한다.`,

  article_17_title: "추진절차 일정",
  article_17: ``,
  article_17_table: `1단계: 사전준비 (~5월)
2단계: 유해·위험요인 파악 (~8월)
3단계: 위험성 추정·결정 (8월)
4단계: 감소대책 수립·평가표 제출 (9월)
5단계: 위험성 감소대책 실행 (~11월)
6단계: 기록 및 평가결과 주지 (~12월)`,

  appendix_title: "[붙임] 유형·그룹별 유해·위험요인 예시",
  appendix_table: `1. 기계 / 근원: 가속·감속, 뾰족한 부품, 움직이는 요소, 낙하물, 중력, 고소, 고압, 회전요소, 미끄러운 표면, 날카로운 가장자리, 저장에너지 등 / 결과: 충돌, 절단, 끌려 들어감, 말림, 마찰, 충격, 미끄러짐·추락, 찔림·관통, 질식
2. 전기 / 근원: 아크, 정전기, 고전압 작동 부품, 과부하, 단락 회로, 열 복사 / 결과: 화상, 감전, 화재, 전격
3. 열 / 근원: 폭발, 화염, 고온/저온 물체, 복사열 / 결과: 화상, 탈수, 동상, 데임
4. 소음 / 근원: 공동현상, 배기시스템, 고속 가스누출, 스탬핑·절단 공정, 마모된 부품 / 결과: 청력 손실, 스트레스, 이명, 피로, 균형감각 상실
5. 진동 / 근원: 정렬되지 않은 움직이는 부품, 이동 장비, 진동 장비 / 결과: 요통, 신경장애, 관절장애, 척추 손상, 혈관 질환
6. 방사선 / 근원: 이온화 방사선, 저주파 전자기, 복사선(적외선/가시광선/자외선), 무선주파수 / 결과: 화상, 눈·피부 손상, 생식능력 영향, 돌연변이, 두통·불면
7. 재료/물질 / 근원: 에어로졸, 생물학적 시료, 가연성/인화성 물질, 먼지, 폭약, 흄, 가스, 미스트, 산화제 / 결과: 호흡곤란·질식, 암, 폭발, 화재, 감염, 중독, 과민성
8. 인간공학 / 근원: 제어장치 설계/위치, 힘든 작업, 눈부심, 자세, 반복작업, 가시성 / 결과: 불쾌감, 피로, 근골격계 질환, 스트레스, 휴먼에러
9. 기기 사용환경 / 근원: 먼지·안개, 전자기 방해, 번개, 습도, 오염, 눈, 물, 바람, 산소부족 / 결과: 화상, 미끄러짐·넘어짐, 질식, 경미한 질병
10. 복합요소 / 근원: 반복작업 + 힘든 작업 + 고온환경 / 결과: 탈수, 기절, 열사병`,
};

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

  const saveAll = async (next: Record<string, string>) => {
    if (!orgId) return false;
    // 기본값과 같으면 제거
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(next)) {
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

  const get = (k: string) => overrides[k] ?? DEFAULTS[k] ?? "";

  return { get, saveAll, resetAll, isAdmin, loading, overrides };
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

  const startEdit = () => {
    // seed draft from current values (overrides ?? defaults)
    const seed: Draft = {};
    for (const key of Object.keys(DEFAULTS)) seed[key] = reg.get(key);
    setDraftState(seed);
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
    <EditCtx.Provider value={{ editing, isAdmin: reg.isAdmin, get: reg.get, setDraft, draft }}>
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
                    {reg.get("policy_bullets").split("\n").filter(Boolean).map((line, i) => (
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
