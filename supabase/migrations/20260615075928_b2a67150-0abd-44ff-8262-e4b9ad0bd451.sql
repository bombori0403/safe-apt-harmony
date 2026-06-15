-- Allow uploading employee-input photos to assessment-photos bucket under "employee/{complex_id}/..."
CREATE POLICY "직원참여 사진 조회" ON storage.objects FOR SELECT
USING (
  bucket_id = 'assessment-photos'
  AND (storage.foldername(name))[1] = 'employee'
  AND (
    public.is_org_admin()
    OR ((storage.foldername(name))[2])::uuid IN (SELECT public.user_complex_ids())
  )
);

CREATE POLICY "직원참여 사진 업로드" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'assessment-photos'
  AND (storage.foldername(name))[1] = 'employee'
  AND (
    public.is_org_admin()
    OR ((storage.foldername(name))[2])::uuid IN (SELECT public.user_complex_ids())
  )
);

CREATE POLICY "직원참여 사진 수정" ON storage.objects FOR UPDATE
USING (
  bucket_id = 'assessment-photos'
  AND (storage.foldername(name))[1] = 'employee'
  AND (
    public.is_org_admin()
    OR ((storage.foldername(name))[2])::uuid IN (SELECT public.user_complex_ids())
  )
);

CREATE POLICY "직원참여 사진 삭제" ON storage.objects FOR DELETE
USING (
  bucket_id = 'assessment-photos'
  AND (storage.foldername(name))[1] = 'employee'
  AND (
    public.is_org_admin()
    OR ((storage.foldername(name))[2])::uuid IN (SELECT public.user_complex_ids())
  )
);