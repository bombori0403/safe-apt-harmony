import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { riskLevelClass, scoreToRiskLevel } from "@/lib/types";

export const Route = createFileRoute("/_app/assessment/$id/kras-report")({
  component: KrasReport,
});

function KrasReport() {
  const { id } = Route.useParams();
  const [a, setA] = useState<any>(null);
  const [hazards, setHazards] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: ass } = await supabase.from("assessments").select("*").eq("id", id).maybeSingle();
      setA(ass);
      const { data: h } = await supabase
        .from("hazards")
        .select("*, measures(*), hazard_library:library_item_id(article_no, legal_basis)")
        .eq("assessment_id", id)
        .order("created_at", { ascending: true });
      setHazards(h ?? []);
    })();
  }, [id]);

  if (!a) return <div className="p-8 text-muted-foreground">불러오는 중...</div>;

  return (
    <div className="bg-white text-foreground">
      <div className="print:hidden p-4 max-w-6xl mx-auto flex justify-between items-center border-b">
        <Link to="/assessment/$id/report" params={{ id }}><Button variant="outline" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />결과서로 돌아가기</Button></Link>
        <Button onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" />PDF 저장 / 인쇄</Button>
      </div>

      <div className="max-w-6xl mx-auto p-8 print:p-0 print:max-w-none">
        <header className="text-center border-b-2 border-foreground pb-4 mb-6">
          <div className="text-sm text-muted-foreground">위험성평가표 (KRAS 양식)</div>
          <h1 className="text-2xl font-bold mt-1">{a.work_name}</h1>
          <div className="text-sm mt-2">평가일: {a.assessment_date ?? "-"}</div>
        </header>

        <table className="w-full text-[11px] border-collapse kras-table">
          <thead>
            <tr className="border-b-2 border-foreground">
              <th rowSpan={2} className="border p-1 w-8">No.</th>
              <th rowSpan={2} className="border p-1 w-20">공정명</th>
              <th rowSpan={2} className="border p-1">위험발생상황 및 결과<br />(유해위험요인 파악)</th>
              <th colSpan={3} className="border p-1">현재위험성</th>
              <th rowSpan={2} className="border p-1">위험성 감소대책</th>
              <th colSpan={3} className="border p-1">감소대책 실행</th>
              <th colSpan={3} className="border p-1">개선 후 위험성</th>
              <th colSpan={2} className="border p-1">관련근거 법적기준</th>
            </tr>
            <tr className="border-b-2 border-foreground">
              <th className="border p-1 w-8">가능성<br />(빈도)</th>
              <th className="border p-1 w-8">중대성<br />(강도)</th>
              <th className="border p-1 w-10">위험성</th>
              <th className="border p-1 w-16">개선예정일</th>
              <th className="border p-1 w-16">개선완료일</th>
              <th className="border p-1 w-14">담당자</th>
              <th className="border p-1 w-8">가능성<br />(빈도)</th>
              <th className="border p-1 w-8">중대성<br />(강도)</th>
              <th className="border p-1 w-10">위험성</th>
              <th className="border p-1 w-10">조문번호</th>
              <th className="border p-1">법적기준</th>
            </tr>
          </thead>
          <tbody>
            {hazards.map((h, i) => {
              const score = h.likelihood && h.severity ? h.likelihood * h.severity : null;
              const postScore = h.post_likelihood && h.post_severity ? h.post_likelihood * h.post_severity : null;
              const postLevel = postScore ? scoreToRiskLevel(postScore) : null;
              const measures = h.measures ?? [];
              const legalBasis = h.legal_basis_override || h.hazard_library?.legal_basis || "-";
              const articleNo = h.hazard_library?.article_no || "-";
              return (
                <tr key={h.id} className="align-top">
                  <td className="border p-1 text-center">{i + 1}</td>
                  <td className="border p-1">{a.work_name}</td>
                  <td className="border p-1">{h.description}</td>
                  <td className="border p-1 text-center">{h.likelihood ?? "-"}</td>
                  <td className="border p-1 text-center">{h.severity ?? "-"}</td>
                  <td className="border p-1 text-center">
                    {h.level ? <span className={`px-1 py-0.5 rounded ${riskLevelClass(h.level)}`}>{score ?? h.level}</span> : "-"}
                  </td>
                  <td className="border p-1">
                    {measures.length === 0 ? "-" : measures.map((m: any, mi: number) => (
                      <div key={m.id} className={mi > 0 ? "border-t mt-1 pt-1" : ""}>{m.content}</div>
                    ))}
                  </td>
                  <td className="border p-1">
                    {measures.length === 0 ? "-" : measures.map((m: any, mi: number) => (
                      <div key={m.id} className={mi > 0 ? "border-t mt-1 pt-1" : ""}>{m.due_date ?? "-"}</div>
                    ))}
                  </td>
                  <td className="border p-1">
                    {measures.length === 0 ? "-" : measures.map((m: any, mi: number) => (
                      <div key={m.id} className={mi > 0 ? "border-t mt-1 pt-1" : ""}>{m.completed_at ? new Date(m.completed_at).toLocaleDateString("ko-KR") : "-"}</div>
                    ))}
                  </td>
                  <td className="border p-1">
                    {measures.length === 0 ? "-" : measures.map((m: any, mi: number) => (
                      <div key={m.id} className={mi > 0 ? "border-t mt-1 pt-1" : ""}>{m.responsible_name ?? "-"}</div>
                    ))}
                  </td>
                  <td className="border p-1 text-center">{h.post_likelihood ?? "-"}</td>
                  <td className="border p-1 text-center">{h.post_severity ?? "-"}</td>
                  <td className="border p-1 text-center">
                    {postLevel ? <span className={`px-1 py-0.5 rounded ${riskLevelClass(postLevel)}`}>{postScore}</span> : "-"}
                  </td>
                  <td className="border p-1 text-center">{articleNo}</td>
                  <td className="border p-1">{legalBasis}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <p className="text-[10px] text-muted-foreground mt-4">
          ※ 관련근거 법적기준은 등록된 유해·위험요인 항목을 기준으로 자동 표시되며, 실제 법령 적용 여부는 별도 검토가 필요합니다.
        </p>
      </div>

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body { background: white; }
          .kras-table, .kras-table tr, .kras-table td, .kras-table th {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
