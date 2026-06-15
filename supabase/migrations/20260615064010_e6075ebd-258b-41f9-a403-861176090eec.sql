
ALTER TABLE public.employee_inputs ALTER COLUMN assessment_id DROP NOT NULL;

DROP POLICY IF EXISTS "view employee_inputs by assessment access" ON public.employee_inputs;
DROP POLICY IF EXISTS "insert employee_inputs by assessment access" ON public.employee_inputs;
DROP POLICY IF EXISTS "update own or manager employee_inputs" ON public.employee_inputs;
DROP POLICY IF EXISTS "delete own or manager employee_inputs" ON public.employee_inputs;

CREATE POLICY "view employee_inputs"
  ON public.employee_inputs FOR SELECT TO authenticated
  USING (
    organization_id = public.current_user_org()
    AND (
      public.is_org_admin()
      OR (complex_id IS NOT NULL AND complex_id IN (SELECT public.user_complex_ids()))
      OR (assessment_id IS NOT NULL AND public.can_access_assessment(assessment_id))
    )
  );

CREATE POLICY "insert employee_inputs"
  ON public.employee_inputs FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_user_org()
    AND (
      public.is_org_admin()
      OR (complex_id IS NOT NULL AND complex_id IN (SELECT public.user_complex_ids()))
      OR (assessment_id IS NOT NULL AND public.can_access_assessment(assessment_id))
    )
  );

CREATE POLICY "update employee_inputs"
  ON public.employee_inputs FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_user_org()
    AND (created_by = public.current_user_id() OR public.is_org_manager())
    AND (
      public.is_org_admin()
      OR (complex_id IS NOT NULL AND complex_id IN (SELECT public.user_complex_ids()))
      OR (assessment_id IS NOT NULL AND public.can_access_assessment(assessment_id))
    )
  )
  WITH CHECK (
    organization_id = public.current_user_org()
    AND (created_by = public.current_user_id() OR public.is_org_manager())
  );

CREATE POLICY "delete employee_inputs"
  ON public.employee_inputs FOR DELETE TO authenticated
  USING (
    organization_id = public.current_user_org()
    AND (created_by = public.current_user_id() OR public.is_org_manager())
    AND (
      public.is_org_admin()
      OR (complex_id IS NOT NULL AND complex_id IN (SELECT public.user_complex_ids()))
      OR (assessment_id IS NOT NULL AND public.can_access_assessment(assessment_id))
    )
  );
