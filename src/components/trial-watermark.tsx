// Diagonal repeating "체험판" watermark laid over report output so a trial
// user can preview everything but can't pass off the PDF as a real submission.
// Shows on screen and in print.
export function TrialWatermark({ expired }: { expired?: boolean }) {
  const label = expired ? "체험 종료 · 결제 후 사용 가능" : "체험판 · 실무 사용 불가";
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden select-none"
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
