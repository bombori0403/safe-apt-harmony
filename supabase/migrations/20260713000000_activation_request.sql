-- 14일 체험 종료 후 "정식 등록 + 승인" 전환 흐름.
-- 조직 관리자가 정식 사용을 신청하면 activation_requested_at을 기록하고
-- (사업자 정보는 기존 organizations.business_number / phone / representative_name / address 재사용),
-- 플랫폼 관리자가 승인하면 subscription_status='active'로 전환한다.
-- RLS 변경 불필요:
--   · orgs_admin_update       → 조직관리자가 자기 조직의 신청 필드를 채울 수 있음
--   · orgs_platform_admin_all → 플랫폼 관리자가 subscription_status를 active로 전환 가능

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS activation_requested_at timestamptz;
