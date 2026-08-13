import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { TrialExpiredBlock } from "@/components/trial-watermark";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { METHOD_INFO, recommendMethod } from "@/lib/method-recommend";
import { ASSESSMENT_METHODS, METHOD_LABEL, WORK_CATEGORIES, CATEGORY_LABEL, type WorkCategory, type AssessmentMethod, type AssessmentType, type RiskLevel } from "@/lib/types";
import { getCurrentUserContext } from "@/lib/user-context";
import { toast } from "sonner";
import { Star, AlertTriangle, ShieldAlert, ChevronDown, ChevronUp, History, Settings } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { WORK_STOP_LAW_TITLE, WORK_STOP_LAW_TEXT } from "@/lib/work-stop-law";

// 위험 등급 색상(초록→빨강). 허용수준 선택을 직관적으로 보이게 하는 데 사용.
// 3단계(상/중/하)·체크리스트(적정/보완) 값도 같은 색 계열에 대응.
const RISK_COLORS: Record<string, string> = {
  매우낮음: "oklch(0.78 0.1 162)",
  낮음: "oklch(0.7 0.14 162)",
  보통: "oklch(0.78 0.16 70)",
  높음: "oklch(0.68 0.2 30)",
  매우높음: "oklch(0.58 0.23 27)",
  하: "oklch(0.7 0.14 162)", 중: "oklch(0.78 0.16 70)", 상: "oklch(0.58 0.23 27)",
  적정: "oklch(0.7 0.14 162)", 보완: "oklch(0.68 0.2 30)",
};

// 평가법별 '허용 가능한 위험성 수준' 선택지(낮음→높음 순). Step 3의 판단기준과 척도를 맞춘다.
const ALLOWABLE_OPTIONS: Record<AssessmentMethod, string[]> = {
  "5단계_판단법": ["매우낮음", "낮음", "보통", "높음", "매우높음"],
  "빈도강도법": ["매우낮음", "낮음", "보통", "높음", "매우높음"],
  "3단계_판단법": ["하", "중", "상"],
  "체크리스트법": ["적정", "보완"],
  "OPS": ["낮음", "보통", "높음"],
};
// 방법별 기본 허용수준(보통 '낮은' 쪽을 허용선으로).
const ALLOWABLE_DEFAULT: Record<AssessmentMethod, string> = {
  "5단계_판단법": "낮음", "빈도강도법": "낮음", "3단계_판단법": "하", "체크리스트법": "적정", "OPS": "낮음",
};

// 작업명으로 작업 카테고리 자동 추측(키워드). 확실치 않으면 null.
const CATEGORY_KEYWORDS: [WorkCategory, string[]][] = [
  ["승강기_점검정비", ["승강기", "엘리베이터", "에스컬레이터", "리프트"]],
  ["소방시설", ["소방", "스프링클러", "소화", "제연", "피난", "화재감지"]],
  ["어린이놀이시설", ["놀이터", "놀이시설", "놀이기구", "어린이", "미끄럼", "그네"]],
  ["전기실_변전실", ["전기실", "변전", "수전", "배전", "분전", "발전기", "축전지", "감전", "전기"]],
  ["기계실_보일러실", ["기계실", "보일러", "펌프", "급수", "급탕", "난방", "배관", "물탱크", "저수조", "열교환", "냉각탑"]],
  ["옥상_외벽", ["옥상", "외벽", "고소", "방수", "로프", "난간", "사다리", "비계"]],
  ["지하주차장_환기", ["환기", "급배기", "배기팬", "환풍", "지하주차"]],
  ["조경_외부작업", ["조경", "제초", "잡초", "전정", "예초", "제설", "살수", "화단", "수목", "정원"]],
  ["경비_보안", ["경비", "보안", "초소", "순찰", "cctv"]],
  ["주차관리", ["주차관리", "주차차단", "차단기", "주차장"]],
  ["청소_미화_사무", ["청소", "미화", "분리수거", "재활용", "쓰레기", "사무"]],
];
function guessCategory(workName: string): WorkCategory | null {
  const w = workName.replace(/\s+/g, "").toLowerCase();
  if (!w) return null;
  for (const [cat, kws] of CATEGORY_KEYWORDS) {
    for (const kw of kws) if (w.includes(kw.replace(/\s+/g, "").toLowerCase())) return cat;
  }
  return null;
}

