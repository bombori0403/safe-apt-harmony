-- complex_members 조회 정책 복구 (2026-10-25)
-- ⚠️ Supabase SQL Editor에서 수동 실행 (크롬 자동번역 OFF).
--
-- 배경: 2026-05-12 스키마 재생성 후 남아 있던 유일한 정책 members_via_complex 가
-- 2026-05-14 마이그레이션에서 삭제되어, complex_members 는 RLS 가 켜진 채 SELECT 정책이 없다.
-- 클라이언트 코드는 이제 complex_members 를 직접 읽지 않도록 고쳤지만(lib/my-complexes.ts),
-- 표준적인 안전장치로 "본인 행 + 관리자·매니저는 조직 내 단지의 행" 조회 정책을 둔다.

DROP POLICY IF EXISTS complex_members_select ON public.complex_members;
CREATE POLICY complex_members_select
  ON public.complex_members FOR SELECT TO authenticated
  USING (
    user_id = public.current_user_id()
    OR (
      public.is_org_manager()
      AND complex_id IN (SELECT id FROM public.complexes WHERE organization_id = public.current_user_org())
    )
  );
