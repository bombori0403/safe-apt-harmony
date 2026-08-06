-- RLS 권한 갭 2건 차단 (2026-08-06)
--
-- 갭 1) 단지(complexes) 수정이 관리자 제한 없이 열려 있었다.
--   삭제(complexes_org_delete)는 is_org_admin()이 걸려 있는데 수정(complexes_org_update)엔
--   빠져 있어, 같은 조직의 일반 직원(매니저)이 API 직접호출로 단지 정보를 바꿀 수 있었다.
--   UI는 관리자에게만 수정 버튼을 노출하므로, DB 규칙도 삭제와 동일하게 관리자 전용으로 맞춘다.
--
-- 갭 2) 조직 승인상태(approval_status)가 결제 가드 트리거의 보호 목록에서 빠져 있었다.
--   조직 관리자가 스스로 approval_status='approved'로 바꿔 승인 게이트를 우회할 수 있었다.
--   (지금은 가입 시 자동 승인이라 무해하지만, 수동 승인을 다시 켤 때를 대비해 미리 막는다.)

-- ── 갭 1: 단지 수정은 관리자만 ──────────────────────────────────────────────
DROP POLICY IF EXISTS complexes_org_update ON public.complexes;
CREATE POLICY complexes_org_update ON public.complexes FOR UPDATE TO authenticated
  USING (organization_id = current_user_org() AND is_org_admin() AND org_can_write());

-- ── 갭 2: approval_status도 플랫폼 관리자만 변경 가능하게 ───────────────────
CREATE OR REPLACE FUNCTION public.guard_org_billing_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    NEW.subscription_status := OLD.subscription_status;
    NEW.expires_at          := OLD.expires_at;
    NEW.seat_limit          := OLD.seat_limit;
    NEW.approval_status     := OLD.approval_status;
  END IF;
  RETURN NEW;
END;
$$;

-- 트리거는 기존 것(trg_guard_org_billing)이 이 함수를 그대로 호출하므로 재생성 불필요.
