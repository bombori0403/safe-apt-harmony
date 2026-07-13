import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { KrasReportTable, KRAS_PRINT_STYLE } from "@/components/kras-report-table";

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

        <KrasReportTable workName={a.work_name} hazards={hazards} method={a.method} />

        <p className="text-[10px] text-muted-foreground mt-4">
          ※ 관련근거 법적기준은 등록된 유해·위험요인 항목을 기준으로 자동 표시되며, 실제 법령 적용 여부는 별도 검토가 필요합니다.
        </p>
      </div>

      <style>{KRAS_PRINT_STYLE}</style>
    </div>
  );
}
