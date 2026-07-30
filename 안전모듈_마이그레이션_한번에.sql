-- ============================================================
-- 안전데스크 Tier 1~2 안전관리 모듈 통합 마이그레이션 (2026-07-30)
-- 안전점검 / TBM / 작업허가서 / 안전보건교육 / 긴급신고
--
-- ▶ 사용법: 이 파일 전체를 복사해서 Supabase SQL Editor에 붙여넣고 [Run].
-- ▶ 실행 전 크롬 자동번역 OFF (켜면 대시보드가 깨질 수 있음).
-- ▶ 여러 번 실행해도 안전합니다(중복 생성 오류 없음).
-- ============================================================

-- ===== 0) 공용 비공개 사진 버킷 (안전점검·TBM·작업허가서·교육 공유) =====
INSERT INTO storage.buckets (id, name, public)
VALUES ('safety-photos', 'safety-photos', false)
ON CONFLICT (id) DO NOTHING;

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

-- ===== 1) 안전점검 =====
CREATE TABLE IF NOT EXISTS public.safety_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  complex_id uuid NOT NULL REFERENCES public.complexes(id) ON DELETE CASCADE,
  title text NOT NULL,
  inspection_type text NOT NULL DEFAULT '정기',
  checklist_category text,
  scheduled_date date,
  performed_at timestamptz,
  performed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT '예정',
  recurrence text NOT NULL DEFAULT 'none',
  recurrence_until date,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_inspections TO authenticated;
GRANT ALL ON public.safety_inspections TO service_role;
ALTER TABLE public.safety_inspections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "si_org_select" ON public.safety_inspections;
CREATE POLICY "si_org_select" ON public.safety_inspections FOR SELECT TO authenticated USING (organization_id = public.current_user_org());
DROP POLICY IF EXISTS "si_org_insert" ON public.safety_inspections;
CREATE POLICY "si_org_insert" ON public.safety_inspections FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_user_org() AND public.org_can_write());
DROP POLICY IF EXISTS "si_org_update" ON public.safety_inspections;
CREATE POLICY "si_org_update" ON public.safety_inspections FOR UPDATE TO authenticated USING (organization_id = public.current_user_org() AND public.org_can_write());
DROP POLICY IF EXISTS "si_org_delete" ON public.safety_inspections;
CREATE POLICY "si_org_delete" ON public.safety_inspections FOR DELETE TO authenticated USING (organization_id = public.current_user_org() AND public.org_can_write());
DROP TRIGGER IF EXISTS update_safety_inspections_updated_at ON public.safety_inspections;
CREATE TRIGGER update_safety_inspections_updated_at BEFORE UPDATE ON public.safety_inspections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS set_safety_inspections_org_id ON public.safety_inspections;
CREATE TRIGGER set_safety_inspections_org_id BEFORE INSERT ON public.safety_inspections FOR EACH ROW EXECUTE FUNCTION public.set_org_id_from_user();
CREATE INDEX IF NOT EXISTS idx_safety_inspections_complex ON public.safety_inspections(complex_id);
CREATE INDEX IF NOT EXISTS idx_safety_inspections_scheduled ON public.safety_inspections(scheduled_date);

-- ===== 2) TBM (작업 전 안전미팅) =====
CREATE TABLE IF NOT EXISTS public.tbm_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  complex_id uuid NOT NULL REFERENCES public.complexes(id) ON DELETE CASCADE,
  title text NOT NULL,
  held_at timestamptz NOT NULL DEFAULT now(),
  location text,
  work_content text,
  leader_name text,
  attendees jsonb NOT NULL DEFAULT '[]'::jsonb,
  hazards jsonb NOT NULL DEFAULT '[]'::jsonb,
  result_note text,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  edu_minutes integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT '작성',
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tbm_meetings TO authenticated;
GRANT ALL ON public.tbm_meetings TO service_role;
ALTER TABLE public.tbm_meetings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tbm_org_select" ON public.tbm_meetings;
CREATE POLICY "tbm_org_select" ON public.tbm_meetings FOR SELECT TO authenticated USING (organization_id = public.current_user_org());
DROP POLICY IF EXISTS "tbm_org_insert" ON public.tbm_meetings;
CREATE POLICY "tbm_org_insert" ON public.tbm_meetings FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_user_org() AND public.org_can_write());
DROP POLICY IF EXISTS "tbm_org_update" ON public.tbm_meetings;
CREATE POLICY "tbm_org_update" ON public.tbm_meetings FOR UPDATE TO authenticated USING (organization_id = public.current_user_org() AND public.org_can_write());
DROP POLICY IF EXISTS "tbm_org_delete" ON public.tbm_meetings;
CREATE POLICY "tbm_org_delete" ON public.tbm_meetings FOR DELETE TO authenticated USING (organization_id = public.current_user_org() AND public.org_can_write());
DROP TRIGGER IF EXISTS update_tbm_updated_at ON public.tbm_meetings;
CREATE TRIGGER update_tbm_updated_at BEFORE UPDATE ON public.tbm_meetings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS set_tbm_org_id ON public.tbm_meetings;
CREATE TRIGGER set_tbm_org_id BEFORE INSERT ON public.tbm_meetings FOR EACH ROW EXECUTE FUNCTION public.set_org_id_from_user();
CREATE INDEX IF NOT EXISTS idx_tbm_complex ON public.tbm_meetings(complex_id);
CREATE INDEX IF NOT EXISTS idx_tbm_held ON public.tbm_meetings(held_at);

