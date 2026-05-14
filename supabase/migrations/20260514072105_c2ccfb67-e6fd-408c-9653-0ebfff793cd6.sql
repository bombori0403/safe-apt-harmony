DROP POLICY IF EXISTS members_via_complex ON public.complex_members;

CREATE POLICY complex_members_self_select ON public.complex_members
FOR SELECT USING (
  user_id IN (SELECT u.id FROM public.users u WHERE u.auth_id = auth.uid())
);

CREATE POLICY complex_members_self_insert ON public.complex_members
FOR INSERT WITH CHECK (
  user_id IN (SELECT u.id FROM public.users u WHERE u.auth_id = auth.uid())
);

CREATE POLICY complex_members_self_delete ON public.complex_members
FOR DELETE USING (
  user_id IN (SELECT u.id FROM public.users u WHERE u.auth_id = auth.uid())
);