
CREATE TABLE public.employee_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  complex_id uuid REFERENCES public.complexes(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  input_type text NOT NULL CHECK (input_type IN ('hearing','open_chat')),
  respondent_name text,
  respondent_role text,
  content text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  attachments text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_inputs TO authenticated;
GRANT ALL ON public.employee_inputs TO service_role;

ALTER TABLE public.employee_inputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view employee_inputs by assessment access"
  ON public.employee_inputs FOR SELECT TO authenticated
  USING (public.can_access_assessment(assessment_id));

CREATE POLICY "insert employee_inputs by assessment access"
  ON public.employee_inputs FOR INSERT TO authenticated
  WITH CHECK (public.can_access_assessment(assessment_id));

CREATE POLICY "update own or manager employee_inputs"
  ON public.employee_inputs FOR UPDATE TO authenticated
  USING (
    public.can_access_assessment(assessment_id)
    AND (created_by = public.current_user_id() OR public.is_org_manager())
  )
  WITH CHECK (
    public.can_access_assessment(assessment_id)
    AND (created_by = public.current_user_id() OR public.is_org_manager())
  );

CREATE POLICY "delete own or manager employee_inputs"
  ON public.employee_inputs FOR DELETE TO authenticated
  USING (
    public.can_access_assessment(assessment_id)
    AND (created_by = public.current_user_id() OR public.is_org_manager())
  );

CREATE TRIGGER update_employee_inputs_updated_at
  BEFORE UPDATE ON public.employee_inputs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_employee_inputs_assessment ON public.employee_inputs(assessment_id);
CREATE INDEX idx_employee_inputs_complex ON public.employee_inputs(complex_id);
