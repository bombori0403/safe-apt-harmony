-- TBM · 작업허가서 결재라인 추가
-- ▶ Supabase SQL Editor에 붙여넣고 [Run] (크롬 자동번역 OFF). 여러 번 실행해도 안전.
-- approval: {drafter_name, reviewer_name, approver_name, drafter_signed_at, reviewer_signed_at, approver_signed_at}

ALTER TABLE public.tbm_meetings  ADD COLUMN IF NOT EXISTS approval jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.work_permits  ADD COLUMN IF NOT EXISTS approval jsonb NOT NULL DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload schema';
