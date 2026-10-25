import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getViewInfo, submitViewAck } from "@/lib/confirm.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { riskLevelClass } from "@/lib/types";
import { METHOD_GLOSS } from "@/lib/glossary";
import { ASSESSMENT_STEPS } from "@/lib/assessment-steps";
import { Check, ChevronDown, ChevronUp, Printer, Shield } from "lucide-react";
import { toast } from "sonner";

/**
 * 진행 현황 열람 — 로그인 없이 링크(?k=열람토큰)로 여는 읽기 전용 화면.
 * 대상: 입주자대표 회장, 위탁 본사 담당 등 "평가가 잘 되고 있는지"만 확인하는 사람.
 * 결재가 아니다. 아래 "확인했습니다"는 열람·보고 증빙 기록일 뿐이다.
 * 개인정보 최소화: 참여자·열람자 이름은 보여주지 않고 수만 센다. 담당자가 공유를 끄면 서버가 거부한다.
 */
export const Route = createFileRoute("/view/$id")({
  validateSearch: (s: Record<string, unknown>): { k?: string } => (typeof s.k === "string" ? { k: s.k } : {}),
  component: View,
});

const STATUS_LABEL: Record<string, string> = { 대기: "실행 전", 진행중: "실행 중", 완료: "실행 완료" };
const FOLD_AFTER = 10;

