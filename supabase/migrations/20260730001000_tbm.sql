-- TBM(Tool Box Meeting, 작업 전 안전미팅) 모듈
-- Supabase SQL Editor에서 실행. (크롬 자동번역 OFF)
--
-- 미화·경비·시설 직원의 매일 아침 조회를 전산화한다. 참석자별 건강상태
-- (발열/음주/약물/보호구)를 체크하고, 당일 유해위험요인·대책을 기록한다.
-- edu_minutes: 이 TBM으로 인정하는 법정 안전교육 시간(분) — 교육 모듈이 집계.
-- 근로자가 앱 계정이 없는 경우가 많아(고령 경비·미화) 참석자는 이름 문자열로 관리.

CREATE TABLE IF NOT EXISTS public.tbm_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  complex_id uuid NOT NULL REFERENCES public.complexes(id) ON DELETE CASCADE,
  title text NOT NULL,                    -- 조/작업명 (예: A동 미화조, 야간 경비조)
  held_at timestamptz NOT NULL DEFAULT now(),
  location text,
  work_content text,
  leader_name text,
  attendees jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{name, role, fever, alcohol, drug, ppe, signed}]
  hazards jsonb NOT NULL DEFAULT '[]'::jsonb,     -- [{hazard, measure}]
  result_note text,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  edu_minutes integer NOT NULL DEFAULT 0,         -- 안전교육 인정 시간(분)
  status text NOT NULL DEFAULT '작성',            -- 작성/완료
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tbm_meetings TO authenticated;
GRANT ALL ON public.tbm_meetings TO service_role;

ALTER TABLE public.tbm_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tbm_org_select" ON public.tbm_meetings
  FOR SELECT TO authenticated USING (organization_id = public.current_user_org());
CREATE POLICY "tbm_org_insert" ON public.tbm_meetings
  FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_user_org() AND public.org_can_write());
CREATE POLICY "tbm_org_update" ON public.tbm_meetings
  FOR UPDATE TO authenticated USING (organization_id = public.current_user_org() AND public.org_can_write());
CREATE POLICY "tbm_org_delete" ON public.tbm_meetings
  FOR DELETE TO authenticated USING (organization_id = public.current_user_org() AND public.org_can_write());

CREATE TRIGGER update_tbm_updated_at
  BEFORE UPDATE ON public.tbm_meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_tbm_org_id
  BEFORE INSERT ON public.tbm_meetings
  FOR EACH ROW EXECUTE FUNCTION public.set_org_id_from_user();

CREATE INDEX idx_tbm_complex ON public.tbm_meetings(complex_id);
CREATE INDEX idx_tbm_held ON public.tbm_meetings(held_at);
