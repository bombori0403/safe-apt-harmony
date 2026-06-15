DROP POLICY IF EXISTS "평가사진 조회" ON storage.objects;
DROP POLICY IF EXISTS "평가사진 업로드" ON storage.objects;
DROP POLICY IF EXISTS "평가사진 수정" ON storage.objects;
DROP POLICY IF EXISTS "평가사진 삭제" ON storage.objects;
DROP POLICY IF EXISTS "직원참여 사진 조회" ON storage.objects;
DROP POLICY IF EXISTS "직원참여 사진 업로드" ON storage.objects;
DROP POLICY IF EXISTS "직원참여 사진 수정" ON storage.objects;
DROP POLICY IF EXISTS "직원참여 사진 삭제" ON storage.objects;

CREATE POLICY "평가사진 조회"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'assessment-photos'
  AND public.can_access_assessment(substring(name from '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/')::uuid)
);

CREATE POLICY "평가사진 업로드"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'assessment-photos'
  AND public.can_access_assessment(substring(name from '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/')::uuid)
);

CREATE POLICY "평가사진 수정"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'assessment-photos'
  AND public.can_access_assessment(substring(name from '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/')::uuid)
)
WITH CHECK (
  bucket_id = 'assessment-photos'
  AND public.can_access_assessment(substring(name from '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/')::uuid)
);

CREATE POLICY "평가사진 삭제"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'assessment-photos'
  AND public.can_access_assessment(substring(name from '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/')::uuid)
);

CREATE POLICY "직원참여 사진 조회"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'assessment-photos'
  AND (storage.foldername(name))[1] = 'employee'
  AND (
    public.is_org_admin()
    OR substring(name from '^employee/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/')::uuid IN (SELECT public.user_complex_ids())
  )
);

CREATE POLICY "직원참여 사진 업로드"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'assessment-photos'
  AND (storage.foldername(name))[1] = 'employee'
  AND (
    public.is_org_admin()
    OR substring(name from '^employee/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/')::uuid IN (SELECT public.user_complex_ids())
  )
);

CREATE POLICY "직원참여 사진 수정"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'assessment-photos'
  AND (storage.foldername(name))[1] = 'employee'
  AND (
    public.is_org_admin()
    OR substring(name from '^employee/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/')::uuid IN (SELECT public.user_complex_ids())
  )
)
WITH CHECK (
  bucket_id = 'assessment-photos'
  AND (storage.foldername(name))[1] = 'employee'
  AND (
    public.is_org_admin()
    OR substring(name from '^employee/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/')::uuid IN (SELECT public.user_complex_ids())
  )
);

CREATE POLICY "직원참여 사진 삭제"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'assessment-photos'
  AND (storage.foldername(name))[1] = 'employee'
  AND (
    public.is_org_admin()
    OR substring(name from '^employee/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/')::uuid IN (SELECT public.user_complex_ids())
  )
);