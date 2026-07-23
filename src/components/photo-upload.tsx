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
}

export function PhotoUpload({ assessmentId, hazardId, photos, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(files: FileList) {
    setBusy(true);
    const urls: string[] = [...photos];
    try {
      for (const file of Array.from(files)) {
        const isImage = file.type.startsWith("image/");
        const body = isImage ? await compressImage(file) : file;
        const ext = isImage ? "jpg" : (file.name.split(".").pop() || "bin");
        const path = `${assessmentId}/${hazardId}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
        const { error } = await supabase.storage.from("assessment-photos").upload(path, body, {
          contentType: isImage ? "image/jpeg" : file.type, upsert: false,
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

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {photos.map((url, i) => (
          <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border bg-muted">
            <SignedImg src={url} alt="" className="w-full h-full object-cover" />
            <button onClick={() => remove(i)} type="button"
              className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5">
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
          className="w-20 h-20 rounded-md border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary text-[10px] gap-1">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
          {busy ? "업로드 중" : "사진 추가"}
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple
        className="hidden" onChange={e => e.target.files && upload(e.target.files)} />
    </div>
  );
}
