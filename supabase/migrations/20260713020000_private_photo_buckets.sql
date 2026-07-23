-- 사진 버킷(assessment-photos, near-miss-photos)을 비공개로 전환한다.
-- 그동안 public=true + 공개 SELECT 정책이라, 아차사고/현장 사진이 URL만 알면
-- 로그인 없이 열람 가능했음(개인정보 유출 위험). 앞으로는 서명 URL(signed URL)로만
-- 인증된 사용자가 접근한다. 프런트는 SignedImg/getSignedUrl로 이미 전환됨.

-- 1) 버킷 비공개화 (공개 URL 경로 자체가 사라짐)
UPDATE storage.buckets
SET public = false
WHERE id IN ('assessment-photos', 'near-miss-photos');

-- 2) 기존 storage.objects 정책 전부 제거 (이 프로젝트는 사진 버킷 2개만 사용)
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- 3) 인증 사용자 전용 정책으로 재구성 (anon 접근 불가 → 공개 유출 차단)
CREATE POLICY "photos_auth_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id IN ('assessment-photos', 'near-miss-photos'));

CREATE POLICY "photos_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('assessment-photos', 'near-miss-photos'));

CREATE POLICY "photos_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id IN ('assessment-photos', 'near-miss-photos'));

CREATE POLICY "photos_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id IN ('assessment-photos', 'near-miss-photos'));
