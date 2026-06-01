import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { compressImage } from "@/lib/image-compress";
import { getCurrentUserContext } from "@/lib/user-context";

export const Route = createFileRoute("/_app/near-miss/new")({
  component: NewNearMiss,
});

const LOC_OPTIONS = ["지하주차장","옥상","기계실","저수조","공용계단","엘리베이터","기타"];
const TYPE_OPTIONS = ["전도","추락","끼임","감전","화재","중독","기타"];
const SEV_OPTIONS = ["인적","물적","없음"];

function NewNearMiss() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [userRowId, setUserRowId] = useState<string>("");
  const [orgId, setOrgId] = useState<string>("");
  const [complexes, setComplexes] = useState<{id:string;name:string}[]>([]);
  const [complexId, setComplexId] = useState("");
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0,16));
  const [incidentName, setIncidentName] = useState("");
  const [locCat, setLocCat] = useState(LOC_OPTIONS[0]);
  const [locDetail, setLocDetail] = useState("");
  const [type, setType] = useState(TYPE_OPTIONS[0]);
  const [desc, setDesc] = useState("");
  const [severity, setSeverity] = useState(SEV_OPTIONS[2]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [countermeasure, setCountermeasure] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    getCurrentUserContext(user.id).then(async ({ userId, complexId: ctxComplex, userRow }) => {
      if (userId) setUserRowId(userId);
      if (userRow?.organization_id) setOrgId(userRow.organization_id);
      const { data: members } = await supabase.from("complex_members").select("complex_id").eq("user_id", userId ?? "");
      const ids = [...new Set((members ?? []).map((m:any)=>m.complex_id).filter(Boolean))];
      const { data: list } = ids.length
        ? await supabase.from("complexes").select("id,name").in("id", ids)
        : { data: [] };
      setComplexes(list ?? []);
      setComplexId(ctxComplex ?? list?.[0]?.id ?? "");
    });
  }, [user]);

  async function uploadPhotos(files: FileList) {
    setBusy(true);
    const newUrls = [...photos];
    try {
      for (const f of Array.from(files)) {
        const blob = await compressImage(f);
        const path = `${user?.id ?? "anon"}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.jpg`;
        const { error } = await supabase.storage.from("near-miss-photos").upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw error;
        const { data } = supabase.storage.from("near-miss-photos").getPublicUrl(path);
        newUrls.push(data.publicUrl);
      }
      setPhotos(newUrls);
    } catch (e:any) {
      toast.error(e.message ?? "업로드 실패");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit() {
    if (!complexId) { toast.error("단지를 선택해주세요"); return; }
    if (!desc.trim()) { toast.error("사고 경위를 입력해주세요"); return; }
    setSaving(true);
    const { error } = await (supabase as any).from("near_miss").insert({
      complex_id: complexId,
      organization_id: orgId || null,
      reported_by: userRowId || null,
      occurred_at: new Date(occurredAt).toISOString(),
      incident_name: incidentName || null,
      situation: desc,
      location_category: locCat,
      location_detail: locDetail || null,
      incident_type: type,
      potential_severity: severity,
      photos,
      countermeasure: countermeasure || null,
      countermeasure_completed: false,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("아차사고가 등록되었습니다");
    navigate({ to: "/near-miss" });
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-4">
      <Link to="/near-miss"><Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4"/>목록</Button></Link>
      <h1 className="text-2xl font-bold">아차사고 신고</h1>

      <Card><CardContent className="p-5 space-y-4">
        {complexes.length > 1 && (
          <div>
            <Label>단지</Label>
            <select value={complexId} onChange={e=>setComplexId(e.target.value)} className="w-full h-11 px-3 rounded-md border bg-background text-sm mt-1">
              {complexes.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <Label>사건/사고명</Label>
          <Input value={incidentName} onChange={e=>setIncidentName(e.target.value)} placeholder="예: 지하주차장 미끄러짐 아차사고" className="h-11 mt-1" />
        </div>
        <div>
          <Label>발생 일시</Label>
          <Input type="datetime-local" value={occurredAt} onChange={e=>setOccurredAt(e.target.value)} className="h-11 mt-1" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>발생 장소</Label>
            <select value={locCat} onChange={e=>setLocCat(e.target.value)} className="w-full h-11 px-3 rounded-md border bg-background text-sm mt-1">
              {LOC_OPTIONS.map(o=> <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <Label>사고 유형</Label>
            <select value={type} onChange={e=>setType(e.target.value)} className="w-full h-11 px-3 rounded-md border bg-background text-sm mt-1">
              {TYPE_OPTIONS.map(o=> <option key={o}>{o}</option>)}
            </select>
          </div>
        </div>
        <div>
          <Label>상세 위치</Label>
          <Input value={locDetail} onChange={e=>setLocDetail(e.target.value)} placeholder="예: 101동 지하 2층 B-12 구역" className="h-11 mt-1" />
        </div>
        <div>
          <Label>사고 경위</Label>
          <Textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={4} placeholder="어떤 상황이 발생했는지 구체적으로 작성해주세요" className="mt-1" />
        </div>
        <div>
          <Label>예상 피해 정도</Label>
          <div className="flex gap-2 mt-1">
            {SEV_OPTIONS.map(s=>(
              <button key={s} type="button" onClick={()=>setSeverity(s)}
                className={`flex-1 py-2.5 rounded-md border text-sm font-medium ${severity===s?"bg-primary text-primary-foreground border-primary":"bg-background"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>사진 (선택, 자동 압축됩니다)</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {photos.map((url,i)=>(
              <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button onClick={()=>setPhotos(photos.filter((_,j)=>j!==i))} type="button" className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5">
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
        <div>
          <Label>재발 방지 조치 (선택)</Label>
          <Textarea value={countermeasure} onChange={e=>setCountermeasure(e.target.value)} rows={2} className="mt-1" />
        </div>

        <Button onClick={submit} disabled={saving} className="w-full h-12">
          {saving ? "등록 중..." : "신고 등록"}
        </Button>
      </CardContent></Card>
    </div>
  );
}
