import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getCurrentUserContext } from "@/lib/user-context";
import { useSubscription } from "@/hooks/use-subscription";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Upload, Loader2, FileSpreadsheet, Download } from "lucide-react";
import { toast } from "sonner";
import { MAP_FIELDS, type MapSheet, type StdFormResult, type StdHazardRow } from "@/lib/xlsx-import";
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
  const [stdForm, setStdForm] = useState<StdFormResult | null>(null);
  const [mapSheets, setMapSheets] = useState<MapSheet[]>([]);
  const [mapPick, setMapPick] = useState(0);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [origin, setOrigin] = useState<"carryover" | "new">("carryover");
  const [workName, setWorkName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    getCurrentUserContext(user.id).then(async ({ userId, userRow, complexId }) => {
      if (userId) setUserRowId(userId);
      let list: any[] = [];
      if (userRow?.org_role === "admin") {
        list = (await supabase.from("complexes").select("id, name").order("name")).data ?? [];
      } else {
        const { data: members } = await supabase.from("complex_members").select("complex_id").eq("user_id", userId ?? "");
        const ids = [...new Set((members ?? []).map((m: any) => m.complex_id).filter(Boolean))];
        list = ids.length ? (await supabase.from("complexes").select("id, name").in("id", ids).order("name")).data ?? [] : [];
      }
      setComplexes(list);
      if (complexId) setComplexId(complexId);
      else if (list[0]) setComplexId(list[0].id);
    });
  }, [user]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true); setStdForm(null); setMapSheets([]);
    try {
      const buf = await file.arrayBuffer();
      const mod = await import("@/lib/xlsx-import");
      const std = mod.parseStandardForm(buf);
      const { sheets } = mod.readWorkbookForMapping(buf);
      setStdForm(std);
      setMapSheets(sheets);
      setMapPick(0);
      if (sheets[0]) setMapping(mod.guessMapping(sheets[0].columns));
      setWorkName(file.name.replace(/\.(xlsx|xls|csv)$/i, "") + " 위험성평가");
      if (std) toast.success(`표준서식 6종 인식 — 재검토 ${std.carryover} · 신규 ${std.neu} · 감소대책 ${std.measures}건`);
      else if (sheets.length) toast.success(`${sheets.length}개 시트를 읽었습니다. 아래에서 열을 지정하세요.`);
      else toast.error("표를 찾지 못했습니다. 엑셀(.xlsx)인지 확인하세요.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "파일을 읽지 못했습니다.");
    } finally {
      setParsing(false);
      e.target.value = "";
    }
  }

  async function pickSheet(i: number) {
    setMapPick(i);
    const mod = await import("@/lib/xlsx-import");
    if (mapSheets[i]) setMapping(mod.guessMapping(mapSheets[i].columns));
  }

  const ms = mapSheets[mapPick];
  const [preview, setPreview] = useState<StdHazardRow[]>([]);
  useEffect(() => {
    (async () => {
      if (!ms) { setPreview([]); return; }
      const mod = await import("@/lib/xlsx-import");
      setPreview(mod.rowsFromMapping(ms, mapping, origin));
    })();
  }, [ms, mapping, origin]);

  // 공통 커밋: 위험요인(+감소대책) 목록을 한 평가로 생성.
  async function commitImport(hazards: StdHazardRow[], summary: string) {
    if (!complexId) { toast.error("단지를 선택하세요"); return; }
    if (!workName.trim()) { toast.error("평가명을 입력하세요"); return; }
    if (!hazards.length) { toast.error("가져올 위험요인이 없습니다. '위험발생상황' 열이 바르게 지정됐는지 확인하세요."); return; }
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
        method: "3단계_판단법",
        assessment_date: date,
        allowable_level: "낮음",
        status: "작성중",
      }).select().single();
      if (error) throw error;

      // hazard id를 클라이언트에서 미리 만들어 감소대책을 정확히 매칭한다
      // (INSERT ... RETURNING 순서에 의존하지 않음 — 순서가 어긋나면 대책이 엉뚱한 위험요인에 붙을 수 있음).
      const hazardRows = hazards.map((h) => ({
        id: crypto.randomUUID(),
        assessment_id: a.id,
        origin: h.origin,
        description: h.description,
        process_name: h.processName ?? null,
        current_control: h.currentControl ?? null,
        level: h.level ?? null,
        level_standardized: h.level ?? null,
        post_level: h.postLevel ?? null,
        legal_basis_override: h.legalBasis ?? null,
      }));
      const { error: he } = await supabase.from("hazards").insert(hazardRows);
      if (he) throw he;

      const measureRows: any[] = [];
      hazards.forEach((h, i) => {
        for (const m of h.measures ?? []) {
          measureRows.push({
            hazard_id: hazardRows[i].id, content: m.content, type: "관리적_대책",
            status: m.done ? "완료" : "대기",
            completed_at: m.done ? date + "T00:00:00Z" : null,
            due_date: m.dueDate ?? null, responsible_name: m.responsible ?? null,
          });
        }
      });
      let measuresOk = 0;
      if (measureRows.length) {
        const { error: me } = await supabase.from("measures").insert(measureRows);
        if (me) console.error("measures insert 실패:", me);
        else measuresOk = measureRows.length;
      }

      toast.success(`${summary} — 위험요인 ${hazardRows.length}건, 감소대책 ${measuresOk}건`);
      navigate({ to: "/assessment/$id", params: { id: a.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "가져오기 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function doFullImport() {
    if (!stdForm) return;
    await commitImport(stdForm.hazards, `표준서식 전체 가져오기(재검토 ${stdForm.carryover}·신규 ${stdForm.neu})`);
  }
  async function doMappedImport() {
    if (!ms) return;
    const mod = await import("@/lib/xlsx-import");
    await commitImport(mod.rowsFromMapping(ms, mapping, origin), "직접 매핑 가져오기");
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">엑셀 가져오기</h1>
          <p className="text-sm text-muted-foreground mt-1">기존 위험성평가 엑셀을 올리면 평가로 변환합니다. 공단 표준서식은 자동, 그 외 서식은 열을 직접 지정해 가져오세요.</p>
        </div>
        <Link to="/history"><Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />평가 이력</Button></Link>
      </div>

      <Card><CardContent className="p-5 space-y-4">
        <a href="/risk-assessment-template.xlsx" download="위험성평가 실시 결과표(표준서식).xlsx"
          className="inline-flex items-center gap-1.5 text-sm text-primary underline underline-offset-2">
          <Download className="h-4 w-4" />표준서식 양식 내려받기 (빈 양식)
        </a>
        <div>
          <Label>엑셀 파일 (.xlsx / .csv)</Label>
          <div className="mt-2 flex items-center gap-3">
            <label className="inline-flex items-center gap-2 h-11 px-4 rounded-md border border-dashed cursor-pointer hover:border-primary hover:text-primary text-sm">
              {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {parsing ? "분석 중..." : "파일 선택"}
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile} disabled={parsing} />
            </label>
            <span className="text-xs text-muted-foreground">한글(HWP)은 엑셀로 저장 후 올려주세요.</span>
          </div>
        </div>

        {stdForm && (
          <div className="rounded-lg border-2 border-primary/40 bg-primary/[0.04] p-4">
            <div className="flex items-start gap-2">
              <div className="p-1.5 rounded-md bg-primary/15 text-primary shrink-0"><FileSpreadsheet className="h-5 w-5" /></div>
              <div className="flex-1">
                <div className="font-semibold">공단 표준서식(6종) 감지 <Badge className="ml-1">자동</Badge></div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  재검토(과년도) <b className="text-foreground">{stdForm.carryover}건</b> · 신규 <b className="text-foreground">{stdForm.neu}건</b> · 감소대책 <b className="text-foreground">{stdForm.measures}건</b>을
                  한 번에 불러옵니다. <b>현재조치·담당자·개선예정일</b>까지 포함돼요.
                </p>
                <div className="mt-2">
                  <Button onClick={doFullImport} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {saving ? "가져오는 중..." : "표준서식 전체 가져오기"}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">※ 사진(변경 전/후)은 엑셀에서 못 가져와요. 앱의 감소대책 화면에서 따로 올려주세요.</p>
              </div>
            </div>
          </div>
        )}
      </CardContent></Card>

      {/* 직접 열 지정 — 어떤 서식이든 대응 */}
      {ms && (
        <Card><CardContent className="p-5 space-y-4">
          <div>
            <h2 className="font-semibold">{stdForm ? "직접 열 지정 (다른 서식이면 이걸로)" : "열 지정해서 가져오기"}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              업로드한 파일의 각 열이 앱의 어떤 항목인지 짝지어 주세요. 앱이 미리 추측해 뒀으니 <b>틀린 것만 고치면</b> 됩니다.
            </p>
          </div>

          {mapSheets.length > 1 && (
            <div>
              <Label className="text-xs">가져올 시트</Label>
              <select value={mapPick} onChange={(e) => pickSheet(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-md border bg-background text-sm mt-1">
                {mapSheets.map((s, i) => <option key={i} value={i}>{s.sheetName} ({s.rows.length}행)</option>)}
              </select>
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">단지</Label>
              <select value={complexId} onChange={(e) => setComplexId(e.target.value)} className="w-full h-10 px-3 rounded-md border bg-background text-sm mt-1">
                {complexes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">평가명</Label>
              <Input value={workName} onChange={(e) => setWorkName(e.target.value)} className="h-10 mt-1" />
            </div>
            <div>
              <Label className="text-xs">평가일</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 mt-1" />
            </div>
          </div>

          <div>
            <Label className="text-xs">구분</Label>
            <select value={origin} onChange={(e) => setOrigin(e.target.value as "carryover" | "new")}
              className="w-full h-10 px-3 rounded-md border bg-background text-sm mt-1">
              <option value="carryover">과년도 재검토 — 기존에 해오던 위험성평가 이력</option>
              <option value="new">신규 — 올해 새로 발굴한 위험성</option>
            </select>
          </div>

          <div>
            <Label className="text-xs">열 짝짓기</Label>
            <div className="mt-1.5 space-y-1.5">
              {MAP_FIELDS.map((f) => (
                <div key={f.key} className="grid grid-cols-[9rem_1fr] items-center gap-2">
                  <span className="text-sm">
                    {f.label}{f.required && <span className="text-danger"> *</span>}
                  </span>
                  <select
                    value={mapping[f.key] ?? -1}
                    onChange={(e) => setMapping({ ...mapping, [f.key]: Number(e.target.value) })}
                    className="h-9 px-2 rounded-md border bg-background text-sm"
                  >
                    <option value={-1}>— 연결 안 함 —</option>
                    {ms.columns.map((c) => (
                      <option key={c.index} value={c.index}>
                        {c.label}{c.samples[0] ? `  (예: ${c.samples[0]})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t pt-3">
            <span className="text-xs text-muted-foreground">
              인식된 위험요인 <b className="text-foreground">{preview.length}건</b>
              {preview.filter((h) => h.measures.length).length > 0 && <> · 감소대책 {preview.filter((h) => h.measures.length).length}건</>}
            </span>
            <Button onClick={doMappedImport} disabled={saving || preview.length === 0} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {saving ? "가져오는 중..." : `${preview.length}건 가져오기`}
            </Button>
          </div>

          {preview.length > 0 && (
            <div className="overflow-x-auto border-t pt-3">
              <div className="text-xs text-muted-foreground mb-1">미리보기 (상위 {Math.min(preview.length, 15)}건)</div>
              <table className="w-full text-[12px] border-collapse">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-1 pr-2 w-6">No</th>
                    <th className="py-1 pr-2">위험발생상황</th>
                    <th className="py-1 pr-2 w-12 text-center">위험성</th>
                    <th className="py-1 pr-2">감소대책</th>
                    <th className="py-1 pr-2 w-16">담당자</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 15).map((h, i) => (
                    <tr key={i} className="border-b align-top">
                      <td className="py-1 pr-2 text-muted-foreground">{i + 1}</td>
                      <td className="py-1 pr-2">{h.description}</td>
                      <td className="py-1 pr-2 text-center">
                        {h.level ? <span className={`px-1.5 py-0.5 rounded text-[11px] ${riskLevelClass(h.level as RiskLevel)}`}>{h.level}</span> : "-"}
                      </td>
                      <td className="py-1 pr-2 text-muted-foreground">{h.measures[0]?.content ?? "-"}</td>
                      <td className="py-1 pr-2 text-muted-foreground">{h.measures[0]?.responsible ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent></Card>
      )}
    </div>
  );
}
