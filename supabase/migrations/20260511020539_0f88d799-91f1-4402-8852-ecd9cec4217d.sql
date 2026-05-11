
INSERT INTO storage.buckets (id, name, public)
VALUES ('assessment-photos', 'assessment-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "평가사진 공개 조회"
ON storage.objects FOR SELECT
USING (bucket_id = 'assessment-photos');

CREATE POLICY "평가사진 업로드"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'assessment-photos');

CREATE POLICY "평가사진 수정"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'assessment-photos');

CREATE POLICY "평가사진 삭제"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'assessment-photos');
