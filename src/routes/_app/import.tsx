import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getCurrentUserContext } from "@/lib/user-context";
import { useSubscription } from "@/hooks/use-subscription";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Upload, Loader2, FileSpreadsheet, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { ParsedSheet } from "@/lib/xlsx-import";
import { riskLevelClass, type RiskLevel } from "@/lib/types";

export const Route = createFileRoute("/_app/import")({ component: ImportPage });

function ImportPage() {
  const { user } = useAuth();
  const sub = useSubscription();
  const navigate = useNavigate();
  const [userRowId, setUserRowId] = useState<string | null>(null);
  const [complexes, setComplexes] = useState<any[]>([]);
  const [complexId, setComplexId] = useState("");
  const [parsing, setParsing] = useState(false);
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [allSheetNames, setAllSheetNames] = useState<string[]>([]);
  const [pick, setPick] = useState(0);
  const [workName, setWorkName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    getCurrentUserContext(user.id).then(async ({ userId, complexId }) => {
      if (userId) setUserRowId(userId);
      const { data: members } = await supabase.from("complex_members").select("complex_id").eq("user_id", userId ?? "");
      const ids = [...new Set((members ?? []).map((m: any) => m.complex_id).filter(Boolean))];
      const { data: list } = ids.length
        ? await supabase.from("complexes").select("id, name").in("id", ids).order("created_at", { ascending: true })
        : { data: [] as any[] };
      setComplexes(list ?? []);
      if (complexId) setComplexId(complexId);
      else if ((list ?? [])[0]) setComplexId((list ?? [])[0].id);
    });
  }, [user]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true); setSheets([]);
    try {
      const buf = await file.arrayBuffer();
      const { parseWorkbook } = await import("@/lib/xlsx-import");
      const { all, parsed } = await parseWorkbook(buf);
      setAllSheetNames(all);
      setSheets(parsed);
      setPick(0);
      if (parsed[0]) setWorkName(file.name.replace(/\.(xlsx|xls|csv)$/i, "") + " 위험성평가");
      if (!parsed.length) toast.error("표준서식 형식의 위험성평가 시트를 찾지 못했습니다.");
      else toast.success(`${parsed.length}개 시트에서 위험요인을 인식했습니다.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "파일을 읽지 못했습니다.");
    } finally {
      setParsing(false);
      e.target.value = "";
    }
  }

  const sheet = sheets[pick];

  async function doImport() {
    if (!sheet) return;
    if (!complexId) { toast.error("단지를 선택하세요"); return; }
    if (!workName.trim()) { toast.error("평가명을 입력하세요"); return; }
    if (sub.isTrial) {
      const { count } = await supabase.from("assessments").select("id", { count: "exact", head: true });
      if ((count ?? 0) >= 10) { toast.error("체험판은 평가 10건까지 작성할 수 있습니다. 정식 전환 후 계속하세요."); return; }
    }
    setSaving(true);
    try {
      const { data: a, error } = await supabase.from("assessments").insert({
        complex_id: complexId,
        created_by: userRowId || null,
        assessment_type: "정기평가",
        work_name: workName.trim(),
        method: sheet.method,
        assessment_date: date,
        allowable_level: "낮음",
        status: "작성중",
      }).select().single();
      if (error) throw error;

      const hazardRows = sheet.rows.map((r) => ({
        assessment_id: a.id,
        description: r.description,
        likelihood: r.likelihood ?? null,
        severity: r.severity ?? null,
        level: r.level ?? null,
        level_standardized: r.level ?? null,
        legal_basis_override: r.legalBasis ?? null,
      }));
      const { data: hz, error: he } = await supabase.from("hazards").insert(hazardRows).select("id");
      if (he) throw he;

      const measureRows: any[] = [];
      (hz ?? []).forEach((h, i) => {
        const r = sheet.rows[i];
        if (r?.measure && r.measure.trim()) {
          measureRows.push({
            hazard_id: h.id, content: r.measure.trim(), type: "관리적_대책",
            status: r.done ? "완료" : "대기",
            due_date: r.dueDate ?? null,
            completed_at: r.done ? new Date().toISOString() : null,
          });
        }
      });
      if (measureRows.length) await supabase.from("measures").insert(measureRows).then(() => {}, () => {});

      toast.success(`가져오기 완료 — 위험요인 ${hazardRows.length}건, 감소대책 ${measureRows.length}건`);
      navigate({ to: "/assessment/$id", params: { id: a.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "가져오기 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">엑셀 가져오기</h1>
          <p className="text-sm text-muted-foreground mt-1">기존 위험성평가 엑셀(표준서식)을 업로드하면 평가로 자동 변환합니다.</p>
        </div>
        <Link to="/history"><Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />평가 이력</Button></Link>
      </div>

      <Card><CardContent className="p-5 space-y-4">
        <div>
          <Label>엑셀 파일 (.xlsx)</Label>
          <div className="mt-2 flex items-center gap-3">
            <label className="inline-flex items-center gap-2 h-11 px-4 rounded-md border border-dashed cursor-pointer hover:border-primary hover:text-primary text-sm">
              {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {parsing ? "분석 중..." : "파일 선택"}
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile} disabled={parsing} />
            </label>
            <span className="text-xs text-muted-foreground">위험발생상황·법적기준·빈도·강도·감소대책 열을 자동 인식합니다.</span>
          </div>
        </div>

        {sheets.length > 0 && (
          <>
            <div>
              <Label>가져올 시트</Label>
              <div className="mt-1.5 space-y-1.5">
                {sheets.map((s, i) => (
                  <label key={i} className="flex items-center gap-2.5 p-2.5 rounded-md border cursor-pointer hover:bg-muted/40 text-sm">
                    <input type="radio" checked={pick === i} onChange={() => setPick(i)} />
                    <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{s.sheetName}</span>
                    <Badge variant="secondary">{s.method}</Badge>
                    <span className="text-muted-foreground">위험요인 {s.rows.length}건</span>
                  </label>
                ))}
              </div>
              {allSheetNames.length > sheets.length && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  인식 안 된 시트({allSheetNames.length - sheets.length}개)는 표준서식 열 구조가 아니어서 제외했습니다.
                </p>
              )}
            </div>

            {sheet && sheet.rows.length > 100 && (
              <div className="flex items-start gap-2 text-xs text-warning-foreground bg-warning/10 rounded-md p-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                위험요인이 {sheet.rows.length}건으로 많습니다. 여러 단지가 합쳐진 시트일 수 있어요 — 한 단지 시트를 쓰는 것을 권장합니다.
              </div>
            )}

            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <Label>단지</Label>
                <select value={complexId} onChange={(e) => setComplexId(e.target.value)} className="w-full h-10 px-3 rounded-md border bg-background text-sm mt-1">
                  {complexes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <Label>평가명</Label>
                <Input value={workName} onChange={(e) => setWorkName(e.target.value)} className="h-10 mt-1" />
              </div>
              <div>
                <Label>평가일</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 mt-1" />
              </div>
            </div>
          </>
        )}
      </CardContent></Card>

      {sheet && (
        <Card><CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">미리보기 <span className="text-sm text-muted-foreground">({sheet.rows.length}건 중 상위 {Math.min(sheet.rows.length, 30)}건)</span></h2>
            <Button onClick={doImport} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {saving ? "가져오는 중..." : `${sheet.rows.length}건 가져오기`}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px] border-collapse">
              <thead>
                <tr className="border-b-2 border-border text-left text-muted-foreground">
                  <th className="py-1.5 pr-2 w-8">No</th>
                  <th className="py-1.5 pr-2">유해·위험요인</th>
                  <th className="py-1.5 pr-2 w-24">법적기준</th>
                  {sheet.method === "빈도강도법" && <th className="py-1.5 pr-2 w-16 text-center">빈도·강도</th>}
                  <th className="py-1.5 pr-2 w-14 text-center">위험성</th>
                  <th className="py-1.5 pr-2">감소대책</th>
                </tr>
              </thead>
              <tbody>
                {sheet.rows.slice(0, 30).map((r, i) => (
                  <tr key={i} className="border-b align-top">
                    <td className="py-1.5 pr-2 text-muted-foreground">{i + 1}</td>
                    <td className="py-1.5 pr-2">{r.description}</td>
                    <td className="py-1.5 pr-2 text-muted-foreground">{r.article ?? "-"}</td>
                    {sheet.method === "빈도강도법" && <td className="py-1.5 pr-2 text-center">{r.likelihood ?? "-"}×{r.severity ?? "-"}</td>}
                    <td className="py-1.5 pr-2 text-center">
                      {r.level ? <span className={`px-1.5 py-0.5 rounded text-[11px] ${riskLevelClass(r.level as RiskLevel)}`}>{r.level}</span> : "-"}
                    </td>
                    <td className="py-1.5 pr-2 text-muted-foreground">{r.measure ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent></Card>
      )}
    </div>
  );
}
