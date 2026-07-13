-- employee_inputs (청취조사·오픈채팅) write policies were missing the
-- org_can_write() trial-expiry gate, so they still accepted writes after a
-- trial ended. Add it to insert/update so they lock like every other write.

DROP POLICY IF EXISTS "insert employee_inputs" ON public.employee_inputs;
CREATE POLICY "insert employee_inputs"
  ON public.employee_inputs FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_user_org()
    AND public.org_can_write()
    AND (
      public.is_org_admin()
      OR (complex_id IS NOT NULL AND complex_id IN (SELECT public.user_complex_ids()))
      OR (assessment_id IS NOT NULL AND public.can_access_assessment(assessment_id))
    )
  );

DROP POLICY IF EXISTS "update employee_inputs" ON public.employee_inputs;
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
    AND public.org_can_write()
    AND (created_by = public.current_user_id() OR public.is_org_manager())
  );
