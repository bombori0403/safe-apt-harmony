import { supabase } from "@/integrations/supabase/client";

/**
 * 로그인한 사용자가 속한 단지 목록 — complex_members 를 직접 읽지 않는다.
 *
 * 왜: 2026-05-12 스키마 재생성 뒤 complex_members 에 남은 SELECT 정책은
 * 2026-05-14 마이그레이션(members_via_complex 삭제)으로 사라져, RLS 가 켜진 채 정책이 없다.
 * 그래서 클라이언트에서 complex_members 를 읽으면 누구에게나 빈 배열이 돌아오고,
 * 매니저·직원 화면이 "소속 단지 없음"으로 보였다(관리자는 complexes 전체를 읽는 경로라 티가 안 남).
 *
 * complexes 테이블은 complexes_org_select 정책이 user_complex_ids()(SECURITY DEFINER)로
 * 본인 단지만 허용하므로, 그냥 complexes 를 읽으면 RLS 가 알아서 내 단지만 돌려준다.
 * 관리자는 조직 전체가 돌아오지만 호출부는 모두 "관리자가 아닐 때"만 이 함수를 쓴다.
 *
 * 반환 형태는 기존 `supabase.from("complex_members").select("complex_id")` 와 같게 유지해
 * 호출부를 한 줄 치환으로 바꿀 수 있게 했다.
 */
export async function myComplexMemberships(userId: string | null | undefined): Promise<{ data: { complex_id: string }[] }> {
  if (!userId) return { data: [] };
  const { data } = await supabase.from("complexes").select("id").order("name");
  return { data: (data ?? []).map((c: { id: string }) => ({ complex_id: c.id })) };
}
