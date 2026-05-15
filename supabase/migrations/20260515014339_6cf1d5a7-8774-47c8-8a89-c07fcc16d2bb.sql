
-- Helper: org is allowed to write?
CREATE OR REPLACE FUNCTION public.org_can_write()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    JOIN public.users u ON u.organization_id = o.id
    WHERE u.auth_id = auth.uid()
      AND o.subscription_status IN ('trial','active')
      AND (o.expires_at IS NULL OR o.expires_at > now())
  )
$$;

CREATE OR REPLACE FUNCTION public.can_write_assessment(_assessment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.can_access_assessment(_assessment_id) AND public.org_can_write()
$$;

-- complexes: split policies, add write gate
DROP POLICY IF EXISTS complexes_org_insert ON public.complexes;
DROP POLICY IF EXISTS complexes_org_update ON public.complexes;
DROP POLICY IF EXISTS complexes_org_delete ON public.complexes;
CREATE POLICY complexes_org_insert ON public.complexes FOR INSERT TO authenticated
  WITH CHECK (organization_id = current_user_org() AND org_can_write());
CREATE POLICY complexes_org_update ON public.complexes FOR UPDATE TO authenticated
  USING (organization_id = current_user_org() AND org_can_write());
CREATE POLICY complexes_org_delete ON public.complexes FOR DELETE TO authenticated
  USING (organization_id = current_user_org() AND is_org_admin() AND org_can_write());

-- assessments: convert ALL into split
DROP POLICY IF EXISTS assessments_org_all ON public.assessments;
CREATE POLICY assessments_org_select ON public.assessments FOR SELECT TO authenticated
  USING (organization_id = current_user_org());
CREATE POLICY assessments_org_insert ON public.assessments FOR INSERT TO authenticated
  WITH CHECK (organization_id = current_user_org() AND org_can_write());
CREATE POLICY assessments_org_update ON public.assessments FOR UPDATE TO authenticated
  USING (organization_id = current_user_org() AND org_can_write());
CREATE POLICY assessments_org_delete ON public.assessments FOR DELETE TO authenticated
  USING (organization_id = current_user_org() AND org_can_write());

-- near_miss
DROP POLICY IF EXISTS near_miss_org_all ON public.near_miss;
CREATE POLICY near_miss_org_select ON public.near_miss FOR SELECT TO authenticated
  USING (organization_id = current_user_org());
CREATE POLICY near_miss_org_insert ON public.near_miss FOR INSERT TO authenticated
  WITH CHECK (organization_id = current_user_org() AND org_can_write());
CREATE POLICY near_miss_org_update ON public.near_miss FOR UPDATE TO authenticated
  USING (organization_id = current_user_org() AND org_can_write());
CREATE POLICY near_miss_org_delete ON public.near_miss FOR DELETE TO authenticated
  USING (organization_id = current_user_org() AND org_can_write());

-- hazards / measures / participants / signatures: split via_assessment
DROP POLICY IF EXISTS hazards_via_assessment ON public.hazards;
CREATE POLICY hazards_select ON public.hazards FOR SELECT TO authenticated
  USING (can_access_assessment(assessment_id));
CREATE POLICY hazards_insert ON public.hazards FOR INSERT TO authenticated
  WITH CHECK (can_write_assessment(assessment_id));
CREATE POLICY hazards_update ON public.hazards FOR UPDATE TO authenticated
  USING (can_write_assessment(assessment_id));
CREATE POLICY hazards_delete ON public.hazards FOR DELETE TO authenticated
  USING (can_write_assessment(assessment_id));

DROP POLICY IF EXISTS measures_via_hazard ON public.measures;
CREATE POLICY measures_select ON public.measures FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM hazards h WHERE h.id = measures.hazard_id AND can_access_assessment(h.assessment_id)));
CREATE POLICY measures_insert ON public.measures FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM hazards h WHERE h.id = measures.hazard_id AND can_write_assessment(h.assessment_id)));
CREATE POLICY measures_update ON public.measures FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM hazards h WHERE h.id = measures.hazard_id AND can_write_assessment(h.assessment_id)));
CREATE POLICY measures_delete ON public.measures FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM hazards h WHERE h.id = measures.hazard_id AND can_write_assessment(h.assessment_id)));

DROP POLICY IF EXISTS participants_via_assessment ON public.participants;
CREATE POLICY participants_select ON public.participants FOR SELECT TO authenticated
  USING (can_access_assessment(assessment_id));
CREATE POLICY participants_insert ON public.participants FOR INSERT TO authenticated
  WITH CHECK (can_write_assessment(assessment_id));
CREATE POLICY participants_update ON public.participants FOR UPDATE TO authenticated
  USING (can_write_assessment(assessment_id));
CREATE POLICY participants_delete ON public.participants FOR DELETE TO authenticated
  USING (can_write_assessment(assessment_id));

DROP POLICY IF EXISTS signatures_via_assessment ON public.signatures;
CREATE POLICY signatures_select ON public.signatures FOR SELECT TO authenticated
  USING (can_access_assessment(assessment_id));
-- signatures: 서명은 만료 후에도 외부 참여자가 마무리할 수 있어야 하므로 INSERT는 만료 게이트 없이 organization 접근만 검사
CREATE POLICY signatures_insert ON public.signatures FOR INSERT TO authenticated
  WITH CHECK (can_access_assessment(assessment_id));
CREATE POLICY signatures_update ON public.signatures FOR UPDATE TO authenticated
  USING (can_write_assessment(assessment_id));
CREATE POLICY signatures_delete ON public.signatures FOR DELETE TO authenticated
  USING (can_write_assessment(assessment_id));
