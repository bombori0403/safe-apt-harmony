import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Loader2 } from "lucide-react";
import { getCurrentUserContext } from "@/lib/user-context";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { TrialWatermark, TrialExpiredBlock } from "@/components/trial-watermark";
import { KrasReportTable } from "@/components/kras-report-table";
import { RegulationDocument, REGULATION_DEFAULTS } from "@/components/regulation-document";
import { SignedImg } from "@/components/signed-img";

const DOC_TYPES = [
  ["regulation", "실시규정"],
  ["kras", "KRAS 양식(위험성평가)"],
  ["nearMiss", "아차사고"],
  ["workStop", "작업중지권"],
  ["hearing", "청취조사"],
  ["openchat", "오픈채팅 이력"],
] as const;
type DocKey = (typeof DOC_TYPES)[number][0];

type Search = { complex?: string; from?: string; to?: string };

export const Route = createFileRoute("/_app/print-all")({
  component: PrintAll,
  validateSearch: (s: Record<string, unknown>): Search => ({
    complex: (s.complex as string) || "all",
    from: (s.from as string) || "",
    to: (s.to as string) || "",
  }),
});

function fmtDT(v?: string | null) {
  if (!v) return "-";
  try { return new Date(v).toLocaleString("ko-KR"); } catch { return "-"; }
}
function fmtD(v?: string | null) {
  if (!v) return "-";
  try { return new Date(v).toLocaleDateString("ko-KR"); } catch { return "-"; }
}

