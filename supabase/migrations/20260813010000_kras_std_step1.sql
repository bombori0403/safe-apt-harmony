-- e-KRAS 표준서식 파이프라인 1단계 (2026-08-13)
-- ⚠️ Supabase SQL Editor에서 실행하세요. (크롬 자동번역 OFF)
--
-- 공단 표준서식은 위험요인을 두 갈래로 나눈다:
--   · 재검토(과년도): 작년까지의 위험성평가 이력을 올해 다시 검토
--   · 신규: 올해 새로 발굴한 위험성
-- 또 각 위험요인에는 "현재의 안전보건조치"(이미 시행 중인 조치)를 적는 칸이 있다.
-- 앱은 재검토=이전 평가 복사 기능이 이미 있으므로, 여기서는 출신 구분 플래그와
-- 현재조치 컬럼만 추가한다.

ALTER TABLE public.hazards
  ADD COLUMN origin TEXT NOT NULL DEFAULT 'new'
    CHECK (origin IN ('new', 'carryover')),   -- new=신규, carryover=재검토(과년도)
  ADD COLUMN current_control TEXT;             -- 현재의 안전보건조치(기존에 시행 중인 조치)

COMMENT ON COLUMN public.hazards.origin IS '위험요인 출신: new(금년 신규) / carryover(과년도 재검토)';
COMMENT ON COLUMN public.hazards.current_control IS '현재의 안전보건조치(이미 시행 중인 조치)';
