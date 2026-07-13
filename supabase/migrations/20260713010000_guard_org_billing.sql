-- 결제/구독 관련 컬럼은 플랫폼 관리자만 변경할 수 있도록 잠근다.
-- 조직 관리자는 RLS(orgs_admin_update)로 자기 조직 행을 수정할 수 있는데,
-- 이때 subscription_status / expires_at / seat_limit 을 직접 바꿔 체험 잠금을
-- 우회하는 것을 막기 위한 방어 트리거다.
--   · 플랫폼 관리자 → 그대로 허용 (활성화 승인 등)
--   · 그 외        → 위 세 컬럼 변경 시도를 조용히 무시(기존 값 유지)
-- 조직명·사업자정보·활성화 신청(activation_requested_at) 등 다른 컬럼 수정은 정상 동작한다.
-- (신규 조직 생성은 INSERT라 이 BEFORE UPDATE 트리거의 영향을 받지 않는다.)

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
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_org_billing ON public.organizations;
CREATE TRIGGER trg_guard_org_billing
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.guard_org_billing_columns();
