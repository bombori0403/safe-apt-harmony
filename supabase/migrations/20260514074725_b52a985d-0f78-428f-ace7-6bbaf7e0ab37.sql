
DROP POLICY IF EXISTS "companies_authenticated_insert" ON public.companies;

CREATE POLICY "companies_member_insert" ON public.companies
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM complex_members cm
    JOIN users u ON u.id = cm.user_id
    WHERE u.auth_id = auth.uid()
  )
);