export const Route = createFileRoute("/_app/assessment/new")({
  component: NewAssessment,
});

function NewAssessment() {
  const { user } = useAuth();
  const sub = useSubscription();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [complexId, setComplexId] = useState<string>("");
  const [complexes, setComplexes] = useState<{id:string; name:string}[]>([]);
  const [userRowId, setUserRowId] = useState<string>("");
  const [type, setType] = useState<AssessmentType>("정기평가");
  const [workName, setWorkName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState("");
  const [method, setMethod] = useState<AssessmentMethod>("5단계_판단법");
  const [workCategory, setWorkCategory] = useState<WorkCategory>("승강기_점검정비");
  const [catTouched, setCatTouched] = useState(false); // 사용자가 직접 카테고리를 바꿨는지
  // 작업명을 입력하면 카테고리를 자동 추측(사용자가 직접 고른 적 없을 때만).
  useEffect(() => {
    if (catTouched) return;
    const g = guessCategory(workName);
    if (g) setWorkCategory(g);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workName]);
  const [allowable, setAllowable] = useState<string>("낮음");
  // 평가법이 바뀌면 허용수준 척도가 달라지므로, 현재 값이 그 방법의 선택지에 없으면 기본값으로 맞춘다.
  useEffect(() => {
    if (!ALLOWABLE_OPTIONS[method].includes(allowable)) setAllowable(ALLOWABLE_DEFAULT[method]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method]);
  const [participantConsent, setParticipantConsent] = useState(false);
  const [workStopConsent, setWorkStopConsent] = useState(false);
  const [nearMiss, setNearMiss] = useState<any[]>([]);
  const [nmExpanded, setNmExpanded] = useState(false);
  const [complexPhone, setComplexPhone] = useState<string>("");
  const [prevList, setPrevList] = useState<any[]>([]);
  const [sourceId, setSourceId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    getCurrentUserContext(user.id).then(async ({ userId, userRow, complexId }) => {
      if (userId) setUserRowId(userId);
      let availableComplexes: any[] = [];
      if (userRow?.org_role === "admin") {
        // 관리자: 조직 전체 단지 (RLS가 조직별로 제한)
        const { data } = await supabase.from("complexes").select("id, name").order("name");
        availableComplexes = data ?? [];
      } else {
        // 매니저/일반: 배정된 단지만
        const { data: members } = await supabase.from("complex_members").select("complex_id").eq("user_id", userId ?? "");
        const ids = [...new Set((members ?? []).map((m: any) => m.complex_id).filter(Boolean))];
        availableComplexes = ids.length
          ? (await supabase.from("complexes").select("id, name").in("id", ids).order("name")).data ?? []
          : [];
      }
      setComplexes(availableComplexes);
      if (complexId) setComplexId(complexId);
      else if (availableComplexes[0]) setComplexId(availableComplexes[0].id);
    });
  }, [user]);

  const [pickedNearMiss, setPickedNearMiss] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!complexId) return;
    const since = new Date(Date.now() - 365 * 86400_000).toISOString();
    (supabase as any).from("near_miss").select("*")
      .eq("complex_id", complexId)
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .then(({ data }: any) => setNearMiss(data ?? []));
    supabase.from("complexes").select("manager_phone").eq("id", complexId).maybeSingle()
      .then(({ data }) => setComplexPhone(data?.manager_phone ?? ""));
    // 정기 재검토용: 이 단지의 과거 평가 목록 + 위험요인 수
    supabase.from("assessments")
      .select("id, work_name, assessment_date, method, hazards(count)")
      .eq("complex_id", complexId)
      .order("assessment_date", { ascending: false })
      .then(({ data }) => setPrevList(data ?? []));
    setSourceId("");
  }, [complexId]);

  const recommended = workName ? recommendMethod(workName) : null;

  async function submit() {
    if (!complexId) { toast.error("단지가 지정되지 않았습니다"); return; }
    if (!workStopConsent) { toast.error("작업중지권 안내 동의가 필요합니다"); return; }
    if (sub.isTrial) {
      const { count } = await supabase.from("assessments").select("id", { count: "exact", head: true });
      if ((count ?? 0) >= 10) {
        toast.error("체험판은 평가 10건까지 작성할 수 있습니다. 정식 전환 후 계속하세요.");
        return;
      }
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("assessments")
        .insert({
          complex_id: complexId,
          created_by: userRowId || null,
          assessment_type: type,
          work_name: workName,
          work_category: workCategory,
          method,
          assessment_date: date,
          location,
          allowable_level: allowable,
          status: "작성중",
        })
        .select()
        .single();
      if (error) throw error;

      // 위험요인으로 등록한 아차사고를 hazards에 자동 추가
      const pickedIds = Object.keys(pickedNearMiss).filter(k => pickedNearMiss[k]);
      const picked = nearMiss.filter(n => pickedIds.includes(n.id));
      if (picked.length) {
        await supabase.from("hazards").insert(
          picked.map(n => ({
            assessment_id: data.id,
            description: `[아차사고 반영] ${n.situation}${n.location_detail ? ` (${n.location_detail})` : ""}`,
          }))
        );
      }

      // 정기 재검토: 이전 평가의 위험요인 + 감소대책을 그대로 불러오기(전체, 완료/미완료 유지)
      let copied = 0;
      if (sourceId) {
        const { data: src } = await supabase.from("hazards")
          .select("description, process_name, current_control, likelihood, severity, level, level_standardized, legal_basis_override, library_item_id, post_likelihood, post_severity, post_level, checklist_result, ops_data, measures(content, type, due_date, status, completed_at, responsible_name, residual_action)")
          .eq("assessment_id", sourceId)
          .order("created_at", { ascending: true });
        if (src && src.length) {
          // hazard id를 미리 생성해 감소대책을 정확히 매칭(INSERT RETURNING 순서 비의존).
          const hzIns = src.map((h: any) => ({
            id: crypto.randomUUID(),
            assessment_id: data.id,
            origin: "carryover",   // 이전 평가에서 불러온 = 과년도 재검토 출신
            description: h.description, process_name: h.process_name, current_control: h.current_control,
            likelihood: h.likelihood, severity: h.severity,
            level: h.level, level_standardized: h.level_standardized,
            legal_basis_override: h.legal_basis_override, library_item_id: h.library_item_id,
            post_likelihood: h.post_likelihood, post_severity: h.post_severity, post_level: h.post_level,
            checklist_result: h.checklist_result, ops_data: h.ops_data,
          }));
          const { error: hzErr } = await supabase.from("hazards").insert(hzIns);
          const mIns: any[] = [];
          if (!hzErr) src.forEach((sh: any, i: number) => {
            for (const m of (sh?.measures ?? [])) {
              mIns.push({ hazard_id: hzIns[i].id, content: m.content, type: m.type, due_date: m.due_date, status: m.status, completed_at: m.completed_at, responsible_name: m.responsible_name, residual_action: m.residual_action });
            }
          });
          if (mIns.length) await supabase.from("measures").insert(mIns).then(() => {}, () => {});
          copied = hzIns.length;
        }
      }

      toast.success(copied
        ? `평가 생성 완료 · 이전 평가에서 ${copied}건 불러옴. 검토·추가 후 진행하세요.`
        : "평가 생성 완료. 유해·위험요인 파악 단계로 이동합니다.");
      navigate({ to: "/assessment/$id/hazards", params: { id: data.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setSaving(false);
    }
  }

  if (sub.isExpired) return <TrialExpiredBlock what="새 평가 작성" paid={sub.isPaid} />;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-5">
      <div>
        <div className="text-sm text-muted-foreground">사전준비 단계 — {step}/6</div>
        <h1 className="text-2xl font-bold mt-1">위험성평가 사전준비</h1>
      </div>

      <div className="flex gap-1">
        {[1,2,3,4,5,6].map(n => (
          <div key={n} className={`flex-1 h-1.5 rounded-full ${n <= step ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>

      {/* 아차사고 반영 카드 */}
      {complexId && (
        <Card>
          <CardContent className="p-4">
            <button type="button" onClick={()=>setNmExpanded(v=>!v)} className="w-full flex items-center justify-between gap-2 text-left">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-warning/15 text-warning"><AlertTriangle className="h-4 w-4"/></div>
                <div>
                  <div className="text-sm font-semibold">지난 12개월 아차사고 {nearMiss.length}건</div>
                  <div className="text-xs text-muted-foreground">위험요인으로 등록할 항목을 선택하세요</div>
                </div>
              </div>
              {nmExpanded ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}
            </button>
            {nmExpanded && (
              <div className="mt-3 space-y-1.5 max-h-64 overflow-y-auto">
                {nearMiss.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2">등록된 아차사고가 없습니다.</div>
                ) : nearMiss.map(n => (
                  <label key={n.id} className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/40 cursor-pointer text-sm">
                    <input type="checkbox" className="mt-0.5"
                      checked={!!pickedNearMiss[n.id]}
                      onChange={e=>setPickedNearMiss({...pickedNearMiss, [n.id]: e.target.checked})} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground">{new Date(n.occurred_at).toLocaleDateString("ko-KR")} · {n.location_category ?? "-"} · {n.incident_type ?? "-"}</div>
                      <div className="line-clamp-2">{n.situation}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 정기 재검토: 이전 평가 불러오기 */}
      {complexId && prevList.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10 text-primary"><History className="h-4 w-4" /></div>
              <div>
                <div className="text-sm font-semibold">이전 평가 재검토 (정기평가)</div>
                <div className="text-xs text-muted-foreground">작년 위험요인·감소대책을 전부 불러와 검토합니다. 완료/미완료 상태도 그대로 유지되고, 이어서 신규 위험요인을 추가할 수 있어요.</div>
              </div>
            </div>
            <select value={sourceId} onChange={e => setSourceId(e.target.value)} className="w-full h-10 px-3 rounded-md border bg-background text-sm">
              <option value="">불러오지 않음 (새로 작성)</option>
              {prevList.map((p: any) => (
                <option key={p.id} value={p.id}>{p.work_name} · {p.assessment_date} · 위험요인 {p.hazards?.[0]?.count ?? 0}건</option>
              ))}
            </select>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card><CardContent className="p-5 space-y-4">
          <h2 className="font-semibold text-lg">Step 1. 평가 기본정보</h2>
          <div>
            <Label>평가 단지</Label>
            {complexes.length === 0 ? (
              <div className="rounded-md border bg-muted/40 p-3 mt-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">등록된 단지가 없습니다. 먼저 단지를 등록해주세요.</span>
                <Link to="/settings"><Button size="sm" variant="outline" className="gap-1"><Settings className="h-4 w-4" />설정에서 단지 등록</Button></Link>
              </div>
            ) : (
              <select value={complexId} onChange={e=>setComplexId(e.target.value)}
                className="w-full h-10 px-3 rounded-md border bg-background text-sm mt-1.5">
                {complexes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
          <div>
            <Label>평가 종류</Label>
            <div className="flex gap-2 mt-1.5">
              {(["최초평가","정기평가","수시평가"] as AssessmentType[]).map(t => (
                <button key={t} type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 py-2.5 rounded-md border text-sm font-medium ${type===t?"bg-primary text-primary-foreground border-primary":"bg-background"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="wn">평가 대상 작업명</Label>
            <Input id="wn" value={workName} onChange={e=>setWorkName(e.target.value)} placeholder="예: 승강기 정기점검" />
          </div>
          <div>
            <Label>작업 카테고리</Label>
            <p className="text-xs text-muted-foreground mt-1 mb-1.5">
              작업명에 따라 자동 선택됩니다. 이 카테고리 기준으로 유해·위험요인 목록이 제안됩니다.
            </p>
            <select value={workCategory} onChange={e=>{ setWorkCategory(e.target.value as WorkCategory); setCatTouched(true); }}
              className="w-full h-10 px-3 rounded-md border bg-background text-sm">
              {WORK_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="dt">평가일자</Label>
              <Input id="dt" type="date" value={date} onChange={e=>setDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="lc">평가 장소</Label>
              <Input id="lc" value={location} onChange={e=>setLocation(e.target.value)} placeholder="예: 101동 기계실" />
            </div>
          </div>
        </CardContent></Card>
      )}

      {step === 2 && (
        <Card><CardContent className="p-5 space-y-4">
          <h2 className="font-semibold text-lg">Step 2. 평가 방법 선택</h2>
          <p className="text-sm text-muted-foreground">다음 5종 중 1개를 선택하세요. 작업명에 따라 ★ 추천이 표시됩니다.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ASSESSMENT_METHODS.map(m => {
              const info = METHOD_INFO[m];
              const isRec = recommended === m;
              const isSel = method === m;
              return (
                <button key={m} type="button" onClick={() => setMethod(m)}
                  className={`text-left p-4 rounded-lg border-2 transition-all ${isSel ? "border-primary bg-accent/40 shadow-md" : "border-border hover:border-primary/40"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xl">{info.icon}</div>
                    {isRec && <Badge className="gap-1 bg-warning text-warning-foreground"><Star className="h-3 w-3" />추천</Badge>}
                  </div>
                  <div className="font-semibold mt-2">{info.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">{info.desc}</div>
                  <div className="text-[11px] text-primary mt-2">권장: {info.usecase}</div>
                </button>
              );
            })}
          </div>
        </CardContent></Card>
      )}

      {step === 3 && (
        <Card><CardContent className="p-5 space-y-3">
          <h2 className="font-semibold text-lg">Step 3. 위험성 수준 판단기준 확정</h2>
          <div className="rounded-md bg-muted p-3 text-sm">
            선택한 방법: <span className="font-semibold text-primary">{METHOD_INFO[method].title}</span>
          </div>
          {method === "3단계_판단법" && (
            <div className="text-sm space-y-2">
              <p><span className="font-semibold text-danger">상</span> = 사망 또는 영구장애를 일으키는 재해</p>
              <p><span className="font-semibold text-warning">중</span> = 휴업 1개월 이상의 부상·질병</p>
              <p><span className="font-semibold text-success">하</span> = 휴업 1개월 미만 또는 무휴업</p>
            </div>
          )}
          {method === "5단계_판단법" && (
            <div className="text-sm space-y-2">
              <p><span className="font-semibold text-danger">매우높음</span> = 사망 또는 영구장애</p>
              <p><span className="font-semibold text-danger">높음</span> = 6개월 이상 휴업 필요</p>
              <p><span className="font-semibold text-warning">보통</span> = 3~6개월 휴업 필요</p>
              <p><span className="font-semibold text-success">낮음</span> = 3개월 미만 휴업 필요</p>
              <p className="text-muted-foreground"><span className="font-semibold">매우낮음</span> = 휴업 불필요</p>
            </div>
          )}
          {method === "빈도강도법" && (
            <div className="text-sm space-y-2">
              <p>가능성 1~5점 × 중대성 1~5점 = 위험성 점수</p>
              <p>1~4점=매우낮음 · 5~8점=낮음 · 9~12점=보통 · 13~16점=높음 · 17~25점=매우높음</p>
            </div>
          )}
          {method === "체크리스트법" && (
            <div className="text-sm space-y-2">
              <p>판정 기준: <span className="font-semibold text-success">○ 적정</span> / <span className="font-semibold text-danger">× 보완</span></p>
              <p className="text-muted-foreground">'보완' 항목은 자동으로 감소대책 수립 단계로 전달됩니다.</p>
            </div>
          )}
          {method === "OPS" && (
            <div className="text-sm space-y-2">
              <p>핵심 질문 3개에 답변:</p>
              <p>Q1. 무엇이 위험한가? · Q2. 얼마나 심각한가? · Q3. 어떻게 막을 것인가?</p>
              <p className="text-muted-foreground mt-2">위험요인 1개=낮음 / 2개=보통 / 3개 이상=높음</p>
            </div>
          )}
        </CardContent></Card>
      )}

      {step === 4 && (
        <Card><CardContent className="p-5 space-y-3">
          <h2 className="font-semibold text-lg">Step 4. 허용 가능한 위험성 수준 확정</h2>
          <p className="text-sm text-muted-foreground">
            선택한 방법(<span className="font-semibold text-primary">{METHOD_INFO[method].title}</span>)의 척도에 맞춘 선택지입니다.
            이 수준 <b>이하</b>는 허용, 이보다 <b>높은</b> 위험성은 개선(감소대책) 대상이 됩니다.
          </p>
          <div className="grid gap-1.5 md:gap-2 mt-2" style={{ gridTemplateColumns: `repeat(${ALLOWABLE_OPTIONS[method].length}, minmax(0,1fr))` }}>
            {ALLOWABLE_OPTIONS[method].map(l => {
              const sel = allowable === l;
              const c = RISK_COLORS[l] ?? "oklch(0.7 0.14 162)";
              return (
                <button key={l} type="button" onClick={() => setAllowable(l)} aria-pressed={sel}
                  className={`relative flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-lg border-2 text-[11px] md:text-sm font-semibold transition-all ${sel ? "shadow-md -translate-y-0.5" : "bg-white hover:bg-muted/30"}`}
                  style={{ borderColor: c, borderWidth: sel ? "3px" : "2px", background: sel ? `color-mix(in oklch, ${c} 15%, white)` : undefined }}>
                  <span className="inline-block h-3.5 w-3.5 rounded-full shrink-0" style={{ background: c }} />
                  <span className="leading-tight text-center">{l}</span>
                  {sel && <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full text-white text-[11px] leading-none flex items-center justify-center shadow" style={{ background: c }}>✓</span>}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm mt-1">
            <span className="inline-block h-3.5 w-3.5 rounded-full shrink-0" style={{ background: RISK_COLORS[allowable] }} />
            선택한 허용 수준: <b>{allowable}</b>
            <span className="text-muted-foreground">— 이보다 높은 위험은 개선 대상</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            법령상 허용 가능한 위험성 수준은 산업안전보건법 등 관련 법령에서 정한 기준 이상이어야 합니다.
          </p>
        </CardContent></Card>
      )}

      {step === 5 && (
        <Card><CardContent className="p-5 space-y-3">
          <h2 className="font-semibold text-lg">Step 5. 평가 참여자</h2>
          <p className="text-sm text-muted-foreground">
            관리감독자가 유해·위험요인을 파악·감소대책 수립·이행 여부를 확인하는 경우에는 해당 작업에 종사하는 근로자를 참여시켜야 합니다.
          </p>
          <div className="rounded-md bg-muted p-3 text-sm">
            평가 생성 후 다음 단계에서 참여자를 추가할 수 있습니다.
          </div>
        </CardContent></Card>
      )}

      {step === 6 && (
        <Card><CardContent className="p-5 space-y-3">
          <h2 className="font-semibold text-lg">Step 6. 평가 실시규정 체크리스트</h2>
          <ul className="text-sm space-y-2">
            <li>☑ 평가의 목적 및 방법 확정 — <span className="text-success">완료</span></li>
            <li>☑ 평가담당자·책임자 역할 확정 — <span className="text-success">완료</span></li>
            <li>☑ 위험성 수준 판단기준 확정 — <span className="text-success">완료</span></li>
            <li>☑ 허용 가능한 위험성 수준 확정 — <span className="text-success">완료</span></li>
            <li>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={participantConsent} onChange={e=>setParticipantConsent(e.target.checked)} />
                근로자 참여 방법 확정
              </label>
            </li>
          </ul>
          <div className="text-xs text-muted-foreground">선택 방법: {METHOD_LABEL[method]}</div>
        </CardContent></Card>
      )}

      {/* 작업중지권 안내 */}
      <Card className="border-warning/40">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-warning/15 text-warning"><ShieldAlert className="h-4 w-4"/></div>
            <h2 className="font-semibold">{WORK_STOP_LAW_TITLE}</h2>
          </div>
          <pre className="whitespace-pre-wrap text-xs leading-relaxed bg-muted/40 rounded-md p-3 font-sans max-h-40 overflow-y-auto">{WORK_STOP_LAW_TEXT}</pre>
          <div className="text-xs">
            <span className="text-muted-foreground">행사 시 비상연락:</span>{" "}
            <span className="font-medium">{complexPhone || "관리사무소 비상연락망 (설정에서 등록)"}</span>
          </div>
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="mt-0.5" checked={workStopConsent} onChange={e=>setWorkStopConsent(e.target.checked)} />
            <span>본인은 위 작업중지권을 충분히 안내받았습니다. <span className="text-destructive">(필수)</span></span>
          </label>
          <Link to="/work-stop-right" className="text-xs text-primary underline">자세히 보기</Link>
        </CardContent>
      </Card>

      <div className="flex justify-between gap-2">
        <Button variant="outline" disabled={step===1} onClick={() => setStep(s => Math.max(1, s-1))}>이전</Button>
        {step < 6 ? (
          <Button onClick={() => setStep(s => s+1)} disabled={step===1 && !workName}>다음 단계로</Button>
        ) : (
          <Button onClick={submit} disabled={!participantConsent || !workStopConsent || saving}>
            {saving ? "저장 중..." : "유해·위험요인 파악으로"}
          </Button>
        )}
      </div>
    </div>
  );
}