function View() {
  const { id } = Route.useParams();
  const { k } = Route.useSearch();
  const [info, setInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState(false);
  const [ackName, setAckName] = useState("");
  const [ackRole, setAckRole] = useState("");
  const [acking, setAcking] = useState(false);
  const [acked, setAcked] = useState(false);

  async function load() {
    if (!k) { setError("열람 링크가 올바르지 않습니다. 관리사무소에서 받은 '진행 현황 열람 링크'로 열어 주세요."); return; }
    try {
      const res = await getViewInfo({ data: { assessmentId: id, k } });
      setInfo(res);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "평가 정보를 불러오지 못했습니다.");
    }
  }
  useEffect(() => { load(); }, [id, k]);

  async function ack() {
    if (!ackName.trim() || !k) { toast.error("이름을 적어 주세요"); return; }
    setAcking(true);
    try {
      const r = await submitViewAck({ data: { assessmentId: id, k, name: ackName.trim(), role: ackRole.trim() || null, userAgent: navigator.userAgent } });
      setAcked(true);
      if (r.duplicate) toast.info("오늘 이미 확인 기록이 있어 다시 남기지 않았습니다.");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "기록하지 못했습니다");
    } finally {
      setAcking(false);
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background to-accent/30">
        <Card className="max-w-md w-full"><CardContent className="p-8 text-center space-y-3">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="text-xl font-bold">열람할 수 없습니다</h1>
          <p className="text-base text-muted-foreground">{error}</p>
        </CardContent></Card>
      </div>
    );
  }
  if (!info) return <div className="p-8 text-muted-foreground">불러오는 중...</div>;

  const a = info.assessment;
  const c = info.counts;
  const hazards: any[] = info.hazards;
  const method = METHOD_GLOSS[a.method as keyof typeof METHOD_GLOSS];

  // 5단계 중 어디까지 왔는지
  const doneSteps = [
    true,
    c.hazards > 0,
    c.hazards > 0 && c.unrated === 0,
    a.status === "협의중" || a.status === "완료",
    a.status === "완료",
  ];
  const currentIdx = doneSteps.findIndex((d) => !d);
  const currentStep = currentIdx === -1 ? 4 : currentIdx; // 0-based index of current

  return (
    <div className="min-h-screen bg-background print:bg-white">
      <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-5">
        <header className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <img src="/logo-mark.png" alt="" className="h-7 w-7 rounded-full" />
            <span>리스크로그 · 위험성평가 진행 현황</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">{a.work_name}</h1>
          <div className="text-base text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
            <span>{a.complex_name}</span>
            <span>평가일 {a.assessment_date}</span>
            <span>{a.assessment_type}</span>
            {method && <span>{method.title}</span>}
            <span>상태 <b className="text-foreground">{a.status}</b></span>
          </div>
          <p className="text-sm text-muted-foreground">
            읽기 전용 열람 화면입니다. 문서 버전(마지막 수정) {info.docVersion ? new Date(info.docVersion).toLocaleString("ko-KR") : "-"}.
          </p>
        </header>

        {/* 진행 단계 */}
        <Card><CardContent className="p-4 md:p-5 space-y-3">
          <h2 className="font-semibold text-lg">어디까지 진행됐나</h2>
          <ol className="grid grid-cols-5 gap-1">
            {ASSESSMENT_STEPS.map((s, i) => {
              const done = doneSteps[i];
              const active = i === currentStep && a.status !== "완료";
              return (
                <li key={s.key} className={`flex flex-col items-center gap-1 rounded-md px-1 py-2 border-b-4 ${active ? "border-primary" : done ? "border-success/60" : "border-muted"}`}>
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${active ? "bg-primary text-primary-foreground" : done ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}>
                    {done && !active ? <Check className="h-4 w-4" /> : s.n}
                  </span>
                  <span className={`text-xs sm:text-sm text-center leading-tight ${active ? "font-semibold" : "text-muted-foreground"}`}>{s.short}</span>
                </li>
              );
            })}
          </ol>
          <p className="text-base">
            {a.status === "완료"
              ? "모든 단계가 끝나 평가가 완료되었습니다."
              : `지금 ${ASSESSMENT_STEPS[currentStep].n}단계 "${ASSESSMENT_STEPS[currentStep].label}" 진행 중입니다.`}
          </p>
        </CardContent></Card>

        {/* 요약 숫자 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="위험요인" value={`${c.hazards}건`} sub={c.unrated ? `미평가 ${c.unrated}건` : "모두 평가됨"} warn={c.unrated > 0} />
          <Stat label="감소대책" value={`${c.measures}건`} sub={c.measuresNotDone ? `실행 전·중 ${c.measuresNotDone}건` : c.measures ? "모두 실행 완료" : "—"} warn={c.measuresNotDone > 0} />
          <Stat label="근로자 참여 확인" value={`${c.confirmed}/${c.participants}명`} sub={c.participants ? (c.confirmed === c.participants ? "모두 확인" : "확인 진행 중") : "참여자 미등록"} warn={c.participants > 0 && c.confirmed < c.participants} />
          <Stat label="허용 수준" value={a.allowable_level ?? "-"} sub="이보다 높으면 대책 대상" />
        </div>

        {/* 전체 목록 — 화면에서는 10건 뒤로 접고, 인쇄에서는 전부 */}
        <Card><CardContent className="p-4 md:p-5 space-y-3">
          <h2 className="font-semibold text-lg">위험요인과 대책 (전체 {hazards.length}건)</h2>
          {hazards.length === 0 && <p className="text-base text-muted-foreground">아직 등록된 위험요인이 없습니다.</p>}
          <div className="divide-y">
            {hazards.map((h, idx) => {
              const isOpen = !!open[h.id];
              const folded = !showAll && idx >= FOLD_AFTER;
              return (
                <div key={h.id} className={`py-3 space-y-2 ${folded ? "hidden print:block" : ""}`}>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="font-medium text-base flex-1 min-w-[12rem]">{h.description}</div>
                    <div className="flex items-center gap-2">
                      {h.level ? <span className={`px-2 py-0.5 rounded text-sm ${riskLevelClass(h.level)}`}>{h.level}</span> : <Badge variant="outline">미평가</Badge>}
                      {h.post_level && <span className="text-sm text-muted-foreground">→ 개선 후 {h.post_level}</span>}
                      <Button type="button" size="sm" variant="ghost" className="gap-1 print:hidden" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [h.id]: !isOpen }))}>
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}{isOpen ? "접기" : "대책 보기"}
                      </Button>
                    </div>
                  </div>
                  <div className={`${isOpen ? "" : "hidden print:block"} text-sm space-y-1.5 pl-1`}>
                    {h.current_control && <div><span className="text-muted-foreground">현재 조치: </span>{h.current_control}</div>}
                    {h.legal_basis && <div><span className="text-muted-foreground">법적기준(참고): </span>{h.legal_basis}</div>}
                    {h.measures.length === 0
                      ? <div className="text-muted-foreground">감소대책 없음{h.level ? "" : " (미평가)"}</div>
                      : (
                        <ul className="space-y-1">
                          {h.measures.map((m: any) => (
                            <li key={m.id} className="flex flex-wrap items-center gap-2">
                              <Badge variant={m.status === "완료" ? "default" : "outline"} className={m.status === "완료" ? "bg-success text-success-foreground" : ""}>{STATUS_LABEL[m.status] ?? m.status}</Badge>
                              <span>{m.content}</span>
                              {m.due_date && <span className="text-muted-foreground">예정 {m.due_date}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
          {hazards.length > FOLD_AFTER && !showAll && (
            <Button type="button" variant="outline" className="w-full print:hidden" onClick={() => setShowAll(true)}>나머지 {hazards.length - FOLD_AFTER}건 더 보기</Button>
          )}
        </CardContent></Card>

        {/* 열람 확인 */}
        <Card className="print:hidden"><CardContent className="p-4 md:p-5 space-y-3">
          <h2 className="font-semibold text-lg">확인했습니다 (열람 기록)</h2>
          <p className="text-sm text-muted-foreground">입주자대표회의·본사 등 보고를 받는 분이 내용을 확인했다는 기록입니다. 결재나 승인이 아닙니다. 기록은 관리사무소 화면에서 볼 수 있습니다.</p>
          {acked ? (
            <p className="text-base text-success inline-flex items-center gap-1"><Check className="h-5 w-5" />확인 기록이 저장되었습니다.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div><Label htmlFor="ack-name">이름</Label><Input id="ack-name" value={ackName} onChange={(e) => setAckName(e.target.value)} placeholder="홍길동" autoComplete="name" /></div>
              <div><Label htmlFor="ack-role">직위 (선택)</Label><Input id="ack-role" value={ackRole} onChange={(e) => setAckRole(e.target.value)} placeholder="입주자대표회의 회장" /></div>
              <div className="flex items-end"><Button type="button" className="w-full" onClick={ack} disabled={acking || !ackName.trim()}>{acking ? "저장 중…" : "확인했습니다"}</Button></div>
            </div>
          )}
          {info.ackCount > 0 && <p className="text-sm text-muted-foreground">지금까지 {info.ackCount}명이 확인했습니다.</p>}
        </CardContent></Card>

        <div className="flex flex-wrap gap-2 print:hidden">
          <Button type="button" variant="outline" className="gap-2" onClick={() => window.print()}><Printer className="h-5 w-5" />이 화면 인쇄 / PDF 저장</Button>
        </div>
        <p className="text-sm text-muted-foreground">
          산업안전보건법 제36조 제4항에 따라 위험성평가 결과를 근로자에게 알리는 수단(전자적 방법)으로도 쓸 수 있습니다. 공식 결과서는 관리사무소가 출력합니다.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${warn ? "border-warning/60 bg-warning/5" : "bg-card"}`}>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className={`text-sm ${warn ? "text-warning" : "text-muted-foreground"}`}>{sub}</div>}
    </div>
  );
}
