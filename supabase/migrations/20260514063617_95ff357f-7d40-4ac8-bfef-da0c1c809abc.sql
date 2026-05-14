REVOKE ALL ON FUNCTION public.can_access_assessment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_assessment(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.ensure_current_user_default_complex() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_current_user_default_complex() TO authenticated;