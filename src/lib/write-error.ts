// Converts a Supabase write error into a friendly message. The org_can_write()
// RLS gate blocks all writes once a trial expires, surfacing a raw
// "row-level security policy" error — translate that into a clear notice.
export function writeErrorMessage(error: any, fallback = "오류가 발생했습니다."): string {
  const msg: string = error?.message ?? "";
  const code: string = error?.code ?? "";
  const isRls =
    /row-level security|violates row-level|permission denied/i.test(msg) ||
    code === "42501" ||
    code === "PGRST301";
  if (isRls) {
    return "체험 기간이 종료되었거나 권한이 없어 작업을 완료할 수 없습니다. 체험이 종료된 경우 정식 전환 후 이용해 주세요.";
  }
  return msg || fallback;
}
