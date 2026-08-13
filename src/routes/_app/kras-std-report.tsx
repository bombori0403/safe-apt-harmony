import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { SignedImg } from "@/components/signed-img";
import { RISK_ORDER, riskLevelClass, type RiskLevel } from "@/lib/types";
import { suggestLegalBasis } from "@/lib/legal-basis-keywords";
import { TrialWatermark, TrialExpiredBlock } from "@/components/trial-watermark";
import { useSubscription } from "@/hooks/use-subscription";

// 공단 e-KRAS 표준서식(6종) 출력 — 단지 단위로 위험요인을 재검토(과년도)/신규로 나눠
// 1-1 재검토 · 1-2 신규결정 · 2-1 감소대책(재검토) · 2-2 감소대책(신규) · 3-1 이행확인 · 3-2 사진대지 를 그린다.

export const Route = createFileRoute("/_app/kras-std-report")({
  validateSearch: (s: Record<string, unknown>) => ({
    assessmentId: typeof s.assessmentId === "string" ? s.assessmentId : undefined,
    complexId: typeof s.complexId === "string" ? s.complexId : undefined,
    type: typeof s.type === "string" ? s.type : undefined,
    q: typeof s.q === "string" ? s.q : undefined,
  }),
  component: KrasStdReport,
});

// 저장 등급을 방법별 표기로 되돌린다(3단계 상/중/하, 체크리스트 적정/보완).
function displayLevel(level?: string | null, method?: string): string {
  if (!level) return "-";
  if (method === "3단계_판단법") {
    if (["매우높음", "높음", "상"].includes(level)) return "상";
    if (["보통", "중"].includes(level)) return "중";
    if (["낮음", "매우낮음", "하"].includes(level)) return "하";
  }
  if (method === "체크리스트법") {
    if (["높음", "매우높음", "보완"].includes(level)) return "보완";
    if (["낮음", "매우낮음", "적정"].includes(level)) return "적정";
  }
  return level;
}

function legalOf(h: any): string {
  return h.legal_basis_override || h.hazard_library?.legal_basis || suggestLegalBasis(h.description ?? "")?.legal_basis || "-";
}

