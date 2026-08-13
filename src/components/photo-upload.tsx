import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Camera, X, Loader2 } from "lucide-react";
import { SignedImg } from "@/components/signed-img";
import { compressImage } from "@/lib/image-compress";
import { toast } from "sonner";

interface Props {
  assessmentId: string;
  hazardId: string;
  photos: string[];
  onChange: (urls: string[]) => void;
  max?: number;                 // 최대 장수(초과 시 추가 버튼 숨김)
  variant?: "thumb" | "sheet";  // thumb=작은 썸네일(기본), sheet=사진 대지용 크게(갯수따라 크기)
}

export function PhotoUpload({ assessmentId, hazardId, photos, onChange, max, variant = "thumb" }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const canAdd = max == null || photos.length < max;

  async function upload(files: FileList) {
    setBusy(true);
    const urls: string[] = [...photos];
    const room = max == null ? Infinity : Math.max(0, max - photos.length);
    try {
      for (const file of Array.from(files).slice(0, room)) {
        const isImage = file.type.startsWith("image/");
        const body = isImage ? await compressImage(file) : file;
        const jpg = body !== file; // 압축 성공 시에만 jpeg (HEIC 등 실패 시 원본 유지)
        const ext = jpg ? "jpg" : (file.name.split(".").pop() || "bin");
        const path = `${assessmentId}/${hazardId}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
        const { error } = await supabase.storage.from("assessment-photos").upload(path, body, {
          contentType: jpg ? "image/jpeg" : (file.type || "application/octet-stream"), upsert: false,
        });
        if (error) throw error;
        const { data } = supabase.storage.from("assessment-photos").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      onChange(urls);
    } catch (e: any) {
      toast.error(e.message ?? "업로드 실패");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function remove(idx: number) {
    onChange(photos.filter((_, i) => i !== idx));
  }

  const inputEl = (
    <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple={max == null || max - photos.length > 1}
      className="hidden" onChange={e => e.target.files && upload(e.target.files)} />
  );

  // 사진 대지용: 크게, 갯수에 따라 크기 자동(1장=칸 전체, 2장=반반).
  if (variant === "sheet") {
    return (
      <div className="w-full space-y-1.5">
        {photos.length > 0 && (
          <div className={`grid gap-1.5 ${photos.length >= 2 ? "grid-cols-2" : "grid-cols-1"}`}>
            {photos.map((url, i) => (
              <div key={i} className="relative">
                <SignedImg src={url} alt="" className="w-full aspect-[4/3] object-cover border rounded" />
                <button onClick={() => remove(i)} type="button"
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 print:hidden">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        {canAdd && (
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
            className="w-full h-14 rounded-md border-2 border-dashed border-border flex items-center justify-center gap-1.5 text-muted-foreground hover:border-primary hover:text-primary text-xs print:hidden">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {busy ? "업로드 중" : `사진 추가${max ? ` (최대 ${max}장)` : ""}`}
          </button>
        )}
        {photos.length === 0 && <span className="hidden print:inline text-[10px] text-muted-foreground">사진 없음</span>}
        {inputEl}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {photos.map((url, i) => (
          <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border bg-muted">
            <SignedImg src={url} alt="" className="w-full h-full object-cover" />
            <button onClick={() => remove(i)} type="button"
              className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 print:hidden">
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {canAdd && (
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
            className="w-20 h-20 rounded-md border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary text-[10px] gap-1 print:hidden">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
            {busy ? "업로드 중" : "사진 추가"}
          </button>
        )}
      </div>
      {inputEl}
    </div>
  );
}
