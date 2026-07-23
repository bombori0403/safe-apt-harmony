import { supabase } from "@/integrations/supabase/client";

// 저장된 사진 값(공개 URL 또는 경로)에서 버킷/경로를 추출한다.
// 과거 데이터: https://<proj>.supabase.co/storage/v1/object/public/<bucket>/<path>
// 서명 URL   : .../object/sign/<bucket>/<path>?token=...
export function parseStorageRef(stored: string): { bucket: string; path: string } | null {
  if (!stored) return null;
  const m = stored.match(/\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+?)(?:\?|$)/);
  if (m) return { bucket: m[1], path: decodeURIComponent(m[2]) };
  return null;
}

// 이미 발급받은 서명 URL을 재사용하기 위한 간단한 캐시(만료 1분 전까지 재사용).
const cache = new Map<string, { url: string; exp: number }>();

// 비공개 버킷의 사진을 볼 수 있는 시간제한 서명 URL을 발급한다.
// data: URL이나 알 수 없는 형식은 그대로 반환한다.
export async function getSignedUrl(stored: string, expiresIn = 3600): Promise<string> {
  if (!stored) return "";
  if (stored.startsWith("data:") || stored.startsWith("blob:")) return stored;
  const ref = parseStorageRef(stored);
  if (!ref) return stored;
  const key = `${ref.bucket}/${ref.path}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.exp > now + 60000) return hit.url;
  const { data } = await supabase.storage.from(ref.bucket).createSignedUrl(ref.path, expiresIn);
  const url = data?.signedUrl ?? "";
  if (url) cache.set(key, { url, exp: now + expiresIn * 1000 });
  return url;
}

// 여러 장을 한 번에 서명 URL로 변환.
export async function getSignedUrls(stored: string[], expiresIn = 3600): Promise<string[]> {
  return Promise.all((stored ?? []).map((s) => getSignedUrl(s, expiresIn)));
}