-- ===== 3) 작업허가서 =====
CREATE TABLE IF NOT EXISTS public.work_permits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  complex_id uuid NOT NULL REFERENCES public.complexes(id) ON DELETE CASCADE,
  permit_type text NOT NULL,
  title text NOT NULL,
  work_location text,
  work_date date,
  performer text,
  supervisor_name text,
  safety_watcher text,
  workers jsonb NOT NULL DEFAULT '[]'::jsonb,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  gas_required boolean NOT NULL DEFAULT false,
  gas jsonb,
  note text,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT '신청',
  approver_name text,
  approved_at timestamptz,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_permits TO authenticated;
GRANT ALL ON public.work_permits TO service_role;
ALTER TABLE public.work_permits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wp_org_select" ON public.work_permits;
CREATE POLICY "wp_org_select" ON public.work_permits FOR SELECT TO authenticated USING (organization_id = public.current_user_org());
DROP POLICY IF EXISTS "wp_org_insert" ON public.work_permits;
CREATE POLICY "wp_org_insert" ON public.work_permits FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_user_org() AND public.org_can_write());
DROP POLICY IF EXISTS "wp_org_update" ON public.work_permits;
CREATE POLICY "wp_org_update" ON public.work_permits FOR UPDATE TO authenticated USING (organization_id = public.current_user_org() AND public.org_can_write());
DROP POLICY IF EXISTS "wp_org_delete" ON public.work_permits;
CREATE POLICY "wp_org_delete" ON public.work_permits FOR DELETE TO authenticated USING (organization_id = public.current_user_org() AND public.org_can_write());
DROP TRIGGER IF EXISTS update_wp_updated_at ON public.work_permits;
CREATE TRIGGER update_wp_updated_at BEFORE UPDATE ON public.work_permits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS set_wp_org_id ON public.work_permits;
CREATE TRIGGER set_wp_org_id BEFORE INSERT ON public.work_permits FOR EACH ROW EXECUTE FUNCTION public.set_org_id_from_user();
CREATE INDEX IF NOT EXISTS idx_wp_complex ON public.work_permits(complex_id);
CREATE INDEX IF NOT EXISTS idx_wp_date ON public.work_permits(work_date);

-- ===== 4) 안전보건교육 =====
CREATE TABLE IF NOT EXISTS public.safety_educations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  complex_id uuid NOT NULL REFERENCES public.complexes(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL DEFAULT '정기',
  method text NOT NULL DEFAULT '집합',
  edu_date date,
  duration_minutes integer NOT NULL DEFAULT 0,
  instructor text,
  content text,
  legal_basis text,
  attendees jsonb NOT NULL DEFAULT '[]'::jsonb,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT '예정',
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_educations TO authenticated;
GRANT ALL ON public.safety_educations TO service_role;
ALTER TABLE public.safety_educations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "se_org_select" ON public.safety_educations;
CREATE POLICY "se_org_select" ON public.safety_educations FOR SELECT TO authenticated USING (organization_id = public.current_user_org());
DROP POLICY IF EXISTS "se_org_insert" ON public.safety_educations;
CREATE POLICY "se_org_insert" ON public.safety_educations FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_user_org() AND public.org_can_write());
DROP POLICY IF EXISTS "se_org_update" ON public.safety_educations;
CREATE POLICY "se_org_update" ON public.safety_educations FOR UPDATE TO authenticated USING (organization_id = public.current_user_org() AND public.org_can_write());
DROP POLICY IF EXISTS "se_org_delete" ON public.safety_educations;
CREATE POLICY "se_org_delete" ON public.safety_educations FOR DELETE TO authenticated USING (organization_id = public.current_user_org() AND public.org_can_write());
DROP TRIGGER IF EXISTS update_se_updated_at ON public.safety_educations;
CREATE TRIGGER update_se_updated_at BEFORE UPDATE ON public.safety_educations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS set_se_org_id ON public.safety_educations;
CREATE TRIGGER set_se_org_id BEFORE INSERT ON public.safety_educations FOR EACH ROW EXECUTE FUNCTION public.set_org_id_from_user();
CREATE INDEX IF NOT EXISTS idx_se_complex ON public.safety_educations(complex_id);
CREATE INDEX IF NOT EXISTS idx_se_date ON public.safety_educations(edu_date);

-- ===== 5) 긴급 신고 플래그 =====
ALTER TABLE public.near_miss ADD COLUMN IF NOT EXISTS urgent boolean NOT NULL DEFAULT false;
ALTER TABLE public.employee_inputs ADD COLUMN IF NOT EXISTS urgent boolean NOT NULL DEFAULT false;

-- ===== 5b) TBM · 작업허가서 결재라인 =====
ALTER TABLE public.tbm_meetings ADD COLUMN IF NOT EXISTS approval jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.work_permits ADD COLUMN IF NOT EXISTS approval jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ===== 6) PostgREST 스키마 캐시 갱신 (schema cache 오류 방지) =====
NOTIFY pgrst, 'reload schema';
