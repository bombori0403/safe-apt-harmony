import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_app/work-stop-records_/$id")({
  component: WorkStopRecordDetail,
});

function WorkStopRecordDetail() {
  const { id } = useParams({ from: "/_app/work-stop-records_/$id" });
  const [rec, setRec] = useState<any>(null);
  const [complex, setComplex] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("work_stop_records").select("*").eq("id", id).maybeSingle();
      setRec(data);
      if (data?.complex_id) {
        const { data: c } = await supabase.from("complexes").select("name,address,manager_name,manager_phone").eq("id", data.complex_id).maybeSingle();
        setComplex(c);
      }
    })();
  }, [id]);

  if (!rec) return <div className="p-8 text-sm text-muted-foreground">불러오는 중...</div>;

  const causePhotos: string[] = Array.isArray(rec.cause_photos) ? rec.cause_photos : [];
  const resPhotos: string[] = Array.isArray(rec.resolution_photos) ? rec.resolution_photos : [];
  const isResumed = rec.result === "작업재개";

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Link to="/work-stop-records"><Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="h-4 w-4"/>목록</Button></Link>
        <Button onClick={() => window.print()} className="gap-1.5"><Printer className="h-4 w-4"/>인쇄 / PDF 저장</Button>
      </div>

      <div id="print-area" className="bg-white text-black border rounded-md p-6 print:border-0 print:p-0 print:shadow-none">
        <div className="text-center border-b-2 border-black pb-3 mb-4">
          <h1 className="text-xl font-bold">작업중지권 행사 기록서</h1>
          <p className="text-xs mt-1">산업안전보건법 제52조에 따른 작업중지권 행사 사실 기록</p>
        </div>

        <table className="w-full text-sm border-collapse mb-4">
          <tbody>
            <tr className="border border-black/70">
              <th className="bg-gray-100 px-2 py-1.5 w-28 text-left border-r border-black/70">단지명</th>
              <td className="px-2 py-1.5 border-r border-black/70" colSpan={3}>{complex?.name ?? "-"}</td>
            </tr>
            <tr className="border border-black/70">
              <th className="bg-gray-100 px-2 py-1.5 text-left border-r border-black/70">소재지</th>
              <td className="px-2 py-1.5" colSpan={3}>{complex?.address ?? "-"}</td>
            </tr>
            <tr className="border border-black/70">
              <th className="bg-gray-100 px-2 py-1.5 text-left border-r border-black/70">행사 일시</th>
              <td className="px-2 py-1.5 border-r border-black/70">{new Date(rec.exercised_at).toLocaleString("ko-KR")}</td>
              <th className="bg-gray-100 px-2 py-1.5 text-left border-r border-black/70 w-28">처리 결과</th>
              <td className="px-2 py-1.5 font-semibold">{rec.result}</td>
            </tr>
            <tr className="border border-black/70">
              <th className="bg-gray-100 px-2 py-1.5 text-left border-r border-black/70">행사자</th>
              <td className="px-2 py-1.5 border-r border-black/70">{rec.exerciser_name}{rec.exerciser_position ? ` (${rec.exerciser_position})` : ""}</td>
              <th className="bg-gray-100 px-2 py-1.5 text-left border-r border-black/70">관리감독자</th>
              <td className="px-2 py-1.5">{complex?.manager_name ?? "-"}{complex?.manager_phone ? ` / ${complex.manager_phone}` : ""}</td>
            </tr>
            <tr className="border border-black/70">
              <th className="bg-gray-100 px-2 py-1.5 text-left border-r border-black/70 align-top">작업 내용</th>
              <td className="px-2 py-1.5 whitespace-pre-wrap" colSpan={3}>{rec.work_description}</td>
            </tr>
          </tbody>
        </table>

        <section className="mb-4">
          <h2 className="font-bold text-sm bg-gray-100 px-2 py-1 border border-black/70">① 작업중지 사유</h2>
          <div className="border border-t-0 border-black/70 p-3 text-sm whitespace-pre-wrap min-h-[60px]">{rec.stop_reason}</div>
          {causePhotos.length > 0 && (
            <div className="border border-t-0 border-black/70 p-3">
              <div className="text-xs font-semibold mb-2">중지 원인 사진 ({causePhotos.length}장)</div>
              <div className="grid grid-cols-2 gap-2">
                {causePhotos.map((u, i) => (
                  <img key={i} src={u} alt={`원인-${i+1}`} className="w-full h-40 object-cover border border-black/30" crossOrigin="anonymous" />
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="mb-4">
          <h2 className="font-bold text-sm bg-gray-100 px-2 py-1 border border-black/70">② 시정 조치 및 작업 재개</h2>
          <div className="border border-t-0 border-black/70 p-3 text-sm whitespace-pre-wrap min-h-[60px]">
            {rec.result_detail || (isResumed ? "(시정 내용 미기재)" : "※ 아직 작업 재개 처리되지 않았습니다.")}
          </div>
          {resPhotos.length > 0 ? (
            <div className="border border-t-0 border-black/70 p-3">
              <div className="text-xs font-semibold mb-2">시정 완료 / 작업 재개 사진 ({resPhotos.length}장)</div>
              <div className="grid grid-cols-2 gap-2">
                {resPhotos.map((u, i) => (
                  <img key={i} src={u} alt={`재개-${i+1}`} className="w-full h-40 object-cover border border-black/30" crossOrigin="anonymous" />
                ))}
              </div>
            </div>
          ) : (
            <div className="border border-t-0 border-black/70 p-3 text-xs text-gray-600">시정/재개 사진 없음</div>
          )}
        </section>

        <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div className="border border-black/70 p-3">
            <div className="text-xs text-gray-700 mb-6">행사자 확인</div>
            <div className="text-right">{rec.exerciser_name} (인)</div>
          </div>
          <div className="border border-black/70 p-3">
            <div className="text-xs text-gray-700 mb-6">관리감독자 확인</div>
            <div className="text-right">{complex?.manager_name ?? "________"} (인)</div>
          </div>
        </div>

        <p className="text-[10px] text-gray-600 mt-3 leading-relaxed">
          ※ 본 기록은 산업안전보건법 제52조에 따라 근로자가 산업재해 발생의 급박한 위험을 인지하여 작업을 중지·대피한 사실과 그에 따른 사업주의 안전조치 및 작업재개 사실을 함께 기록한 문서입니다.
        </p>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
