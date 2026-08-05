import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";
import { TrialWatermark } from "@/components/trial-watermark";
import { RegulationDocument } from "@/components/regulation-document";

export const Route = createFileRoute("/_app/regulation")({
  component: RegulationPage,
});

function RegulationPage() {
  const sub = useSubscription();
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {sub.isTrial && <TrialWatermark expired={sub.isExpired} />}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">위험성평가 실시규정</h1>
          <p className="text-sm text-muted-foreground mt-1">
            제출용 원본 서식 그대로 표시됩니다. 사업장명·작성일자·결재란은 인쇄 후 기재하거나 그대로 사용하세요.
          </p>
        </div>
        <Button variant="outline" onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" />인쇄
        </Button>
      </div>
      <div className="bg-white text-black rounded-lg border p-5 md:p-8 print:border-0 print:p-0 overflow-x-auto">
        <RegulationDocument />
      </div>
    </div>
  );
}
