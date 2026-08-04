-- 결재라인 + 직원 명부 (한 번에)
-- ▶ Supabase SQL Editor에 붙여넣고 [Run] (크롬 자동번역 OFF). 여러 번 실행해도 안전.

-- 1) TBM·작업허가서 결재라인
ALTER TABLE public.tbm_meetings ADD COLUMN IF NOT EXISTS approval jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.work_permits ADD COLUMN IF NOT EXISTS approval jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2) 단지별 직원 명부 (TBM·교육 참석자 끌어오기)
CREATE TABLE IF NOT EXISTS public.staff_roster (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  complex_id uuid NOT NULL REFERENCES public.complexes(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_roster TO authenticated;
GRANT ALL ON public.staff_roster TO service_role;
ALTER TABLE public.staff_roster ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_org_select" ON public.staff_roster;
CREATE POLICY "sr_org_select" ON public.staff_roster FOR SELECT TO authenticated USING (organization_id = public.current_user_org());
DROP POLICY IF EXISTS "sr_org_insert" ON public.staff_roster;
CREATE POLICY "sr_org_insert" ON public.staff_roster FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_user_org() AND public.org_can_write());
DROP POLICY IF EXISTS "sr_org_update" ON public.staff_roster;
CREATE POLICY "sr_org_update" ON public.staff_roster FOR UPDATE TO authenticated USING (organization_id = public.current_user_org() AND public.org_can_write());
DROP POLICY IF EXISTS "sr_org_delete" ON public.staff_roster;
CREATE POLICY "sr_org_delete" ON public.staff_roster FOR DELETE TO authenticated USING (organization_id = public.current_user_org() AND public.org_can_write());
DROP TRIGGER IF EXISTS update_staff_roster_updated_at ON public.staff_roster;
CREATE TRIGGER update_staff_roster_updated_at BEFORE UPDATE ON public.staff_roster FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS set_staff_roster_org_id ON public.staff_roster;
CREATE TRIGGER set_staff_roster_org_id BEFORE INSERT ON public.staff_roster FOR EACH ROW EXECUTE FUNCTION public.set_org_id_from_user();
CREATE INDEX IF NOT EXISTS idx_staff_roster_complex ON public.staff_roster(complex_id);

-- 3) 스키마 캐시 갱신 (schema cache 오류 방지)
NOTIFY pgrst, 'reload schema';
