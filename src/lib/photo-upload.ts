import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compress";

/**
 * 여러 장의 사진을 압축해 비공개 버킷에 업로드하고, 저장용 URL 배열을 반환한다.
 * 표시는 언제나 SignedImg/getSignedUrl로 재서명하므로 getPublicUrl 값을 저장해도 무방
 * (parseStorageRef가 버킷/경로를 추출해 서명 URL을 다시 발급한다). near-miss 패턴과 동일.
 */
export async function uploadPhotos(
  files: FileList | File[],
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const urls: string[] = [];
  for (const f of Array.from(files)) {
    const blob = await compressImage(f);
    const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: "image/jpeg" });
    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}
