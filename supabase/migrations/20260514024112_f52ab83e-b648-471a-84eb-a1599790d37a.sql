
-- 1) Helper function: can current auth user access this assessment?
CREATE OR REPLACE FUNCTION public.can_access_assessment(_assessment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM assessments a
    WHERE a.id = _assessment_id
      AND (
        a.complex_id IN (
          SELECT cm.complex_id FROM complex_members cm
          JOIN users u ON u.id = cm.user_id
          WHERE u.auth_id = auth.uid()
        )
        OR a.complex_id IN (
          SELECT cx.id FROM complexes cx
          JOIN companies c ON c.id = cx.company_id
          JOIN users u ON u.id = c.super_admin_user_id
          WHERE u.auth_id = auth.uid()
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_assessment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_assessment(uuid) TO authenticated;

-- 2) Lock down internal trigger functions (only invoked via triggers)
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_sample_data_for_user(uuid) FROM PUBLIC, anon, authenticated;

-- 3) Tighten complexes INSERT: only super_admin of the target company may create
DROP POLICY IF EXISTS "complexes_insert" ON public.complexes;
DROP POLICY IF EXISTS "단지 생성" ON public.complexes;
CREATE POLICY "complexes_insert" ON public.complexes
FOR INSERT TO authenticated
WITH CHECK (
  company_id IN (
    SELECT c.id FROM companies c
    JOIN users u ON u.id = c.super_admin_user_id
    WHERE u.auth_id = auth.uid()
  )
);

-- 4) Storage policies for assessment-photos: scope by assessment access
DROP POLICY IF EXISTS "평가사진 공개 조회" ON storage.objects;
DROP POLICY IF EXISTS "평가사진 업로드" ON storage.objects;
DROP POLICY IF EXISTS "평가사진 수정" ON storage.objects;
DROP POLICY IF EXISTS "평가사진 삭제" ON storage.objects;

-- Public read of individual files via direct URL still works because the bucket is public.
-- This SELECT policy controls SDK listing — restrict to users who can access the assessment.
CREATE POLICY "평가사진 조회"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'assessment-photos'
  AND public.can_access_assessment(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "평가사진 업로드"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'assessment-photos'
  AND public.can_access_assessment(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "평가사진 수정"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'assessment-photos'
  AND public.can_access_assessment(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "평가사진 삭제"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'assessment-photos'
  AND public.can_access_assessment(((storage.foldername(name))[1])::uuid)
);
