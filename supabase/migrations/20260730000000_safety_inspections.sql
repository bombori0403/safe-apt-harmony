-- 안전점검(Safety Inspection) 모듈
-- Supabase SQL Editor에서 실행. (크롬 자동번역 OFF)
--
-- 설계: work_stop_records와 동일한 org+단지 스코프 패턴.
-- 점검 항목(체크리스트)은 별도 테이블 대신 items jsonb 배열로 인라인 저장한다
-- (테이블/RLS 수를 줄여 비개발자 운영 부담을 낮춤). 각 item:
--   { category, text, result('해당없음'|'양호'|'미흡'|'불량'),
--     improvement, assignee, action, actionPhotos[], actionDone(bool) }
-- 개선조치 폐루프: 결과가 '미흡'/'불량'인 항목은 actionDone=true 여야 점검 완료로 본다.

-- 1) 새 모듈 공용 비공개 사진 버킷 (안전점검·TBM·작업허가서가 공유)
INSERT INTO storage.buckets (id, name, public)
VALUES ('safety-photos', 'safety-photos', false)
ON CONFLICT (id) DO NOTHING;

-- 인증 사용자 전용 접근(공개 유출 차단, 표시는 서명 URL). 정책명 충돌 방지 위해 개별 생성.
DROP POLICY IF EXISTS "safety_photos_auth_select" ON storage.objects;
CREATE POLICY "safety_photos_auth_select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'safety-photos');
DROP POLICY IF EXISTS "safety_photos_auth_insert" ON storage.objects;
CREATE POLICY "safety_photos_auth_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'safety-photos');
DROP POLICY IF EXISTS "safety_photos_auth_update" ON storage.objects;
CREATE POLICY "safety_photos_auth_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'safety-photos');
DROP POLICY IF EXISTS "safety_photos_auth_delete" ON storage.objects;
CREATE POLICY "safety_photos_auth_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'safety-photos');

-- 2) 안전점검 테이블
CREATE TABLE IF NOT EXISTS public.safety_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  complex_id uuid NOT NULL REFERENCES public.complexes(id) ON DELETE CASCADE,
  title text NOT NULL,
  inspection_type text NOT NULL DEFAULT '정기',   -- 일일/정기/수시/순회/직접
  checklist_category text,                          -- 프리셋 카테고리(표시용)
  scheduled_date date,                             -- 점검 예정일
  performed_at timestamptz,                        -- 실제 점검 일시
  performed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT '예정',             -- 예정/진행중/완료
  recurrence text NOT NULL DEFAULT 'none',         -- none/weekly/monthly/quarterly/yearly
  recurrence_until date,                           -- 반복 종료일(없으면 무기한)
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_inspections TO authenticated;
GRANT ALL ON public.safety_inspections TO service_role;

ALTER TABLE public.safety_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "si_org_select" ON public.safety_inspections
  FOR SELECT TO authenticated USING (organization_id = public.current_user_org());
CREATE POLICY "si_org_insert" ON public.safety_inspections
  FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_user_org() AND public.org_can_write());
CREATE POLICY "si_org_update" ON public.safety_inspections
  FOR UPDATE TO authenticated USING (organization_id = public.current_user_org() AND public.org_can_write());
CREATE POLICY "si_org_delete" ON public.safety_inspections
  FOR DELETE TO authenticated USING (organization_id = public.current_user_org() AND public.org_can_write());

CREATE TRIGGER update_safety_inspections_updated_at
  BEFORE UPDATE ON public.safety_inspections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_safety_inspections_org_id
  BEFORE INSERT ON public.safety_inspections
  FOR EACH ROW EXECUTE FUNCTION public.set_org_id_from_user();

CREATE INDEX idx_safety_inspections_complex ON public.safety_inspections(complex_id);
CREATE INDEX idx_safety_inspections_scheduled ON public.safety_inspections(scheduled_date);