function KrasStdReport() {
  const { assessmentId, complexId, type, q } = Route.useSearch();
  const sub = useSubscription();
  const [complexName, setComplexName] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // 평가 하나(=연도) 단위 출력이 기본. assessmentId가 없으면 단지 전체(여러 해 합산)로 폴백.
      let query = supabase.from("assessments").select("*").order("assessment_date", { ascending: true });
      if (assessmentId) query = query.eq("id", assessmentId);
      else {
        if (complexId) query = query.eq("complex_id", complexId);
        if (type) query = query.eq("assessment_type", type);
      }
      const { data: ass } = await query;
      let list = ass ?? [];
      if (!assessmentId && q) list = list.filter((a) => a.work_name?.includes(q));

      const cxId = assessmentId ? list[0]?.complex_id : complexId;
      if (cxId) {
        const { data: c } = await supabase.from("complexes").select("name").eq("id", cxId).maybeSingle();
        setComplexName(c?.name ?? "");
      }

      if (list.length > 0) {
        const ids = list.map((a) => a.id);
        const { data: h } = await supabase
          .from("hazards")
          .select("*, measures(*), hazard_library:library_item_id(article_no, legal_basis)")
          .in("assessment_id", ids)
          .order("created_at", { ascending: true });
        const byId: Record<string, any> = {};
        list.forEach((a) => (byId[a.id] = a));
        const flat = (h ?? []).map((row) => {
          const a = byId[row.assessment_id] ?? {};
          return { ...row, work_name: a.work_name, _method: a.method, _allow: (a.allowable_level ?? "낮음") as RiskLevel };
        });
        setRows(flat);
      }
      setLoading(false);
    })();
  }, [assessmentId, complexId, type, q]);

  if (sub.isExpired) return <TrialExpiredBlock what="표준서식 출력" paid={sub.isPaid} />;

  // 재검토 / 신규로 분리하고 연번 부여
  const carryover = rows.filter((h) => h.origin === "carryover");
  const news = rows.filter((h) => h.origin !== "carryover");
  carryover.forEach((h, i) => (h._seq = `재검토-${i + 1}`));
  news.forEach((h, i) => (h._seq = `신규-${i + 1}`));

  // 감소대책 대상 = 현재 위험성이 허용수준 초과(=3단계 중·상). '하'는 재검토에서 종결되어 제외.
  const needsMeasure = (h: any) =>
    h.level != null && RISK_ORDER[h.level as RiskLevel] > RISK_ORDER[(h._allow ?? "낮음") as RiskLevel];

  const carryoverM = carryover.filter(needsMeasure);
  const newsM = news.filter(needsMeasure);
  const allM = [...carryoverM, ...newsM];

  const label = complexName ? `[ ${complexName} ]` : "[ 전체 단지 ]";

  return (
    <div className="bg-white text-foreground">
      {sub.isTrial && <TrialWatermark expired={sub.isExpired} />}
      <div className="print:hidden p-4 max-w-5xl mx-auto flex justify-between items-center border-b">
        <Link to="/history"><Button variant="outline" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />평가 이력으로</Button></Link>
        <Button onClick={() => window.print()} className="gap-2" disabled={loading || rows.length === 0}>
          <Printer className="h-4 w-4" />PDF 저장 / 인쇄
        </Button>
      </div>

      <div className="max-w-5xl mx-auto p-6 print:p-0 print:max-w-none space-y-8">
        {loading ? (
          <p className="text-muted-foreground">불러오는 중...</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground">출력할 위험성평가 데이터가 없습니다.</p>
        ) : (
          <>
            <DecisionSheet title="1-1. 위험성평가 재검토(과년도)" label={label} hazards={carryover} withMeasureSeq />
            <DecisionSheet title="1-2. 위험성결정(신규)" label={label} hazards={news} withMeasureSeq />
            <MeasureSheet title="2-1. 감소대책 수립(과년도 재검토)" label={label} hazards={carryoverM} />
            <MeasureSheet title="2-2. 감소대책 수립(신규)" label={label} hazards={newsM} />
            <ConfirmSheet title="3-1. 감소대책 이행 확인" label={label} hazards={allM} />
            <PhotoSheet title="3-2. 감소대책 이행 사진 대지" label={label} hazards={allM} />
          </>
        )}
      </div>

      <style>{STD_PRINT_STYLE}</style>
    </div>
  );
}

function SheetHead({ title, label }: { title: string; label: string }) {
  return (
    <div className="mb-2">
      <div className="text-center text-xs text-muted-foreground">{label}</div>
      <h2 className="text-center text-base font-bold">{title}</h2>
    </div>
  );
}

