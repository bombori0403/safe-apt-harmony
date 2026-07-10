import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { KrasReportTable, KRAS_PRINT_STYLE } from "@/components/kras-report-table";

export const Route = createFileRoute("/_app/kras-report-all")({
  validateSearch: (s: Record<string, unknown>) => ({
    complexId: typeof s.complexId === "string" ? s.complexId : undefined,
    type: typeof s.type === "string" ? s.type : undefined,
    q: typeof s.q === "string" ? s.q : undefined,
  }),
  component: KrasReportAll,
});

function KrasReportAll() {
  const { complexId, type, q } = Route.useSearch();
  const [assessments, setAssessments] = useState<any[]>([]);
  const [hazardsByAssessment, setHazardsByAssessment] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      let query = supabase.from("assessments").select("*").order("assessment_date", { ascending: false });
      if (complexId) query = query.eq("complex_id", complexId);
      if (type) query = query.eq("assessment_type", type);
      const { data: ass } = await query;
      let list = ass ?? [];
      if (q) list = list.filter((a) => a.work_name?.includes(q));
      setAssessments(list);

      if (list.length > 0) {
        const ids = list.map((a) => a.id);
        const { data: h } = await supabase
          .from("hazards")
          .select("*, measures(*), hazard_library:library_item_id(article_no, legal_basis)")
          .in("assessment_id", ids)
          .order("created_at", { ascending: true });
        const grouped: Record<string, any[]> = {};
        (h ?? []).forEach((row) => {
          (grouped[row.assessment_id] ??= []).push(row);
        });
        setHazardsByAssessment(grouped);
      }
      setLoading(false);
    })();
  }, [complexId, type, q]);

  return (
    <div className="bg-white text-foreground">
      <div className="print:hidden p-4 max-w-6xl mx-auto flex justify-between items-center border-b">
        <Link to="/history"><Button variant="outline" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />평가 이력으로</Button></Link>
        <Button onClick={() => window.print()} className="gap-2" disabled={loading || assessments.length === 0}>
          <Printer className="h-4 w-4" />PDF 저장 / 인쇄
        </Button>
      </div>

      <div className="max-w-6xl mx-auto p-8 print:p-0 print:max-w-none">
        {loading ? (
          <p className="text-muted-foreground">불러오는 중...</p>
        ) : assessments.length === 0 ? (
          <p className="text-muted-foreground">출력할 평가 이력이 없습니다.</p>
        ) : (
          <>
            <header className="text-center border-b-2 border-foreground pb-4 mb-6">
              <div className="text-sm text-muted-foreground">위험성평가표 (KRAS 양식) — 전체 이력</div>
              <h1 className="text-2xl font-bold mt-1">총 {assessments.length}건</h1>
            </header>

            <KrasReportTable
              workName=""
              hazards={assessments.flatMap((a) =>
                (hazardsByAssessment[a.id] ?? []).map((h) => ({ ...h, work_name: a.work_name }))
              )}
            />

            <p className="text-[10px] text-muted-foreground mt-4">
              ※ 관련근거 법적기준은 등록된 유해·위험요인 항목을 기준으로 자동 표시되며, 실제 법령 적용 여부는 별도 검토가 필요합니다.
            </p>
          </>
        )}
      </div>

      <style>{KRAS_PRINT_STYLE}</style>
    </div>
  );
}
