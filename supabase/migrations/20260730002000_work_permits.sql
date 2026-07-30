-- 작업허가서(Work Permit / PTW) 모듈
-- Supabase SQL Editor에서 실행. (크롬 자동번역 OFF)
--
-- 아파트 고위험 단발작업(고소·밀폐공간·화기·전기·중량물)에 착수 전 점검·허가를
-- 강제한다. 밀폐공간·화기 작업은 가스농도 측정(gas)이 필수 트리거.
-- checklist/gas/workers는 jsonb로 인라인 저장.
--   checklist: [{text, required(bool), result('양호'|'불량'|'해당없음')}]
--   gas: {o2, lel, h2s, co, measuredAt, measuredBy}
--   workers: [name, ...]

CREATE TABLE IF NOT EXISTS public.work_permits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  complex_id uuid NOT NULL REFERENCES public.complexes(id) ON DELETE CASCADE,
  permit_type text NOT NULL,               -- 고소작업/밀폐공간/화기작업/전기작업/중량물/기타
  title text NOT NULL,
  work_location text,
  work_date date,
  performer text,                          -- 시행 업체/담당(자체 또는 용역사)
  supervisor_name text,                    -- 작업책임자
  safety_watcher text,                     -- 안전(화재)감시인
  workers jsonb NOT NULL DEFAULT '[]'::jsonb,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  gas_required boolean NOT NULL DEFAULT false,
  gas jsonb,                               -- {o2, lel, h2s, co, measuredAt, measuredBy}
  note text,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT '신청',     -- 신청/승인/완료
  approver_name text,
  approved_at timestamptz,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_permits TO authenticated;
GRANT ALL ON public.work_permits TO service_role;

ALTER TABLE public.work_permits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wp_org_select" ON public.work_permits
  FOR SELECT TO authenticated USING (organization_id = public.current_user_org());
CREATE POLICY "wp_org_insert" ON public.work_permits
  FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_user_org() AND public.org_can_write());
CREATE POLICY "wp_org_update" ON public.work_permits
  FOR UPDATE TO authenticated USING (organization_id = public.current_user_org() AND public.org_can_write());
CREATE POLICY "wp_org_delete" ON public.work_permits
  FOR DELETE TO authenticated USING (organization_id = public.current_user_org() AND public.org_can_write());

CREATE TRIGGER update_wp_updated_at
  BEFORE UPDATE ON public.work_permits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_wp_org_id
  BEFORE INSERT ON public.work_permits
  FOR EACH ROW EXECUTE FUNCTION public.set_org_id_from_user();

CREATE INDEX idx_wp_complex ON public.work_permits(complex_id);
CREATE INDEX idx_wp_date ON public.work_permits(work_date);
