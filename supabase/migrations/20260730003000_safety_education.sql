-- 안전보건교육 이수관리 모듈
-- Supabase SQL Editor에서 실행. (크롬 자동번역 OFF)
--
-- 경비·미화 등 근로자 법정 안전보건교육(산안법 제29조)의 실시·이수 관리.
-- 근로자가 앱 계정이 없는 경우가 많아 참석자는 이름 문자열로 관리(TBM과 동일).
-- attendees: [{name, role, attended(bool), completed(bool), source('내부'|'외부'), note}]
-- 이수현황 집계는 프런트에서 educations(완료분) + tbm_meetings(edu_minutes)를 이름 기준 합산.

CREATE TABLE IF NOT EXISTS public.safety_educations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  complex_id uuid NOT NULL REFERENCES public.complexes(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL DEFAULT '정기',   -- 정기/채용시/작업내용변경시/특별/기타
  method text NOT NULL DEFAULT '집합',     -- 집합/온라인/외부
  edu_date date,
  duration_minutes integer NOT NULL DEFAULT 0,
  instructor text,
  content text,
  legal_basis text,
  attendees jsonb NOT NULL DEFAULT '[]'::jsonb,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT '예정',      -- 예정/완료
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_educations TO authenticated;
GRANT ALL ON public.safety_educations TO service_role;

ALTER TABLE public.safety_educations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "se_org_select" ON public.safety_educations
  FOR SELECT TO authenticated USING (organization_id = public.current_user_org());
CREATE POLICY "se_org_insert" ON public.safety_educations
  FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_user_org() AND public.org_can_write());
CREATE POLICY "se_org_update" ON public.safety_educations
  FOR UPDATE TO authenticated USING (organization_id = public.current_user_org() AND public.org_can_write());
CREATE POLICY "se_org_delete" ON public.safety_educations
  FOR DELETE TO authenticated USING (organization_id = public.current_user_org() AND public.org_can_write());

CREATE TRIGGER update_se_updated_at
  BEFORE UPDATE ON public.safety_educations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_se_org_id
  BEFORE INSERT ON public.safety_educations
  FOR EACH ROW EXECUTE FUNCTION public.set_org_id_from_user();

CREATE INDEX idx_se_complex ON public.safety_educations(complex_id);
CREATE INDEX idx_se_date ON public.safety_educations(edu_date);
