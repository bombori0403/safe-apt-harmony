CREATE OR REPLACE FUNCTION public.org_can_manage_assessment()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.org_can_write()
    AND EXISTS (
      SELECT 1
      FROM public.users
      WHERE auth_id = auth.uid()
        AND org_role IN ('admin', 'manager')
    )
$$;

DROP POLICY IF EXISTS assessments_org_delete ON public.assessments;
CREATE POLICY assessments_org_delete
ON public.assessments
FOR DELETE
TO authenticated
USING (
  organization_id = public.current_user_org()
  AND public.org_can_manage_assessment()
);