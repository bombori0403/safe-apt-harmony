import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Camera, Loader2, Pencil, Printer, X } from "lucide-react";
import { toast } from "sonner";
import { compressImage } from "@/lib/image-compress";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/near-miss/$id")({
  component: NearMissDetail,
});

const LOC_OPTIONS = ["지하주차장", "옥상", "기계실", "저수조", "공용계단", "엘리베이터", "기타"];
const TYPE_OPTIONS = ["전도", "추락", "끼임", "감전", "화재", "중독", "기타"];
const SEV_OPTIONS = ["인적", "물적", "없음"];

function NearMissDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const incFileRef = useRef<HTMLInputElement>(null);
  const [item, setItem] = useState<any>(null);
  const [complex, setComplex] = useState<any>(null);

  // editable fields
  const [editing, setEditing] = useState(false);
  const [incidentName, setIncidentName] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [locCat, setLocCat] = useState(LOC_OPTIONS[0]);
  const [locDetail, setLocDetail] = useState("");
  const [type, setType] = useState(TYPE_OPTIONS[0]);
  const [severity, setSeverity] = useState(SEV_OPTIONS[2]);
  const [situation, setSituation] = useState("");
  const [incPhotos, setIncPhotos] = useState<string[]>([]);

  // countermeasure
  const [countermeasure, setCountermeasure] = useState("");
  const [completed, setCompleted] = useState(false);
  const [cmPhotos, setCmPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [incBusy, setIncBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [id]);
  async function load() {
    const { data } = await (supabase as any)
      .from("near_miss")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    setItem(data);
    if (data) {
      setIncidentName(data.incident_name ?? "");
      setOccurredAt(data.occurred_at ? new Date(data.occurred_at).toISOString().slice(0, 16) : "");
      setLocCat(data.location_category ?? LOC_OPTIONS[0]);
      setLocDetail(data.location_detail ?? "");
      setType(data.incident_type ?? TYPE_OPTIONS[0]);
      setSeverity(data.potential_severity ?? SEV_OPTIONS[2]);
      setSituation(data.situation ?? "");
      setIncPhotos(Array.isArray(data.photos) ? data.photos : []);
      setCountermeasure(data.countermeasure ?? "");
      setCompleted(!!data.countermeasure_completed);
      setCmPhotos(Array.isArray(data.countermeasure_photos) ? data.countermeasure_photos : []);
    }
    if (data?.complex_id) {
      const { data: c } = await supabase
        .from("complexes")
        .select("name,address,manager_name,manager_phone")
        .eq("id", data.complex_id)
        .maybeSingle();
      setComplex(c);
    }
  }

  async function uploadTo(bucketKey: "cm" | "inc", files: FileList) {
    const setBusyFn = bucketKey === "cm" ? setBusy : setIncBusy;
    const prefix = bucketKey === "cm" ? "cm" : "inc";
    const list = bucketKey === "cm" ? cmPhotos : incPhotos;
    const setList = bucketKey === "cm" ? setCmPhotos : setIncPhotos;
    setBusyFn(true);
    const urls = [...list];
    try {
      for (const f of Array.from(files)) {
        const blob = await compressImage(f);
        const path = `${user?.id ?? "anon"}/${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await supabase.storage
          .from("near-miss-photos")
          .upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw error;
        const { data } = supabase.storage.from("near-miss-photos").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      setList(urls);
    } catch (e: any) {
      toast.error(e.message ?? "업로드 실패");
    } finally {
      setBusyFn(false);
      if (bucketKey === "cm" && fileRef.current) fileRef.current.value = "";
      if (bucketKey === "inc" && incFileRef.current) incFileRef.current.value = "";
    }
  }

  async function save() {
    setSaving(true);
    const payload: any = {
      countermeasure: countermeasure || null,
      countermeasure_completed: completed,
      countermeasure_photos: cmPhotos,
    };
    if (editing) {
      payload.incident_name = incidentName || null;
      payload.occurred_at = occurredAt ? new Date(occurredAt).toISOString() : item.occurred_at;
      payload.location_category = locCat;
      payload.location_detail = locDetail || null;
      payload.incident_type = type;
      payload.potential_severity = severity;
      payload.situation = situation;
      payload.photos = incPhotos;
    }
    const { data: updated, error } = await (supabase as any)
      .from("near_miss")
      .update(payload)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (updated) setItem(updated);
    toast.success("저장되었습니다");
    setEditing(false);
    load();
  }

  async function remove() {
    if (!confirm("삭제하시겠습니까?")) return;
    const { error } = await (supabase as any).from("near_miss").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("삭제되었습니다");
    navigate({ to: "/near-miss" });
  }

  if (!item) return <div className="p-8 text-muted-foreground">불러오는 중...</div>;

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link to="/near-miss">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            목록
          </Button>
        </Link>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button onClick={save} disabled={saving}>
                {saving ? "저장 중..." : "수정 내용 저장"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  load();
                }}
              >
                취소
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setEditing(true)} className="gap-1.5">
              <Pencil className="h-4 w-4" />
              수정
            </Button>
          )}
          <Button onClick={() => window.print()} className="gap-1.5">
            <Printer className="h-4 w-4" />
            인쇄 / PDF 저장
          </Button>
        </div>
      </div>

      <Card className="print:hidden">
        <CardContent className="p-5 space-y-3 text-sm">
          <h1 className="text-xl font-bold">아차사고 {editing ? "수정" : "상세"}</h1>

          {editing ? (
            <div className="space-y-3">
              <div>
                <Label>사건/사고명</Label>
                <Input
                  value={incidentName}
                  onChange={(e) => setIncidentName(e.target.value)}
                  className="h-11 mt-1"
                />
              </div>
              <div>
                <Label>발생 일시</Label>
                <Input
                  type="datetime-local"
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
                  className="h-11 mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>발생 장소</Label>
                  <select
                    value={locCat}
                    onChange={(e) => setLocCat(e.target.value)}
                    className="w-full h-11 px-3 rounded-md border bg-background text-sm mt-1"
                  >
                    {LOC_OPTIONS.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>사고 유형</Label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full h-11 px-3 rounded-md border bg-background text-sm mt-1"
                  >
                    {TYPE_OPTIONS.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <Label>상세 위치</Label>
                <Input
                  value={locDetail}
                  onChange={(e) => setLocDetail(e.target.value)}
                  className="h-11 mt-1"
                />
              </div>
              <div>
                <Label>사고 경위</Label>
                <Textarea
                  value={situation}
                  onChange={(e) => setSituation(e.target.value)}
                  rows={4}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>예상 피해 정도</Label>
                <div className="flex gap-2 mt-1">
                  {SEV_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSeverity(s)}
                      className={`flex-1 py-2.5 rounded-md border text-sm font-medium ${severity === s ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>사고 사진</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {incPhotos.map((url, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setIncPhotos(incPhotos.filter((_, j) => j !== i))}
                        type="button"
                        className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => incFileRef.current?.click()}
                    disabled={incBusy}
                    className="w-20 h-20 rounded-md border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:border-primary text-[10px] gap-1"
                  >
                    {incBusy ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Camera className="h-5 w-5" />
                    )}
                    {incBusy ? "업로드" : "사진 추가"}
                  </button>
                </div>
                <input
                  ref={incFileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && uploadTo("inc", e.target.files)}
                />
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <Button onClick={save} disabled={saving}>
                  {saving ? "저장 중..." : "수정 내용 저장"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditing(false);
                    load();
                  }}
                >
                  취소
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Row label="사건/사고명" value={item.incident_name || "-"} />
              <Row label="발생 일시" value={new Date(item.occurred_at).toLocaleString("ko-KR")} />
              <Row
                label="장소"
                value={`${item.location_category ?? "-"}${item.location_detail ? " · " + item.location_detail : ""}`}
              />
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
                    {incPhotos.map((u, i) => (
                      <a key={i} href={u} target="_blank" rel="noreferrer">
                        <img src={u} alt="" className="w-24 h-24 object-cover rounded border" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="print:hidden">
        <CardContent className="p-5 space-y-3">
          <h2 className="font-semibold">재발 방지 조치</h2>
          <div>
            <Label>조치 내용</Label>
            <Textarea
              value={countermeasure}
              onChange={(e) => setCountermeasure(e.target.value)}
              rows={4}
              className="mt-1"
            />
          </div>
          <div>
            <Label>조치 사진</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {cmPhotos.map((url, i) => (
                <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setCmPhotos(cmPhotos.filter((_, j) => j !== i))}
                    type="button"
                    className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="w-20 h-20 rounded-md border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:border-primary text-[10px] gap-1"
              >
                {busy ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Camera className="h-5 w-5" />
                )}
                {busy ? "업로드" : "사진 추가"}
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && uploadTo("cm", e.target.files)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={completed}
              onChange={(e) => setCompleted(e.target.checked)}
            />
            조치 완료
          </label>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>
              {saving ? "저장 중..." : "저장"}
            </Button>
            <Button variant="outline" onClick={remove} className="text-destructive">
              삭제
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 인쇄용 */}
      <div id="print-area" className="hidden print:block bg-white text-black">
        <div className="text-center border-b-2 border-black pb-3 mb-4">
          <h1 className="text-xl font-bold">아차사고 보고서</h1>
          <p className="text-xs mt-1">
            산업안전보건법에 따른 아차사고(Near-Miss) 발생 및 재발방지 조치 기록
          </p>
        </div>

        <table className="w-full text-sm border-collapse mb-4">
          <tbody>
            <tr className="border border-black/70">
              <th className="bg-gray-100 px-2 py-1.5 w-28 text-left border-r border-black/70">
                단지명
              </th>
              <td className="px-2 py-1.5" colSpan={3}>
                {complex?.name ?? "-"}
              </td>
            </tr>
            <tr className="border border-black/70">
              <th className="bg-gray-100 px-2 py-1.5 text-left border-r border-black/70">
                사건/사고명
              </th>
              <td className="px-2 py-1.5" colSpan={3}>
                {item.incident_name || "-"}
              </td>
            </tr>
            <tr className="border border-black/70">
              <th className="bg-gray-100 px-2 py-1.5 text-left border-r border-black/70">
                발생 일시
              </th>
              <td className="px-2 py-1.5 border-r border-black/70">
                {new Date(item.occurred_at).toLocaleString("ko-KR")}
              </td>
              <th className="bg-gray-100 px-2 py-1.5 text-left border-r border-black/70 w-28">
                사고 유형
              </th>
              <td className="px-2 py-1.5">{item.incident_type ?? "-"}</td>
            </tr>
            <tr className="border border-black/70">
              <th className="bg-gray-100 px-2 py-1.5 text-left border-r border-black/70">
                발생 장소
              </th>
              <td className="px-2 py-1.5 border-r border-black/70">
                {item.location_category ?? "-"}
                {item.location_detail ? ` · ${item.location_detail}` : ""}
              </td>
              <th className="bg-gray-100 px-2 py-1.5 text-left border-r border-black/70">
                예상 피해
              </th>
              <td className="px-2 py-1.5">{item.potential_severity ?? "-"}</td>
            </tr>
          </tbody>
        </table>

        <section className="mb-4">
          <h2 className="font-bold text-sm bg-gray-100 px-2 py-1 border border-black/70">
            ① 사고 경위
          </h2>
          <div className="border border-t-0 border-black/70 p-3 text-sm whitespace-pre-wrap min-h-[60px]">
            {item.situation}
          </div>
          {incPhotos.length > 0 && (
            <div className="border border-t-0 border-black/70 p-3">
              <div className="text-xs font-semibold mb-2">
                사고 현장 사진 ({incPhotos.length}장)
              </div>
              <div className="grid grid-cols-2 gap-2">
                {incPhotos.map((u, i) => (
                  <img
                    key={i}
                    src={u}
                    alt={`사고-${i + 1}`}
                    className="w-full h-40 object-cover border border-black/30"
                    crossOrigin="anonymous"
                  />
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
                {cmPhotos.map((u, i) => (
                  <img
                    key={i}
                    src={u}
                    alt={`조치-${i + 1}`}
                    className="w-full h-40 object-cover border border-black/30"
                    crossOrigin="anonymous"
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="border border-t-0 border-black/70 p-3 text-xs text-gray-600">
              조치 사진 없음
            </div>
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
          ※ 본 보고서는 산업재해로 이어질 수 있었던 아차사고 사례를 기록하여 동일·유사 사고의 재발을
          방지하기 위한 자료입니다.
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
