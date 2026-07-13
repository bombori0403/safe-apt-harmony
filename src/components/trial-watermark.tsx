import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

// Hard-lock screen shown when the trial has expired: blocks creating new
// assessments and printing reports, while existing data stays viewable elsewhere.
export function TrialExpiredBlock({ what = "이 기능" }: { what?: string }) {
  return (
    <div className="p-10 max-w-md mx-auto text-center space-y-4">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-danger/10 text-danger">
        <Lock className="h-7 w-7" />
      </div>
      <h1 className="text-xl font-bold">체험 기간이 종료되었습니다</h1>
      <p className="text-sm text-muted-foreground leading-relaxed">
        14일 무료 체험이 끝나 {what}은(는) 잠겼습니다. 정식 등록 후 승인되면 제한 없이 이용할 수 있어요.
        기존에 작성한 데이터는 계속 조회할 수 있습니다.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
        <Link to="/activate"><Button className="w-full sm:w-auto">정식 등록하고 계속 사용하기</Button></Link>
        <Link to="/dashboard"><Button variant="outline" className="w-full sm:w-auto">대시보드로 돌아가기</Button></Link>
      </div>
    </div>
  );
}

// Diagonal repeating "체험판" watermark laid over report output so a trial
// user can preview everything but can't pass off the PDF as a real submission.
// Shows on screen and in print.
export function TrialWatermark({ expired }: { expired?: boolean }) {
  const label = expired ? "체험 종료 · 결제 후 사용 가능" : "체험판 · 실무 사용 불가";
  return (
    <div
      aria-hidden
      className="trial-watermark-layer pointer-events-none fixed inset-0 z-[100] overflow-hidden select-none"
    >
      <div className="absolute inset-[-20%] grid grid-cols-3 gap-y-24 place-items-center opacity-[0.10]">
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            style={{ transform: "rotate(-30deg)" }}
            className="whitespace-nowrap text-2xl md:text-3xl font-black tracking-tight text-danger"
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
