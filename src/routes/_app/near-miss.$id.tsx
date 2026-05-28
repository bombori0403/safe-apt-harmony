import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Camera, Loader2, Printer, X } from "lucide-react";
import { toast } from "sonner";
import { compressImage } from "@/lib/image-compress";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/near-miss/$id")({
  component: NearMissDetail,
});

function NearMissDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [item, setItem] = useState<any>(null);
  const [complex, setComplex] = useState<any>(null);
  const [countermeasure, setCountermeasure] = useState("");
  const [completed, setCompleted] = useState(false);
  const [cmPhotos, setCmPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);
  async function load() {
    const { data } = await (supabase as any).from("near_miss").select("*").eq("id", id).maybeSingle();
    setItem(data);
    setCountermeasure(data?.countermeasure ?? "");
    setCompleted(!!data?.countermeasure_completed);
    setCmPhotos(Array.isArray(data?.countermeasure_photos) ? data.countermeasure_photos : []);
    if (data?.complex_id) {
      const { data: c } = await supabase.from("complexes").select("name,address,manager_name,manager_phone").eq("id", data.complex_id).maybeSingle();
      setComplex(c);
    }
  }

  async function uploadPhotos(files: FileList) {
    setBusy(true);
    const urls = [...cmPhotos];
    try {
      for (const f of Array.from(files)) {
        const blob = await compressImage(f);
        const path = `${user?.id ?? "anon"}/cm-${Date.now()}-${Math.random().toString(36).slice(2,8)}.jpg`;
        const { error } = await supabase.storage.from("near-miss-photos").upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw error;
        const { data } = supabase.storage.from("near-miss-photos").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      setCmPhotos(urls);
    } catch (e:any) {
      toast.error(e.message ?? "업로드 실패");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    setSaving(true);
    const { error } = await (supabase as any).from("near_miss").update({
      countermeasure: countermeasure || null,
      countermeasure_completed: completed,
      countermeasure_photos: cmPhotos,
    }).eq("id", id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("저장되었습니다");
    load();
  }

  async function remove() {
    if (!confirm("삭제하시겠습니까?")) return;
    const { error } = await (supabase as any).from("near_miss").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("삭제되었습니다");
    navigate({ to: "/near-miss" });
  }

  if (!item) return <div className="p-8 text-muted-foreground">불러오는 중...</div>;

  const incPhotos: string[] = Array.isArray(item.photos) ? item.photos : [];

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link to="/near-miss"><Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4"/>목록</Button></Link>
        <Button onClick={() => window.print()} className="gap-1.5"><Printer className="h-4 w-4"/>인쇄 / PDF 저장</Button>
      </div>

      <Card className="print:hidden"><CardContent className="p-5 space-y-3 text-sm">
        <h1 className="text-xl font-bold">아차사고 상세</h1>
        <Row label="발생 일시" value={new Date(item.occurred_at).toLocaleString("ko-KR")} />
        <Row label="장소" value={`${item.location_category ?? "-"}${item.location_detail ? " · "+item.location_detail : ""}`} />
        <Row label="유형" value={item.incident_type ?? "-"} />
        <Row label="예상 피해" value={item.potential_severity ?? "-"} />
        <div>
          <div className="text-xs text-muted-foreground">사고 경위</div>
          <p className="mt-1 whitespace-pre-wrap">{item.situation}</p>
        </div>
        {incPhotos.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">사고 사진</div>
            <div className="flex flex-wrap gap-2">
              {incPhotos.map((u,i)=>(
                <a key={i} href={u} target="_blank" rel="noreferrer">
                  <img src={u} alt="" className="w-24 h-24 object-cover rounded border" />
                </a>
              ))}
            </div>
          </div>
        )}
      </CardContent></Card>

      <Card className="print:hidden"><CardContent className="p-5 space-y-3">
        <h2 className="font-semibold">재발 방지 조치</h2>
        <div>
          <Label>조치 내용</Label>
          <Textarea value={countermeasure} onChange={e=>setCountermeasure(e.target.value)} rows={4} className="mt-1" />
        </div>
        <div>
          <Label>조치 사진</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {cmPhotos.map((url,i)=>(
              <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button onClick={()=>setCmPhotos(cmPhotos.filter((_,j)=>j!==i))} type="button" className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button type="button" onClick={()=>fileRef.current?.click()} disabled={busy}
              className="w-20 h-20 rounded-md border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:border-primary text-[10px] gap-1">
              {busy ? <Loader2 className="h-5 w-5 animate-spin"/> : <Camera className="h-5 w-5"/>}
              {busy ? "업로드" : "사진 추가"}
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden"
            onChange={e=>e.target.files && uploadPhotos(e.target.files)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={completed} onChange={e=>setCompleted(e.target.checked)} />
          조치 완료
        </label>
        <div className="flex gap-2">
          <Button onClick={save} disabled={saving}>{saving?"저장 중...":"저장"}</Button>
          <Button variant="outline" onClick={remove} className="text-destructive">삭제</Button>
        </div>
      </CardContent></Card>

      {/* 인쇄용 */}
      <div id="print-area" className="hidden print:block bg-white text-black">
        <div className="text-center border-b-2 border-black pb-3 mb-4">
          <h1 className="text-xl font-bold">아차사고 보고서</h1>
          <p className="text-xs mt-1">산업안전보건법에 따른 아차사고(Near-Miss) 발생 및 재발방지 조치 기록</p>
        </div>

        <table className="w-full text-sm border-collapse mb-4">
          <tbody>
            <tr className="border border-black/70">
              <th className="bg-gray-100 px-2 py-1.5 w-28 text-left border-r border-black/70">단지명</th>
              <td className="px-2 py-1.5 border-r border-black/70" colSpan={3}>{complex?.name ?? "-"}</td>
            </tr>
            <tr className="border border-black/70">
              <th className="bg-gray-100 px-2 py-1.5 text-left border-r border-black/70">소재지</th>
              <td className="px-2 py-1.5" colSpan={3}>{complex?.address ?? "-"}</td>
            </tr>
            <tr className="border border-black/70">
              <th className="bg-gray-100 px-2 py-1.5 text-left border-r border-black/70">발생 일시</th>
              <td className="px-2 py-1.5 border-r border-black/70">{new Date(item.occurred_at).toLocaleString("ko-KR")}</td>
              <th className="bg-gray-100 px-2 py-1.5 text-left border-r border-black/70 w-28">사고 유형</th>
              <td className="px-2 py-1.5">{item.incident_type ?? "-"}</td>
            </tr>
            <tr className="border border-black/70">
              <th className="bg-gray-100 px-2 py-1.5 text-left border-r border-black/70">발생 장소</th>
              <td className="px-2 py-1.5 border-r border-black/70">{item.location_category ?? "-"}{item.location_detail ? ` · ${item.location_detail}` : ""}</td>
              <th className="bg-gray-100 px-2 py-1.5 text-left border-r border-black/70">예상 피해</th>
              <td className="px-2 py-1.5">{item.potential_severity ?? "-"}</td>
            </tr>
          </tbody>
        </table>

        <section className="mb-4">
          <h2 className="font-bold text-sm bg-gray-100 px-2 py-1 border border-black/70">① 사고 경위</h2>
          <div className="border border-t-0 border-black/70 p-3 text-sm whitespace-pre-wrap min-h-[60px]">{item.situation}</div>
          {incPhotos.length > 0 && (
            <div className="border border-t-0 border-black/70 p-3">
              <div className="text-xs font-semibold mb-2">사고 현장 사진 ({incPhotos.length}장)</div>
              <div className="grid grid-cols-2 gap-2">
                {incPhotos.map((u,i)=>(
                  <img key={i} src={u} alt={`사고-${i+1}`} className="w-full h-40 object-cover border border-black/30" crossOrigin="anonymous" />
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="mb-4">
          <h2 className="font-bold text-sm bg-gray-100 px-2 py-1 border border-black/70">
            ② 재발 방지 조치 {completed ? "(조치 완료)" : "(조치 진행 중)"}
          </h2>
          <div className="border border-t-0 border-black/70 p-3 text-sm whitespace-pre-wrap min-h-[60px]">
            {countermeasure || "(조치 내용 미기재)"}
          </div>
          {cmPhotos.length > 0 ? (
            <div className="border border-t-0 border-black/70 p-3">
              <div className="text-xs font-semibold mb-2">조치 사진 ({cmPhotos.length}장)</div>
              <div className="grid grid-cols-2 gap-2">
                {cmPhotos.map((u,i)=>(
                  <img key={i} src={u} alt={`조치-${i+1}`} className="w-full h-40 object-cover border border-black/30" crossOrigin="anonymous" />
                ))}
              </div>
            </div>
          ) : (
            <div className="border border-t-0 border-black/70 p-3 text-xs text-gray-600">조치 사진 없음</div>
          )}
        </section>

        <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div className="border border-black/70 p-3">
            <div className="text-xs text-gray-700 mb-6">작성자 확인</div>
            <div className="text-right">________ (인)</div>
          </div>
          <div className="border border-black/70 p-3">
            <div className="text-xs text-gray-700 mb-6">관리감독자 확인</div>
            <div className="text-right">{complex?.manager_name || "________"} (인)</div>
          </div>
        </div>

        <p className="text-[10px] text-gray-600 mt-3 leading-relaxed">
          ※ 본 보고서는 산업재해로 이어질 수 있었던 아차사고 사례를 기록하여 동일·유사 사고의 재발을 방지하기 위한 자료입니다.
        </p>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex border-b pb-2">
      <span className="w-24 text-muted-foreground text-xs">{label}</span>
      <span className="flex-1 font-medium">{value}</span>
    </div>
  );
}
