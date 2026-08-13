-- e-KRAS 표준서식 파이프라인 2단계 (2026-08-13)
-- ⚠️ Supabase SQL Editor에서 실행하세요. (크롬 자동번역 OFF)
--
-- 표준서식 '3-1 감소대책 이행 확인' 시트는 감소대책마다
--   완료 여부 · 담당자 · 개선 예정일 · 대책 후 현재 위험성 을 기록한다.
-- 이 중 앱에 없던 건 "잔여 감소대책"(완료되지 않았을 때 남은 조치) 한 칸뿐이라 이를 추가한다.
-- (완료여부=measures.status, 담당자=responsible_name, 예정일=due_date, 대책후 위험성=hazards.post_level 이미 있음)

ALTER TABLE public.measures
  ADD COLUMN residual_action TEXT;   -- 잔여 감소대책(미완료 시 남은 조치)

COMMENT ON COLUMN public.measures.residual_action IS '잔여 감소대책(미완료 시 남은 조치)';
