ALTER TABLE public.work_stop_records
  ADD COLUMN IF NOT EXISTS cause_photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS resolution_photos jsonb NOT NULL DEFAULT '[]'::jsonb;