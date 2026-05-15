import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { METHOD_INFO, recommendMethod } from "@/lib/method-recommend";
import { ASSESSMENT_METHODS, METHOD_LABEL, type AssessmentMethod, type AssessmentType, type RiskLevel } from "@/lib/types";
import { getCurrentUserContext } from "@/lib/user-context";
import { toast } from "sonner";
import { Star, AlertTriangle, ShieldAlert, ChevronDown, ChevronUp } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { WORK_STOP_LAW_TITLE, WORK_STOP_LAW_TEXT } from "@/lib/work-stop-law";

export const Route = createFileRoute("/_app/assessment/new")({
  component: NewAssessment,
});

function NewAssessment() {
  const { user } = useAuth();
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
  const [allowable, setAllowable] = useState<RiskLevel>("낮음");
  const [participantConsent, setParticipantConsent] = useState(false);
  const [workStopConsent, setWorkStopConsent] = useState(false);
  const [nearMiss, setNearMiss] = useState<any[]>([]);
  const [nmExpanded, setNmExpanded] = useState(false);
  const [complexPhone, setComplexPhone] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    getCurrentUserContext(user.id).then(async ({ userId, complexId }) => {
      if (userId) setUserRowId(userId);
      const { data: members } = await supabase
        .from("complex_members")
        .select("complex_id")
        .eq("user_id", userId ?? "");

      const complexIds = [...new Set((members ?? []).map((m: any) => m.complex_id).filter(Boolean))];
      const { data: list } = complexIds.length > 0
        ? await supabase.from("complexes").select("id, name").in("id", complexIds).order("created_at", { ascending: true })
        : { data: [] };
      const availableComplexes = list ?? [];
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
  }, [complexId]);

  const recommended = workName ? recommendMethod(workName) : null;

  async function submit() {
    if (!complexId) { toast.error("단지가 지정되지 않았습니다"); return; }
    if (!workStopConsent) { toast.error("작업중지권 안내 동의가 필요합니다"); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("assessments")
        .insert({
          complex_id: complexId,
          created_by: userRowId || null,
          assessment_type: type,
          work_name: workName,
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

      toast.success("평가 생성 완료. 유해·위험요인 파악 단계로 이동합니다.");
      navigate({ to: "/assessment/$id/hazards", params: { id: data.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setSaving(false);
    }
  }

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

      {step === 1 && (
        <Card><CardContent className="p-5 space-y-4">
          <h2 className="font-semibold text-lg">Step 1. 평가 기본정보</h2>
          <div>
            <Label>평가 단지</Label>
            {complexes.length === 0 ? (
              <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground mt-1.5">
                등록된 단지가 없습니다. 설정에서 단지를 먼저 등록해주세요.
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
          <p className="text-sm text-muted-foreground">이 수준 이하의 위험성은 허용 가능한 것으로 판단됩니다.</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2">
            {(["매우낮음","낮음","보통","높음","매우높음"] as RiskLevel[]).map(l => (
              <button key={l} type="button" onClick={() => setAllowable(l)}
                className={`py-3 rounded-md border-2 text-sm font-medium ${allowable===l?"border-primary bg-accent/40":"border-border"}`}>
                {l}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
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

      <div className="flex justify-between gap-2">
        <Button variant="outline" disabled={step===1} onClick={() => setStep(s => Math.max(1, s-1))}>이전</Button>
        {step < 6 ? (
          <Button onClick={() => setStep(s => s+1)} disabled={step===1 && !workName}>다음 단계로</Button>
        ) : (
          <Button onClick={submit} disabled={!participantConsent || saving}>
            {saving ? "저장 중..." : "유해·위험요인 파악으로"}
          </Button>
        )}
      </div>
    </div>
  );
}
