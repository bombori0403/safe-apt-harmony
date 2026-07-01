import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Loader2 } from "lucide-react";
import { getCurrentUserContext } from "@/lib/user-context";
import { useAuth } from "@/hooks/use-auth";
import { WORK_STOP_LAW_TITLE, WORK_STOP_LAW_TEXT, WORK_STOP_PROCEDURE } from "@/lib/work-stop-law";
import { riskLevelClass, type RiskLevel } from "@/lib/types";

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
  const search = Route.useSearch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [complexes, setComplexes] = useState<any[]>([]);
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
          allowedIds = complexId ? [complexId] : [];
          if (targetComplex && !allowedIds.includes(targetComplex)) {
            setError("해당 단지에 대한 권한이 없습니다.");
            setLoading(false); return;
          }
          if (targetComplex) allowedIds = [targetComplex];
        }

        if (allowedIds.length === 0) {
          setError("표시할 단지가 없습니다.");
          setLoading(false); return;
        }

        const { data: cs } = await supabase.from("complexes")
          .select("id,name,address,manager_name,manager_phone")
          .in("id", allowedIds).order("name");
        setComplexes(cs ?? []);

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
          if (aIds.length) {
            const { data: h } = await supabase.from("hazards").select("*").in("assessment_id", aIds);
            hazards = h ?? [];
            const hIds = hazards.map((h: any) => h.id);
            if (hIds.length) {
              const { data: m } = await supabase.from("measures").select("*").in("hazard_id", hIds);
              measures = m ?? [];
            }
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

  const totals = Object.values(dataByComplex).reduce((acc, d) => ({
    a: acc.a + d.assessments.length, n: acc.n + d.nearMiss.length,
    w: acc.w + d.workStops.length, i: acc.i + d.inputs.length,
  }), { a: 0, n: 0, w: 0, i: 0 });

  return (
    <div className="bg-white text-black">
      <div className="print:hidden p-4 max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-2 border-b">
        <Link to="/dashboard"><Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="h-4 w-4" />대시보드</Button></Link>
        <div className="text-sm text-muted-foreground">
          {complexes.length}개 단지 · 위험성평가 {totals.a} · 아차사고 {totals.n} · 작업중지 {totals.w} · 직원참여 {totals.i}
        </div>
        <Button onClick={() => window.print()} className="gap-1.5"><Printer className="h-4 w-4" />전체 인쇄 / PDF 저장</Button>
      </div>

      <div id="print-area" className="max-w-[210mm] mx-auto p-8 print:p-0 print:max-w-none">
        {/* 전체 표지 */}
        <section className="page">
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="text-sm text-gray-600">공동주택 안전보건 통합 자료집</div>
            <h1 className="text-3xl font-bold mt-3">위험성평가 · 아차사고 · 작업중지 통합 출력</h1>
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

              {/* 위험성평가 결과서 (건별) */}
              {d.assessments.map((a: any) => {
                const hs = d.hazards.filter((h: any) => h.assessment_id === a.id);
                return (
                  <section key={a.id} className="page">
                    <div className="text-center border-b-2 border-black pb-3 mb-4">
                      <h1 className="text-xl font-bold">위험성평가 결과서</h1>
                      <div className="text-xs mt-1">{c.name} · 산업안전보건법 제36조</div>
                    </div>
                    <table className="w-full text-sm border-collapse mb-4">
                      <tbody>
                        <Info label="평가명" value={a.work_name} />
                        <Info label="평가종류" value={a.assessment_type} />
                        <Info label="평가일" value={a.assessment_date} />
                        <Info label="평가방법" value={a.method} />
                        <Info label="작업 카테고리" value={a.work_category} />
                        <Info label="상태" value={a.status} />
                      </tbody>
                    </table>
                    <h3 className="font-semibold text-sm bg-gray-100 border border-black/70 px-2 py-1">유해·위험요인 및 감소대책</h3>
                    <table className="w-full text-xs border-collapse border border-black/70 border-t-0">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-black/70 px-1.5 py-1 w-8">#</th>
                          <th className="border border-black/70 px-1.5 py-1">유해·위험요인</th>
                          <th className="border border-black/70 px-1.5 py-1 w-20">위험성</th>
                          <th className="border border-black/70 px-1.5 py-1">감소대책</th>
                          <th className="border border-black/70 px-1.5 py-1 w-16">상태</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hs.length === 0 ? (
                          <tr><td colSpan={5} className="border border-black/70 px-2 py-3 text-center text-gray-500">유해요인 없음</td></tr>
                        ) : hs.map((h: any, i: number) => {
                          const ms = d.measures.filter((m: any) => m.hazard_id === h.id);
                          if (ms.length === 0) {
                            return (
                              <tr key={h.id}>
                                <td className="border border-black/70 px-1.5 py-1 text-center">{i + 1}</td>
                                <td className="border border-black/70 px-1.5 py-1">{h.description}</td>
                                <td className="border border-black/70 px-1.5 py-1 text-center">{h.level ?? "-"}</td>
                                <td className="border border-black/70 px-1.5 py-1 text-gray-500">-</td>
                                <td className="border border-black/70 px-1.5 py-1 text-center">-</td>
                              </tr>
                            );
                          }
                          return ms.map((m: any, mi: number) => (
                            <tr key={m.id}>
                              {mi === 0 && <td rowSpan={ms.length} className="border border-black/70 px-1.5 py-1 text-center align-top">{i + 1}</td>}
                              {mi === 0 && <td rowSpan={ms.length} className="border border-black/70 px-1.5 py-1 align-top">{h.description}</td>}
                              {mi === 0 && <td rowSpan={ms.length} className="border border-black/70 px-1.5 py-1 text-center align-top">{h.level ?? "-"}</td>}
                              <td className="border border-black/70 px-1.5 py-1">{m.content}</td>
                              <td className="border border-black/70 px-1.5 py-1 text-center">{m.status ?? "-"}</td>
                            </tr>
                          ));
                        })}
                      </tbody>
                    </table>
                  </section>
                );
              })}

              {/* 아차사고 (건별) */}
              {d.nearMiss.map((n: any) => (
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
              {d.workStops.map((w: any) => (
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
              {d.workStops.length > 0 && (
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

              {/* 직원참여 (건별) */}
              {d.inputs.map((it: any) => {
                const photos: string[] = Array.isArray((it.meta as any)?.photos) ? (it.meta as any).photos : [];
                return (
                  <section key={it.id} className="page">
                    <div className="text-center border-b-2 border-black pb-3 mb-4">
                      <h1 className="text-xl font-bold">{it.input_type === "hearing" ? "청취조사 결과서" : "오픈채팅 이력 요약"}</h1>
                      <div className="text-xs mt-1">{c.name}</div>
                    </div>
                    <table className="w-full text-sm border-collapse mb-4">
                      <tbody>
                        <Info label="일시" value={fmtDT(it.occurred_at)} />
                        <Info label="응답자/채팅방" value={[it.respondent_name, it.respondent_role].filter(Boolean).join(" / ")} />
                      </tbody>
                    </table>
                    <SectionBlock title="내용" body={it.content} photos={photos} photoLabel="첨부 사진" />
                  </section>
                );
              })}
            </div>
          );
        })}

        {/* 부록 */}
        <section className="page">
          <h2 className="font-bold border-b pb-1 mb-3 text-lg">[부록] {WORK_STOP_LAW_TITLE}</h2>
          <pre className="whitespace-pre-wrap text-xs leading-relaxed font-sans">{WORK_STOP_LAW_TEXT}</pre>
          <p className="text-[10px] text-gray-500 mt-4">본 자료는 산업안전보건법 시행규칙 제37조에 따라 5년간 보존됩니다.</p>
        </section>
      </div>

      <style>{`
        .page { break-after: page; page-break-after: always; min-height: 260mm; }
        .page:last-child { break-after: auto; page-break-after: auto; }
        @media print {
          @page { size: A4; margin: 12mm; }
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
          .print\\:hidden { display: none !important; }
          img { break-inside: avoid; page-break-inside: avoid; }
          table, tr, td, th { break-inside: avoid; page-break-inside: avoid; }
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
              <img key={i} src={u} alt={`${photoLabel}-${i + 1}`} className="w-full h-36 object-cover border border-black/30" crossOrigin="anonymous" />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
