-- 위험요인별 작업공정명(대분류) 저장 (2026-08-13)
-- ⚠️ Supabase SQL Editor에서 실행하세요. (크롬 자동번역 OFF)
--
-- 표준서식은 위험요인마다 '작업공정명(대분류)'이 다르다(근로자 건강 / 공통 / 시설관리 등).
-- 앱은 작업공정명을 평가 단위(assessments.work_name)로만 갖고 있어, 가져오기 시 모든 행에
-- 파일명이 반복됐다. 위험요인별 공정명을 담을 컬럼을 추가한다.

ALTER TABLE public.hazards
  ADD COLUMN process_name TEXT;   -- 작업공정명(대분류)

COMMENT ON COLUMN public.hazards.process_name IS '작업공정명(대분류) — 위험요인별';
