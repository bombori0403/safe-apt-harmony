
-- Tighten broken RLS policies: replace unfiltered subqueries with membership-scoped checks.

-- hazards: scope via can_access_assessment
DROP POLICY IF EXISTS hazards_via_assessment ON public.hazards;
CREATE POLICY hazards_via_assessment ON public.hazards
  FOR ALL TO authenticated
  USING (public.can_access_assessment(assessment_id))
  WITH CHECK (public.can_access_assessment(assessment_id));

-- measures: scope via parent hazard's assessment
DROP POLICY IF EXISTS measures_via_hazard ON public.measures;
CREATE POLICY measures_via_hazard ON public.measures
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.hazards h
    WHERE h.id = measures.hazard_id
      AND public.can_access_assessment(h.assessment_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.hazards h
    WHERE h.id = measures.hazard_id
      AND public.can_access_assessment(h.assessment_id)
  ));

-- participants: scope via can_access_assessment
DROP POLICY IF EXISTS participants_via_assessment ON public.participants;
CREATE POLICY participants_via_assessment ON public.participants
  FOR ALL TO authenticated
  USING (public.can_access_assessment(assessment_id))
  WITH CHECK (public.can_access_assessment(assessment_id));

-- signatures: scope via can_access_assessment
DROP POLICY IF EXISTS signatures_via_assessment ON public.signatures;
CREATE POLICY signatures_via_assessment ON public.signatures
  FOR ALL TO authenticated
  USING (public.can_access_assessment(assessment_id))
  WITH CHECK (public.can_access_assessment(assessment_id));

-- near_miss: scope by complex membership (or company super admin)
DROP POLICY IF EXISTS near_miss_via_complex ON public.near_miss;
CREATE POLICY near_miss_via_complex ON public.near_miss
  FOR ALL TO authenticated
  USING (
    complex_id IN (
      SELECT cm.complex_id FROM public.complex_members cm
      JOIN public.users u ON u.id = cm.user_id
      WHERE u.auth_id = auth.uid()
    )
    OR complex_id IN (
      SELECT cx.id FROM public.complexes cx
      JOIN public.companies c ON c.id = cx.company_id
      JOIN public.users u ON u.id = c.super_admin_user_id
      WHERE u.auth_id = auth.uid()
    )
  )
  WITH CHECK (
    complex_id IN (
      SELECT cm.complex_id FROM public.complex_members cm
      JOIN public.users u ON u.id = cm.user_id
      WHERE u.auth_id = auth.uid()
    )
    OR complex_id IN (
      SELECT cx.id FROM public.complexes cx
      JOIN public.companies c ON c.id = cx.company_id
      JOIN public.users u ON u.id = c.super_admin_user_id
      WHERE u.auth_id = auth.uid()
    )
  );

-- complex_members: drop any unfiltered legacy policy if present (keep self-scoped policies)
DROP POLICY IF EXISTS members_via_complex ON public.complex_members;
