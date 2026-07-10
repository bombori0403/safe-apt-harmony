-- Step 1: add new work_category values (must be committed before use,
-- so this runs as its own migration ahead of the seed data below).
ALTER TYPE public.work_category ADD VALUE IF NOT EXISTS '경비_보안';
ALTER TYPE public.work_category ADD VALUE IF NOT EXISTS '주차관리';
