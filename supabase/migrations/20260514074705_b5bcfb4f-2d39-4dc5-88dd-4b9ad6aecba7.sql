
CREATE POLICY "companies_member_select" ON public.companies
FOR SELECT USING (
  id IN (
    SELECT cx.company_id FROM complexes cx
    JOIN complex_members cm ON cm.complex_id = cx.id
    JOIN users u ON u.id = cm.user_id
    WHERE u.auth_id = auth.uid() AND cx.company_id IS NOT NULL
  )
);

CREATE POLICY "companies_authenticated_insert" ON public.companies
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "companies_member_update" ON public.companies
FOR UPDATE USING (
  id IN (
    SELECT cx.company_id FROM complexes cx
    JOIN complex_members cm ON cm.complex_id = cx.id
    JOIN users u ON u.id = cm.user_id
    WHERE u.auth_id = auth.uid() AND cx.company_id IS NOT NULL
  )
);
