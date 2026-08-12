-- 안전점검(safety_inspections)에 결재란 추가 (담당/과장/팀장/소장).
-- jsonb 한 컬럼에 { "담당": {"name":"", "at":""}, ... } 형태로 저장. 앱에서 결재(서명일자 기록).
ALTER TABLE public.safety_inspections
  ADD COLUMN IF NOT EXISTS approval jsonb NOT NULL DEFAULT '{}'::jsonb;