// 1-1 / 1-2 — 위험요인 결정(현재조치·현재위험성). withMeasureSeq: 감소대책 대상이면 연번 표기.
function DecisionSheet({ title, label, hazards, withMeasureSeq }: { title: string; label: string; hazards: any[]; withMeasureSeq?: boolean }) {
  return (
    <section className="std-sheet">
      <SheetHead title={title} label={label} />
      <table className="w-full text-[10px] border-collapse std-table">
        <thead>
          <tr className="bg-muted">
            <th className="border p-1 w-14">연번</th>
            <th className="border p-1 w-20">작업공정명</th>
            <th className="border p-1">유해·위험요인 (위험발생 상황 및 결과)</th>
            <th className="border p-1 w-32">관련근거 (법적기준)</th>
            <th className="border p-1 w-28">현재의 안전보건조치</th>
            <th className="border p-1 w-10">현재 위험성</th>
            {withMeasureSeq && <th className="border p-1 w-14">감소대책 연번</th>}
          </tr>
        </thead>
        <tbody>
          {hazards.length === 0 && (
            <tr><td colSpan={withMeasureSeq ? 7 : 6} className="border p-3 text-center text-muted-foreground">해당 항목이 없습니다.</td></tr>
          )}
          {hazards.map((h) => {
            const over = h.level && RISK_ORDER[h.level as RiskLevel] > RISK_ORDER[(h._allow ?? "낮음") as RiskLevel];
            return (
              <tr key={h.id} className="align-top">
                <td className="border p-1 text-center whitespace-nowrap">{h._seq}</td>
                <td className="border p-1">{h.work_name ?? "-"}</td>
                <td className="border p-1">{h.description}</td>
                <td className="border p-1">{legalOf(h)}</td>
                <td className="border p-1">{h.current_control || "-"}</td>
                <td className="border p-1 text-center">
                  <span className={`px-1 py-0.5 rounded ${riskLevelClass(h.level)}`}>{displayLevel(h.level, h._method)}</span>
                </td>
                {withMeasureSeq && <td className="border p-1 text-center whitespace-nowrap">{over ? h._seq : "-"}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

// 2-1 / 2-2 — 감소대책 수립(대책·개선예정일·담당자).
function MeasureSheet({ title, label, hazards }: { title: string; label: string; hazards: any[] }) {
  return (
    <section className="std-sheet">
      <SheetHead title={title} label={label} />
      <table className="w-full text-[10px] border-collapse std-table">
        <thead>
          <tr className="bg-muted">
            <th className="border p-1 w-14">연번</th>
            <th className="border p-1 w-20">작업공정명</th>
            <th className="border p-1">유해·위험요인</th>
            <th className="border p-1 w-10">현재 위험성</th>
            <th className="border p-1">위험성 감소대책</th>
            <th className="border p-1 w-16">개선 예정일</th>
            <th className="border p-1 w-14">담당자</th>
          </tr>
        </thead>
        <tbody>
          {hazards.length === 0 && (
            <tr><td colSpan={7} className="border p-3 text-center text-muted-foreground">감소대책 대상 항목이 없습니다.</td></tr>
          )}
          {hazards.map((h) => {
            const measures = h.measures ?? [];
            return (
              <tr key={h.id} className="align-top">
                <td className="border p-1 text-center whitespace-nowrap">{h._seq}</td>
                <td className="border p-1">{h.work_name ?? "-"}</td>
                <td className="border p-1">{h.description}</td>
                <td className="border p-1 text-center">
                  <span className={`px-1 py-0.5 rounded ${riskLevelClass(h.level)}`}>{displayLevel(h.level, h._method)}</span>
                </td>
                <td className="border p-1">
                  {measures.length === 0 ? "-" : measures.map((m: any, mi: number) => (
                    <div key={m.id} className={mi > 0 ? "border-t mt-0.5 pt-0.5" : ""}>{m.content}</div>
                  ))}
                </td>
                <td className="border p-1">
                  {measures.length === 0 ? "-" : measures.map((m: any, mi: number) => (
                    <div key={m.id} className={mi > 0 ? "border-t mt-0.5 pt-0.5" : ""}>{m.due_date ?? "-"}</div>
                  ))}
                </td>
                <td className="border p-1">
                  {measures.length === 0 ? "-" : measures.map((m: any, mi: number) => (
                    <div key={m.id} className={mi > 0 ? "border-t mt-0.5 pt-0.5" : ""}>{m.responsible_name ?? "-"}</div>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

// 3-1 — 감소대책 이행 확인(대책 전/후 위험성·완료여부·잔여대책·담당자).
function ConfirmSheet({ title, label, hazards }: { title: string; label: string; hazards: any[] }) {
  return (
    <section className="std-sheet">
      <SheetHead title={title} label={label} />
      <table className="w-full text-[10px] border-collapse std-table">
        <thead>
          <tr className="bg-muted">
            <th className="border p-1 w-8">구분</th>
            <th className="border p-1 w-14">연번</th>
            <th className="border p-1">유해·위험요인</th>
            <th className="border p-1">위험성 감소대책 (이행결과)</th>
            <th className="border p-1 w-10">대책 전</th>
            <th className="border p-1 w-10">대책 후</th>
            <th className="border p-1 w-12">완료 여부</th>
            <th className="border p-1 w-28">개선 예정일 (잔여 감소대책)</th>
            <th className="border p-1 w-14">담당자</th>
          </tr>
        </thead>
        <tbody>
          {hazards.length === 0 && (
            <tr><td colSpan={9} className="border p-3 text-center text-muted-foreground">이행 확인 대상 항목이 없습니다.</td></tr>
          )}
          {hazards.map((h) => {
            const measures = h.measures ?? [];
            const done = measures.length > 0 && measures.every((m: any) => m.status === "완료");
            const residual = measures.map((m: any) => m.residual_action).filter(Boolean).join(" / ");
            const dueList = measures.map((m: any) => m.due_date).filter(Boolean).join(", ");
            return (
              <tr key={h.id} className="align-top">
                <td className="border p-1 text-center">{h.origin === "carryover" ? "재검토" : "신규"}</td>
                <td className="border p-1 text-center whitespace-nowrap">{h._seq}</td>
                <td className="border p-1">{h.description}</td>
                <td className="border p-1">
                  {measures.length === 0 ? "-" : measures.map((m: any, mi: number) => (
                    <div key={m.id} className={mi > 0 ? "border-t mt-0.5 pt-0.5" : ""}>{m.content}</div>
                  ))}
                </td>
                <td className="border p-1 text-center">
                  <span className={`px-1 py-0.5 rounded ${riskLevelClass(h.level)}`}>{displayLevel(h.level, h._method)}</span>
                </td>
                <td className="border p-1 text-center">
                  {h.post_level ? <span className={`px-1 py-0.5 rounded ${riskLevelClass(h.post_level)}`}>{displayLevel(h.post_level, h._method)}</span> : "-"}
                </td>
                <td className="border p-1 text-center">{done ? "완료" : "미완료"}</td>
                <td className="border p-1">{done ? "-" : (residual || dueList || "-")}</td>
                <td className="border p-1">
                  {measures.length === 0 ? "-" : measures.map((m: any, mi: number) => (
                    <div key={m.id} className={mi > 0 ? "border-t mt-0.5 pt-0.5" : ""}>{m.responsible_name ?? "-"}</div>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

// 3-2 — 감소대책 이행 사진 대지(변경 전/후).
function PhotoSheet({ title, label, hazards }: { title: string; label: string; hazards: any[] }) {
  return (
    <section className="std-sheet">
      <SheetHead title={title} label={label} />
      <div className="space-y-3">
        {hazards.length === 0 && (
          <div className="border p-3 text-center text-[10px] text-muted-foreground">사진 대지 대상 항목이 없습니다.</div>
        )}
        {hazards.map((h) => {
          const before: string[] = Array.isArray(h.photos) ? h.photos : [];
          const after: string[] = Array.isArray(h.after_photos) ? h.after_photos : [];
          const measures = h.measures ?? [];
          return (
            <div key={h.id} className="border std-photo break-inside-avoid">
              <div className="grid grid-cols-[auto_1fr] text-[10px] border-b">
                <div className="border-r p-1 bg-muted font-medium whitespace-nowrap">{h._seq}</div>
                <div className="p-1">
                  <div><b>위험발생 상황·결과:</b> {h.description}</div>
                  <div><b>감소대책:</b> {measures.map((m: any) => m.content).filter(Boolean).join(" / ") || "-"}</div>
                </div>
              </div>
              <div className="grid grid-cols-2">
                <div className="border-r p-2">
                  <div className="text-[10px] font-medium text-center mb-1">변경 전</div>
                  <div className="flex flex-wrap gap-1 justify-center">
                    {before.length === 0 ? <span className="text-[10px] text-muted-foreground">사진 없음</span>
                      : before.map((url, i) => (
                        <SignedImg key={i} src={url} alt="" className="w-28 h-28 object-cover border rounded" />
                      ))}
                  </div>
                </div>
                <div className="p-2">
                  <div className="text-[10px] font-medium text-center mb-1">변경 후</div>
                  <div className="flex flex-wrap gap-1 justify-center">
                    {after.length === 0 ? <span className="text-[10px] text-muted-foreground">사진 없음</span>
                      : after.map((url, i) => (
                        <SignedImg key={i} src={url} alt="" className="w-28 h-28 object-cover border rounded" />
                      ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const STD_PRINT_STYLE = `
  @media print {
    @page { size: A4 portrait; margin: 8mm; }
    body { background: white; }
    .std-sheet { break-before: page; page-break-before: page; }
    .std-sheet:first-of-type { break-before: auto; page-break-before: auto; }
    .std-table tr, .std-table td, .std-table th { break-inside: avoid; page-break-inside: avoid; }
    .std-photo { break-inside: avoid; page-break-inside: avoid; }
  }
`;
