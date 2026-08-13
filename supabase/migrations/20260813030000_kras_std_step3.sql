-- e-KRAS 표준서식 파이프라인 3단계 (2026-08-13)
-- ⚠️ Supabase SQL Editor에서 실행하세요. (크롬 자동번역 OFF)
--
-- 표준서식 '3-2 감소대책 이행 사진 대지'는 위험요인(연번)마다 변경 전 / 변경 후 사진을 붙인다.
--   · 변경 전 = 위험성결정 때 찍은 현장 사진(hazards.photos, 이미 있음)
--   · 변경 후 = 감소대책 이행 후 사진(아래 신규 컬럼)

ALTER TABLE public.hazards
  ADD COLUMN after_photos JSONB DEFAULT '[]'::jsonb;   -- 감소대책 이행 후(변경 후) 사진 URL 배열

COMMENT ON COLUMN public.hazards.after_photos IS '감소대책 이행 후(변경 후) 사진. 변경 전은 hazards.photos.';
