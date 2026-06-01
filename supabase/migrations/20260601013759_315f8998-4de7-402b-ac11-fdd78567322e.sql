DROP POLICY IF EXISTS near_miss_org_update ON public.near_miss;
DROP POLICY IF EXISTS near_miss_org_delete ON public.near_miss;

CREATE POLICY near_miss_org_update
ON public.near_miss
FOR UPDATE
TO authenticated
USING (
  organization_id = public.current_user_org()
  AND (
    public.is_org_admin()
    OR complex_id IN (SELECT public.user_complex_ids())
  )
)
WITH CHECK (
  organization_id = public.current_user_org()
  AND (
    public.is_org_admin()
    OR complex_id IN (SELECT public.user_complex_ids())
  )
);

CREATE POLICY near_miss_org_delete
ON public.near_miss
FOR DELETE
TO authenticated
USING (
  organization_id = public.current_user_org()
  AND public.is_org_admin()
);

DROP POLICY IF EXISTS wsr_org_update ON public.work_stop_records;
DROP POLICY IF EXISTS wsr_org_delete ON public.work_stop_records;

CREATE POLICY wsr_org_update
ON public.work_stop_records
FOR UPDATE
TO authenticated
USING (
  organization_id = public.current_user_org()
  AND (
    public.is_org_admin()
    OR complex_id IN (SELECT public.user_complex_ids())
  )
)
WITH CHECK (
  organization_id = public.current_user_org()
  AND (
    public.is_org_admin()
    OR complex_id IN (SELECT public.user_complex_ids())
  )
);

CREATE POLICY wsr_org_delete
ON public.work_stop_records
FOR DELETE
TO authenticated
USING (
  organization_id = public.current_user_org()
  AND public.is_org_admin()
);