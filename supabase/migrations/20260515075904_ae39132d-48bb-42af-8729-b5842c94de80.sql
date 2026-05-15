REVOKE ALL ON FUNCTION public.org_can_manage_assessment() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_can_manage_assessment() TO authenticated;