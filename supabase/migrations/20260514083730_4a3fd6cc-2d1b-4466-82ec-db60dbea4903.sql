
-- Security definer helpers to break recursion between complexes and companies policies
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.user_complex_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT cm.complex_id FROM public.complex_members cm WHERE cm.user_id = public.current_user_id() $$;

CREATE OR REPLACE FUNCTION public.user_admin_company_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT c.id FROM public.companies c WHERE c.super_admin_user_id = public.current_user_id() $$;

CREATE OR REPLACE FUNCTION public.user_member_company_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT cx.company_id
  FROM public.complexes cx
  JOIN public.complex_members cm ON cm.complex_id = cx.id
  WHERE cm.user_id = public.current_user_id() AND cx.company_id IS NOT NULL
$$;

-- Replace recursive complexes policies
DROP POLICY IF EXISTS complexes_member_select ON public.complexes;
DROP POLICY IF EXISTS complexes_update ON public.complexes;
DROP POLICY IF EXISTS complexes_insert ON public.complexes;

CREATE POLICY complexes_member_select ON public.complexes
  FOR SELECT TO authenticated
  USING (id IN (SELECT public.user_complex_ids())
         OR company_id IN (SELECT public.user_admin_company_ids()));

CREATE POLICY complexes_update ON public.complexes
  FOR UPDATE TO authenticated
  USING (id IN (SELECT public.user_complex_ids())
         OR company_id IN (SELECT public.user_admin_company_ids()));

CREATE POLICY complexes_insert ON public.complexes
  FOR INSERT TO authenticated
  WITH CHECK (company_id IS NULL OR company_id IN (SELECT public.user_admin_company_ids()));

-- Replace recursive companies policies
DROP POLICY IF EXISTS companies_member_select ON public.companies;
DROP POLICY IF EXISTS companies_member_update ON public.companies;

CREATE POLICY companies_member_select ON public.companies
  FOR SELECT TO authenticated
  USING (id IN (SELECT public.user_member_company_ids())
         OR super_admin_user_id = public.current_user_id());

CREATE POLICY companies_member_update ON public.companies
  FOR UPDATE TO authenticated
  USING (id IN (SELECT public.user_member_company_ids())
         OR super_admin_user_id = public.current_user_id());
