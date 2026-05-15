// Compress an image File to <= maxBytes (default 1MB) by resizing & re-encoding as JPEG.
export async function compressImage(file: File, maxBytes = 1_000_000, maxDim = 1600): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  let { width, height } = bitmap;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, width, height);

  let quality = 0.85;
  let blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", quality));
  while (blob.size > maxBytes && quality > 0.4) {
    quality -= 0.1;
    blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", quality));
  }
  return blob;
}
