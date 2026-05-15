import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, FileText } from "lucide-react";
import { WORK_STOP_LAW_TITLE, WORK_STOP_LAW_TEXT, WORK_STOP_PROCEDURE } from "@/lib/work-stop-law";

export const Route = createFileRoute("/_app/work-stop-right")({
  component: WorkStopRight,
});

function WorkStopRight() {
  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-md bg-primary/10 text-primary"><ShieldAlert className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-bold">작업중지권 안내</h1>
          <p className="text-sm text-muted-foreground mt-1">산업재해가 발생할 급박한 위험이 있을 때 누구나 작업을 중지할 권리가 있습니다.</p>
        </div>
      </div>

      <Card><CardContent className="p-5 space-y-3">
        <h2 className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4" />{WORK_STOP_LAW_TITLE}</h2>
        <pre className="whitespace-pre-wrap text-sm leading-relaxed bg-muted/40 rounded-md p-4 font-sans">{WORK_STOP_LAW_TEXT}</pre>
      </CardContent></Card>

      <Card><CardContent className="p-5 space-y-3">
        <h2 className="font-semibold">행사 절차</h2>
        <ol className="space-y-2 text-sm">
          {WORK_STOP_PROCEDURE.map((p,i) => (<li key={i} className="leading-relaxed">{p}</li>))}
        </ol>
      </CardContent></Card>

      <Card><CardContent className="p-5 space-y-2">
        <h2 className="font-semibold">근로자 보호 조항</h2>
        <p className="text-sm leading-relaxed">
          사업주는 산업재해가 발생할 급박한 위험이 있다고 근로자가 믿을 만한 합리적인 이유가 있을 때에는,
          작업을 중지하고 대피한 근로자에 대하여 <strong>해고나 그 밖의 불리한 처우를 하여서는 안 됩니다</strong>
          (산업안전보건법 제52조 제4항).
        </p>
      </CardContent></Card>

      <div className="flex justify-end">
        <Link to="/work-stop-records"><Button>행사 기록 보기 / 등록</Button></Link>
      </div>
    </div>
  );
}