function PrintAll() {
  const { user } = useAuth();
  const sub = useSubscription();
  const search = Route.useSearch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [complexes, setComplexes] = useState<any[]>([]);
  const [regulation, setRegulation] = useState<any>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [docTypes, setDocTypes] = useState<Record<DocKey, boolean>>({
    regulation: true, kras: true, nearMiss: true, workStop: true, hearing: true, openchat: true,
  });
  const [dataByComplex, setDataByComplex] = useState<Record<string, {
    assessments: any[]; hazards: any[]; measures: any[];
    participants: any[]; signatures: any[]; assessmentInputs: any[];
    nearMiss: any[]; workStops: any[]; inputs: any[];
  }>>({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        setLoading(true);
        const { userRow, complexId } = await getCurrentUserContext(user.id);
        const isAdmin = userRow?.org_role === "admin";

        const targetComplex = search.complex && search.complex !== "all" ? search.complex : null;
        let allowedIds: string[] = [];

        if (isAdmin) {
          if (targetComplex) {
            allowedIds = [targetComplex];
          } else {
            const { data } = await supabase.from("complexes").select("id").order("name");
            allowedIds = (data ?? []).map((r: any) => r.id);
          }
        } else {
          // 매니저/직원은 담당 단지 전체(complex_members)로 확장 — 첫 단지만 나오던 버그 수정.
          const { data: members } = await supabase.from("complex_members").select("complex_id").eq("user_id", userRow?.id ?? "");
          allowedIds = [...new Set((members ?? []).map((m: any) => m.complex_id).filter(Boolean))];
          if (allowedIds.length === 0 && complexId) allowedIds = [complexId];
          if (targetComplex) {
            if (!allowedIds.includes(targetComplex)) {
              setError("해당 단지에 대한 권한이 없습니다.");
              setLoading(false); return;
            }
            allowedIds = [targetComplex];
          }
        }

        if (allowedIds.length === 0) {
          setError("표시할 단지가 없습니다.");
          setLoading(false); return;
        }

        const { data: cs } = await supabase.from("complexes")
          .select("id,name,address,manager_name,manager_phone")
          .in("id", allowedIds).order("name");
        setComplexes(cs ?? []);

        if (userRow?.organization_id) {
          const { data: reg } = await supabase.from("regulation_content").select("*")
            .eq("organization_id", userRow.organization_id).maybeSingle();
          setRegulation(reg);
        }

        if (userRow?.organization_id) {
          const { data: o } = await supabase
            .from("organizations").select("name").eq("id", userRow.organization_id).maybeSingle();
          setOrgName(o?.name ?? null);
        }

        const from = search.from ? new Date(search.from + "T00:00:00").toISOString() : null;
        const to = search.to ? new Date(search.to + "T23:59:59").toISOString() : null;

        const result: typeof dataByComplex = {};
        for (const c of cs ?? []) {
          const cid = c.id;

          // assessments (assessment_date within range)
          let aQ = supabase.from("assessments").select("*").eq("complex_id", cid).order("assessment_date", { ascending: false });
          if (search.from) aQ = aQ.gte("assessment_date", search.from);
          if (search.to) aQ = aQ.lte("assessment_date", search.to);
          const { data: ass } = await aQ;
          const assessments = ass ?? [];
          const aIds = assessments.map((a: any) => a.id);

          let hazards: any[] = [], measures: any[] = [];
          let participants: any[] = [], signatures: any[] = [], assessmentInputs: any[] = [];
          if (aIds.length) {
            const { data: h } = await supabase.from("hazards").select("*, hazard_library:library_item_id(article_no, legal_basis)").in("assessment_id", aIds);
            hazards = h ?? [];
            const hIds = hazards.map((h: any) => h.id);
            if (hIds.length) {
              const { data: m } = await supabase.from("measures").select("*").in("hazard_id", hIds);
              measures = m ?? [];
            }
            const { data: pp } = await supabase.from("participants").select("*").in("assessment_id", aIds);
            participants = pp ?? [];
            const { data: sg } = await supabase.from("signatures").select("*").in("assessment_id", aIds);
            signatures = sg ?? [];
            const { data: ai } = await supabase.from("employee_inputs").select("*").in("assessment_id", aIds).order("occurred_at", { ascending: false });
            assessmentInputs = ai ?? [];
          }

          // near miss
          let nmQ = supabase.from("near_miss").select("*").eq("complex_id", cid).order("occurred_at", { ascending: false });
          if (from) nmQ = nmQ.gte("occurred_at", from);
          if (to) nmQ = nmQ.lte("occurred_at", to);
          const { data: nm } = await nmQ;

          // work stop
          let wsQ: any = (supabase as any).from("work_stop_records").select("*").eq("complex_id", cid).order("exercised_at", { ascending: false });
          if (from) wsQ = wsQ.gte("exercised_at", from);
          if (to) wsQ = wsQ.lte("exercised_at", to);
          const { data: ws } = await wsQ;

          // employee inputs
          let eiQ = supabase.from("employee_inputs").select("*").eq("complex_id", cid).order("occurred_at", { ascending: false });
          if (from) eiQ = eiQ.gte("occurred_at", from);
          if (to) eiQ = eiQ.lte("occurred_at", to);
          const { data: ei } = await eiQ;

          result[cid] = {
            assessments, hazards, measures,
            participants, signatures, assessmentInputs,
            nearMiss: nm ?? [], workStops: ws ?? [], inputs: ei ?? [],
          };
        }
        setDataByComplex(result);
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [user, search.complex, search.from, search.to]);

  if (loading) {
    return <div className="p-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />전체 자료를 불러오는 중...</div>;
  }
  if (error) return <div className="p-8 text-red-600 text-sm">{error}</div>;
  if (sub.isExpired) return <TrialExpiredBlock what="전체 자료 출력" />;

  const totals = Object.values(dataByComplex).reduce((acc, d) => ({
    a: acc.a + d.assessments.length, n: acc.n + d.nearMiss.length,
    w: acc.w + d.workStops.length, i: acc.i + d.inputs.length,
  }), { a: 0, n: 0, w: 0, i: 0 });

  return (
    <div className="bg-white text-black">
      {sub.isTrial && <TrialWatermark expired={sub.isExpired} />}
      <div className="print:hidden p-4 max-w-5xl mx-auto space-y-3 border-b">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link to="/dashboard"><Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="h-4 w-4" />대시보드</Button></Link>
          <div className="text-sm text-muted-foreground">
            {complexes.length}개 단지 · 위험성평가 {totals.a} · 아차사고 {totals.n} · 작업중지 {totals.w} · 직원참여 {totals.i}
          </div>
          <Button onClick={() => window.print()} className="gap-1.5"><Printer className="h-4 w-4" />선택 문서 인쇄 / PDF 저장</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-muted/40 px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">출력할 문서:</span>
          {DOC_TYPES.map(([k, label]) => (
            <label key={k} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input type="checkbox" checked={docTypes[k]} onChange={(e) => setDocTypes((s) => ({ ...s, [k]: e.target.checked }))} />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div id="print-area" className="max-w-[210mm] mx-auto p-8 print:p-0 print:max-w-none">
        {/* 전체 표지 */}
        <section className="page">
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="text-sm text-gray-600">공동주택 안전보건 통합 자료집</div>
            <h1 className="text-3xl font-bold mt-3">위험성평가 결과 보고서</h1>
            <div className="mt-6 text-sm">
              대상 단지: <b>{complexes.length === 1 ? complexes[0].name : `${complexes.length}개 단지`}</b>
            </div>
            <div className="text-sm mt-1">
              기간: {search.from || "전체"} ~ {search.to || "현재"}
            </div>
            <div className="mt-8 text-sm">
              총 위험성평가 <b>{totals.a}</b>건 · 아차사고 <b>{totals.n}</b>건 · 작업중지 <b>{totals.w}</b>건 · 직원참여 <b>{totals.i}</b>건
            </div>
            <div className="mt-16 text-xs text-gray-500">출력일: {new Date().toLocaleString("ko-KR")}</div>
          </div>
        </section>

        {/* 위험성평가 실시규정 (조직 공통, 1회) */}
        {docTypes.regulation && (() => {
          const overrides = (regulation?.overrides && typeof regulation.overrides === "object")
            ? (regulation.overrides as Record<string, string>) : {};
          const get = (k: string) => overrides[k] ?? REGULATION_DEFAULTS[k] ?? "";
          return (
            <section className="page">
              <RegulationDocument get={get} orgName={orgName} />
            </section>
          );
        })()}

        {complexes.map((c) => {
          const d = dataByComplex[c.id];
          if (!d) return null;
          return (
            <div key={c.id}>
              {/* 단지 표지 */}
              <section className="page">
                <div className="border-b-2 border-black pb-3 mb-6">
                  <div className="text-xs text-gray-600">단지 자료집</div>
                  <h2 className="text-2xl font-bold mt-1">{c.name}</h2>
                  <div className="text-xs mt-1">{c.address ?? ""}</div>
                </div>
                <table className="w-full text-sm border-collapse mb-4">
                  <tbody>
                    <Info label="관리소장" value={c.manager_name} />
                    <Info label="연락처" value={c.manager_phone} />
                    <Info label="위험성평가" value={`${d.assessments.length}건`} />
                    <Info label="아차사고" value={`${d.nearMiss.length}건`} />
                    <Info label="작업중지 행사" value={`${d.workStops.length}건`} />
                    <Info label="직원참여 기록" value={`${d.inputs.length}건`} />
                  </tbody>
                </table>
              </section>

              {/* 위험성평가 (KRAS 양식, 전체 — No.1~N 연속 표) */}
              {docTypes.kras && (() => {
                const allHs = d.assessments.flatMap((a: any) =>
                  d.hazards.filter((h: any) => h.assessment_id === a.id).map((h: any) => ({
                    ...h,
                    measures: d.measures.filter((m: any) => m.hazard_id === h.id),
                    work_name: a.work_name,
                    _method: a.method,
                  }))
                );
                if (allHs.length === 0) return null;
                return (
                  <section className="page kras-page">
                    <header className="text-center border-b-2 border-black pb-4 mb-4">
                      <div className="text-sm text-gray-600">위험성평가표 (KRAS 양식) — 전체</div>
                      <h1 className="text-xl font-bold mt-1">{c.name}</h1>
                      <div className="text-xs mt-1">평가 {d.assessments.length}건 · 유해·위험요인 {allHs.length}건</div>
                    </header>

                    <KrasReportTable workName={c.name} hazards={allHs} />

                    <p className="text-[10px] text-gray-500 mt-4">
                      ※ 관련근거 법적기준은 등록된 유해·위험요인 항목을 기준으로 자동 표시되며, 실제 법령 적용 여부는 별도 검토가 필요합니다.
                    </p>
                  </section>
                );
              })()}


              {/* 아차사고 (건별) */}
              {docTypes.nearMiss && d.nearMiss.map((n: any) => (
                <section key={n.id} className="page">
                  <div className="text-center border-b-2 border-black pb-3 mb-4">
                    <h1 className="text-xl font-bold">아차사고 보고서</h1>
                    <div className="text-xs mt-1">{c.name}</div>
                  </div>
                  <table className="w-full text-sm border-collapse mb-4">
                    <tbody>
                      <Info label="사건/사고명" value={n.incident_name} />
                      <Info label="발생 일시" value={fmtDT(n.occurred_at)} />
                      <Info label="사고 유형" value={n.incident_type} />
                      <Info label="발생 장소" value={[n.location_category, n.location_detail].filter(Boolean).join(" · ")} />
                      <Info label="예상 피해" value={n.potential_severity} />
                    </tbody>
                  </table>
                  <SectionBlock title="① 사고 경위" body={n.situation} photos={Array.isArray(n.photos) ? n.photos : []} photoLabel="사고 현장 사진" />
                  <SectionBlock
                    title={`② 재발 방지 조치 ${n.countermeasure_completed ? "(완료)" : "(진행 중)"}`}
                    body={n.countermeasure || "(조치 내용 미기재)"}
                    photos={Array.isArray(n.countermeasure_photos) ? n.countermeasure_photos : []}
                    photoLabel="조치 사진"
                  />
                </section>
              ))}

              {/* 작업중지 개선완료 확인서 (건별) */}
              {docTypes.workStop && d.workStops.map((w: any) => (
                <section key={w.id} className="page">
                  <div className="text-center border-b-2 border-black pb-3 mb-4">
                    <h1 className="text-xl font-bold">작업중지 개선완료 확인서</h1>
                    <div className="text-xs mt-1">{c.name} · 산업안전보건법 제52조</div>
                  </div>
                  <table className="w-full text-sm border-collapse mb-4">
                    <tbody>
                      <Info label="업체명/작업자" value={[w.contractor_name, w.worker_name].filter(Boolean).join(" / ")} />
                      <Info label="행사 일시" value={fmtDT(w.exercised_at)} />
                      <Info label="처리 결과" value={w.result} />
                      <Info label="행사자" value={`${w.exerciser_name ?? "-"}${w.exerciser_position ? ` (${w.exerciser_position})` : ""}`} />
                      <Info label="관리감독자" value={w.supervisor_name ?? c.manager_name} />
                      <Info label="작업 내용" value={w.work_description} />
                    </tbody>
                  </table>
                  <SectionBlock title="① 작업중지 사유" body={w.stop_reason} photos={Array.isArray(w.cause_photos) ? w.cause_photos : []} photoLabel="중지 원인 사진" />
                  <SectionBlock
                    title="② 시정 조치 및 작업 재개"
                    body={w.result_detail || (w.result === "작업재개" ? "(시정 내용 미기재)" : "※ 미재개")}
                    photos={Array.isArray(w.resolution_photos) ? w.resolution_photos : []}
                    photoLabel="시정 완료 사진"
                  />
                </section>
              ))}

              {/* 작업중지 실적 관리대장 */}
              {docTypes.workStop && d.workStops.length > 0 && (
                <section className="page">
                  <h1 className="text-center text-lg font-bold mb-2">근로자 작업중지 실적 관리대장</h1>
                  <div className="text-sm mb-2">○ 부서명 : {c.name} 관리사무소</div>
                  <div className="text-xs text-right mb-2">기간 : {search.from || "-"} ~ {search.to || "-"} (총 {d.workStops.length}건)</div>
                  <table className="w-full text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-black/70 px-1 py-1 w-16">날짜</th>
                        <th className="border border-black/70 px-1 py-1">사업/작업</th>
                        <th className="border border-black/70 px-1 py-1 w-24">요청자</th>
                        <th className="border border-black/70 px-1 py-1 w-24">조치자</th>
                        <th className="border border-black/70 px-1 py-1">사유</th>
                        <th className="border border-black/70 px-1 py-1">조치내용</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.workStops.map((it: any) => (
                        <tr key={it.id} className="align-top">
                          <td className="border border-black/70 px-1 py-1 text-center">{fmtD(it.exercised_at)}</td>
                          <td className="border border-black/70 px-1 py-1 whitespace-pre-wrap">{it.work_description}</td>
                          <td className="border border-black/70 px-1 py-1">{it.exerciser_name}</td>
                          <td className="border border-black/70 px-1 py-1">{it.supervisor_name ?? c.manager_name ?? "-"}</td>
                          <td className="border border-black/70 px-1 py-1 whitespace-pre-wrap">{it.stop_reason}</td>
                          <td className="border border-black/70 px-1 py-1 whitespace-pre-wrap">{it.result_detail || (it.result === "작업재개" ? "-" : "(처리 중)")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}

              {/* 청취조사 (건별) */}
              {docTypes.hearing && d.inputs.filter((it: any) => it.input_type === "hearing").map((it: any) => (
                <section key={it.id} className="page">
                  <HearingReportSheet item={it} complexName={c.name} />
                </section>
              ))}

              {/* 오픈채팅 이력 (건별) */}
              {docTypes.openchat && d.inputs.filter((it: any) => it.input_type !== "hearing").map((it: any) => (
                <section key={it.id} className="page">
                  <OpenChatReportSheet item={it} complexName={c.name} />
                </section>
              ))}
            </div>
          );
        })}
      </div>

      <style>{`
        .page { break-after: page; page-break-after: always; min-height: 260mm; }
        .page:last-child { break-after: auto; page-break-after: auto; }
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          @page kras { size: A4 landscape; margin: 10mm; }
          .kras-page { page: kras; }
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
          .print\\:hidden { display: none !important; }
          img { break-inside: avoid; page-break-inside: avoid; }
          table, tr, td, th { break-inside: avoid; page-break-inside: avoid; }
          .kras-table, .kras-table tr, .kras-table td, .kras-table th { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: any }) {
  return (
    <tr className="border border-black/70">
      <th className="bg-gray-100 px-2 py-1.5 w-32 text-left border-r border-black/70">{label}</th>
      <td className="px-2 py-1.5">{value || "-"}</td>
    </tr>
  );
}

function SectionBlock({ title, body, photos, photoLabel }: { title: string; body?: string; photos: string[]; photoLabel: string }) {
  return (
    <section className="mb-4">
      <h3 className="font-bold text-sm bg-gray-100 px-2 py-1 border border-black/70">{title}</h3>
      <div className="border border-t-0 border-black/70 p-3 text-sm whitespace-pre-wrap min-h-[50px]">{body || "-"}</div>
      {photos.length > 0 && (
        <div className="border border-t-0 border-black/70 p-3">
          <div className="text-xs font-semibold mb-2">{photoLabel} ({photos.length}장)</div>
          <div className="grid grid-cols-2 gap-2">
            {photos.slice(0, 6).map((u, i) => (
              <SignedImg key={i} src={u} alt={`${photoLabel}-${i + 1}`} className="w-full h-36 object-cover border border-black/30" crossOrigin="anonymous" />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

type Approval = {
  drafter_name: string; reviewer_name: string; approver_name: string;
  drafter_signed_at: string; reviewer_signed_at: string; approver_signed_at: string;
};
const APPROVAL_ROLES: { key: keyof Approval; nameKey: keyof Approval; label: string }[] = [
  { key: "drafter_signed_at", nameKey: "drafter_name", label: "담당" },
  { key: "reviewer_signed_at", nameKey: "reviewer_name", label: "검토" },
  { key: "approver_signed_at", nameKey: "approver_name", label: "승인" },
];

function ReportText({ value, height }: { value?: string; height: string }) {
  return (
    <div style={{ height, overflow: "hidden", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {value || ""}
    </div>
  );
}

const SHEET_STYLES = `
  .print-sheet { font-family: 'Malgun Gothic', system-ui, sans-serif; color: #000; width: 100%; }
  .print-sheet .hr-title { text-align: center; font-size: 16pt; font-weight: 800; margin: 0; }
  .print-sheet .hr-subtitle { text-align: center; font-size: 8pt; margin: 1mm 0 0; color: #333; }
  .print-sheet .hr-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .print-sheet .hr-table th, .print-sheet .hr-table td { border: 1px solid #111; padding: 1.2mm 2mm; vertical-align: middle; box-sizing: border-box; font-size: 9pt; line-height: 1.2; }
  .print-sheet .hr-label { background: #f1f1f1; text-align: center; font-weight: 700; }
  .print-sheet .hr-content { white-space: pre-wrap; word-break: break-word; overflow: hidden; vertical-align: top !important; }
  .print-sheet .hr-small { font-size: 7.5pt; color: #444; }
  .print-sheet .hr-photo-row { display: flex; gap: 2mm; width: 100%; height: 100%; }
  .print-sheet .hr-photo-box { flex: 1 1 0; min-width: 0; height: 100%; border: 1px solid #555; background: #fafafa; display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .print-sheet .hr-photo-box img { width: 100%; height: 100%; object-fit: contain; display: block; }
  .print-sheet .hr-photo-empty { color: #aaa; font-size: 8pt; }
`;

function ApprovalHeader({ title, subtitle, a }: { title: string; subtitle: string; a?: Approval }) {
  return (
    <table className="hr-table" style={{ height: "26mm", marginBottom: "2mm" }}>
      <tbody>
        <tr>
          <td style={{ border: "none", padding: 0 }}>
            <h1 className="hr-title">{title}</h1>
            <p className="hr-subtitle">{subtitle}</p>
          </td>
          <td style={{ border: "none", padding: 0, width: "66mm", verticalAlign: "top" }}>
            <table className="hr-table" style={{ height: "24mm" }}>
              <tbody>
                <tr style={{ height: "6mm" }}>
                  <th className="hr-label" rowSpan={2} style={{ width: "9mm", padding: "1mm", writingMode: "vertical-rl" }}>결재</th>
                  {APPROVAL_ROLES.map(r => <th key={r.label} className="hr-label">{r.label}</th>)}
                </tr>
                <tr>
                  {APPROVAL_ROLES.map(({ key, nameKey, label }) => (
                    <td key={label} style={{ textAlign: "center", height: "18mm", padding: "1mm" }}>
                      <div style={{ minHeight: "8mm", fontWeight: 700 }}>{(a?.[nameKey] as string) || ""}</div>
                      <div className="hr-small">{a?.[key] ? new Date(a[key] as string).toLocaleDateString("ko-KR") : ""}</div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function PhotoStrip({ photos, label }: { photos: string[]; label: string }) {
  return (
    <table className="hr-table" style={{ height: "38mm", marginTop: "2mm" }}>
      <tbody>
        <tr>
          <th className="hr-label" style={{ width: "24mm" }}>{label}</th>
          <td style={{ padding: "1.5mm", height: "38mm" }}>
            <div className="hr-photo-row">
              {Array.from({ length: 4 }).map((_, i) => {
                const url = photos[i];
                return (
                  <div key={i} className="hr-photo-box">
                    {url ? <SignedImg src={url} alt={`${label} ${i + 1}`} crossOrigin="anonymous" /> : <span className="hr-photo-empty">사진 {i + 1}</span>}
                  </div>
                );
              })}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function HearingReportSheet({ item, complexName }: { item: any; complexName: string }) {
  const m = item.meta ?? {};
  const a: Approval | undefined = m.approval;
  const occurred = new Date(item.occurred_at);
  const dateStr = occurred.toLocaleDateString("ko-KR");
  const timeStr = occurred.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  const photos: string[] = item.attachments ?? [];
  return (
    <div className="print-sheet">
      <style>{SHEET_STYLES}</style>
      <ApprovalHeader title="청취조사에 의한 유해·위험요인 조사표" subtitle="산업안전보건법 제36조 제2항 · 근로자 의견 청취 기록" a={a} />
      <table className="hr-table" style={{ height: "26mm" }}>
        <tbody>
          <tr style={{ height: "8mm" }}>
            <th className="hr-label" style={{ width: "24mm" }}>단지</th>
            <td>{complexName || "-"}</td>
            <th className="hr-label" style={{ width: "24mm" }}>수행일시</th>
            <td>{dateStr} {timeStr}</td>
          </tr>
          <tr style={{ height: "8mm" }}>
            <th className="hr-label">수행자</th>
            <td>{m.conductor_name || "-"}</td>
            <th className="hr-label">근로자</th>
            <td>{m.worker_name || "-"}</td>
          </tr>
          <tr style={{ height: "10mm" }}>
            <th className="hr-label">실시방법</th>
            <td colSpan={3}>위험성평가 수행자가 현장 근로자와 면담을 통해 직접 경험한 유해·위험요인을 조사</td>
          </tr>
        </tbody>
      </table>
      <table className="hr-table" style={{ height: "168mm", marginTop: "2mm" }}>
        <tbody>
          {[1, 2, 3].map(n => (
            <tr key={n} style={{ height: "28mm" }}>
              <th className="hr-label" style={{ width: "24mm" }}>경험담 {n}</th>
              <td className="hr-content"><ReportText value={m[`experience_${n}`]} height="24mm" /></td>
            </tr>
          ))}
          <tr style={{ height: "38mm" }}>
            <th className="hr-label">근로자 의견<br/><span className="hr-small">(원인·반성)</span></th>
            <td className="hr-content"><ReportText value={m.worker_opinion} height="34mm" /></td>
          </tr>
          <tr style={{ height: "46mm" }}>
            <th className="hr-label">수행자 의견<br/><span className="hr-small">(조언)</span></th>
            <td className="hr-content"><ReportText value={m.conductor_opinion} height="42mm" /></td>
          </tr>
        </tbody>
      </table>
      <PhotoStrip photos={photos} label="첨부사진" />
    </div>
  );
}

function OpenChatReportSheet({ item, complexName }: { item: any; complexName: string }) {
  const m = item.meta ?? {};
  const a: Approval | undefined = m.approval;
  const occurred = new Date(item.occurred_at);
  const dateStr = occurred.toLocaleDateString("ko-KR");
  const timeStr = occurred.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  const photos: string[] = item.attachments ?? [];
  return (
    <div className="print-sheet">
      <style>{SHEET_STYLES}</style>
      <ApprovalHeader title="오픈채팅 이력 기록표" subtitle="단지 오픈채팅 안전 관련 대화 이력 · 근로자 의견 수렴" a={a} />
      <table className="hr-table" style={{ height: "26mm" }}>
        <tbody>
          <tr style={{ height: "8mm" }}>
            <th className="hr-label" style={{ width: "24mm" }}>단지</th>
            <td>{complexName || "-"}</td>
            <th className="hr-label" style={{ width: "24mm" }}>일시</th>
            <td>{dateStr} {timeStr}</td>
          </tr>
          <tr style={{ height: "8mm" }}>
            <th className="hr-label">채팅방명</th>
            <td>{m.room_name || "-"}</td>
            <th className="hr-label">작성자</th>
            <td>{m.author_name || "-"}</td>
          </tr>
          <tr style={{ height: "10mm" }}>
            <th className="hr-label">수집방법</th>
            <td colSpan={3}>단지 오픈채팅방에 공유된 안전 관련 대화·의견을 수집하여 기록</td>
          </tr>
        </tbody>
      </table>
      <table className="hr-table" style={{ height: "168mm", marginTop: "2mm" }}>
        <tbody>
          <tr style={{ height: "168mm" }}>
            <th className="hr-label" style={{ width: "24mm" }}>대화 내용<br/><span className="hr-small">(요약)</span></th>
            <td className="hr-content"><ReportText value={m.summary ?? item.content} height="164mm" /></td>
          </tr>
        </tbody>
      </table>
      <PhotoStrip photos={photos} label="첨부 캡처" />
    </div>
  );
}
