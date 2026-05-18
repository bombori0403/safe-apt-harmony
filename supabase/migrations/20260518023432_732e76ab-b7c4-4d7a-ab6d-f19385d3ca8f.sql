
-- Helper: check if assessment belongs to a complex the user can access
CREATE OR REPLACE FUNCTION public.can_access_assessment(_assessment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assessments a
    WHERE a.id = _assessment_id
      AND a.organization_id = public.current_user_org()
      AND (
        public.is_org_admin()
        OR a.complex_id IN (SELECT public.user_complex_ids())
      )
  )
$$;

-- assessments: replace select policy
DROP POLICY IF EXISTS assessments_org_select ON public.assessments;
CREATE POLICY assessments_org_select ON public.assessments
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_user_org()
    AND (
      public.is_org_admin()
      OR complex_id IN (SELECT public.user_complex_ids())
    )
  );

-- complexes: non-admin sees only assigned complexes
DROP POLICY IF EXISTS complexes_org_select ON public.complexes;
CREATE POLICY complexes_org_select ON public.complexes
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_user_org()
    AND (
      public.is_org_admin()
      OR id IN (SELECT public.user_complex_ids())
    )
  );

-- near_miss
DROP POLICY IF EXISTS near_miss_org_select ON public.near_miss;
CREATE POLICY near_miss_org_select ON public.near_miss
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_user_org()
    AND (
      public.is_org_admin()
      OR complex_id IN (SELECT public.user_complex_ids())
    )
  );

-- work_stop_records
DROP POLICY IF EXISTS wsr_org_select ON public.work_stop_records;
CREATE POLICY wsr_org_select ON public.work_stop_records
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_user_org()
    AND (
      public.is_org_admin()
      OR complex_id IN (SELECT public.user_complex_ids())
    )
  );
