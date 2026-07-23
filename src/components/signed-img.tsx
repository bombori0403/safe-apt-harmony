import { useEffect, useState } from "react";
import { getSignedUrl } from "@/lib/storage";

// 비공개 버킷 사진을 시간제한 서명 URL로 안전하게 표시한다.
// 기존 <img src={공개URL}> 자리에 그대로 끼워 넣으면 된다(className 등 그대로 유지).
export function SignedImg({
  src,
  ...props
}: { src: string } & React.ImgHTMLAttributes<HTMLImageElement>) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let alive = true;
    getSignedUrl(src).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [src]);
  // 아직 서명 URL이 준비되지 않으면 src 없이 렌더(className으로 자리/크기는 유지).
  return <img src={url || undefined} {...props} />;
}
