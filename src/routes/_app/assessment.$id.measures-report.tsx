import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { riskLevelClass, type RiskLevel } from "@/lib/types";

export const Route = createFileRoute("/_app/assessment/$id/measures-report")({
  component: MeasuresReport,
});

const TYPE_ORDER = ["본질적_대책", "공학적_대책", "관리적_대책", "개인보호구"];

function displayType(t: string | null) {
  return t?.replace("_대책", "") ?? "-";
}

function MeasuresReport() {
  const { id } = Route.useParams();
  const [a, setA] = useState<any>(null);
  const [complex, setComplex] = useState<any>(null);
  const [hazards, setHazards] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: ass } = await supabase.from("assessments").select("*").eq("id", id).maybeSingle();
      setA(ass);
      if (ass?.complex_id) {
        const { data: c } = await supabase.from("complexes").select("*").eq("id", ass.complex_id).maybeSingle();
        setComplex(c);
      }
      const { data: h } = await supabase.from("hazards").select("*, measures(*)").eq("assessment_id", id).order("created_at", { ascending: true });
      setHazards(h ?? []);
    })();
  }, [id]);

  const allMeasures = useMemo(() => {
    const rows: any[] = [];
    hazards.forEach(h => (h.measures ?? []).forEach((m: any) => rows.push({ ...m, hazard: h })));
    rows.sort((x, y) => {
      const a = TYPE_ORDER.indexOf(x.type ?? "");
      const b = TYPE_ORDER.indexOf(y.type ?? "");
      return (a < 0 ? 99 : a) - (b < 0 ? 99 : b);
    });
    return rows;
  }, [hazards]);

  const byType = useMemo(() => {
    const m = new Map<string, any[]>();
    allMeasures.forEach(r => {
      const k = r.type ?? "기타";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    });
    return m;
  }, [allMeasures]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { 대기: 0, 진행중: 0, 완료: 0 };
    allMeasures.forEach(m => { c[m.status ?? "대기"] = (c[m.status ?? "대기"] ?? 0) + 1; });
    return c;
  }, [allMeasures]);

  if (!a) return <div className="p-8 text-muted-foreground">불러오는 중...</div>;

  return (
    <div className="bg-white text-foreground">
      <div className="print:hidden p-4 max-w-4xl mx-auto flex justify-between items-center border-b">
        <Link to="/assessment/$id/measures" params={{ id }}>
          <Button variant="outline" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />돌아가기</Button>
        </Link>
        <Button onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" />PDF 저장 / 인쇄</Button>
      </div>

      <div className="max-w-4xl mx-auto p-8 print:p-0 print:max-w-none">
        <header className="text-center border-b-2 border-foreground pb-4 mb-6">
          <div className="text-sm text-muted-foreground">위험성 감소대책 종합 출력</div>
          <h1 className="text-2xl font-bold mt-1">{a.work_name}</h1>
          <div className="text-xs mt-2 text-muted-foreground">
            {complex?.name ?? "-"} · 평가일 {a.assessment_date} · 허용수준 {a.allowable_level}
          </div>
        </header>

        <section className="grid grid-cols-4 gap-3 text-sm mb-6">
          <SummaryBox label="총 대책 수" value={String(allMeasures.length)} />
          <SummaryBox label="대기" value={String(statusCounts["대기"] ?? 0)} />
          <SummaryBox label="진행중" value={String(statusCounts["진행중"] ?? 0)} />
          <SummaryBox label="완료" value={String(statusCounts["완료"] ?? 0)} />
        </section>

        {allMeasures.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">등록된 감소대책이 없습니다.</p>
        ) : (
          <>
            <section className="mb-8">
              <h2 className="font-bold border-b pb-1 mb-3">1. 전체 감소대책 일람표</h2>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-foreground">
                    <th className="py-2 text-left w-10">No</th>
                    <th className="py-2 text-left w-20">유형</th>
                    <th className="py-2 text-left">유해·위험요인</th>
                    <th className="py-2 text-center w-16">위험성</th>
                    <th className="py-2 text-left">대책 내용</th>
                    <th className="py-2 text-left w-20">책임자</th>
                    <th className="py-2 text-center w-24">이행예정</th>
                    <th className="py-2 text-center w-16">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {allMeasures.map((m, i) => (
                    <tr key={m.id} className="border-b align-top">
                      <td className="py-2">{i + 1}</td>
                      <td className="py-2">{displayType(m.type)}</td>
                      <td className="py-2">{m.hazard.description}</td>
                      <td className="py-2 text-center">
                        {m.hazard.level && <span className={`px-1.5 py-0.5 rounded text-[10px] ${riskLevelClass(m.hazard.level as RiskLevel)}`}>{m.hazard.level}</span>}
                      </td>
                      <td className="py-2">{m.content}</td>
                      <td className="py-2">{m.responsible_name ?? "-"}</td>
                      <td className="py-2 text-center text-xs">{m.due_date ?? "-"}</td>
                      <td className="py-2 text-center text-xs">{m.status ?? "대기"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section>
              <h2 className="font-bold border-b pb-1 mb-3">2. 유형별 분류</h2>
              <p className="text-xs text-muted-foreground mb-3">감소대책은 본질적 → 공학적 → 관리적 → 개인보호구 순으로 우선 적용해야 합니다.</p>
              {TYPE_ORDER.filter(t => byType.has(t)).map(t => (
                <div key={t} className="mb-4 break-inside-avoid">
                  <h3 className="font-semibold text-sm bg-muted px-2 py-1 mb-2">
                    {displayType(t)} 대책 ({byType.get(t)!.length}건)
                  </h3>
                  <ul className="text-sm space-y-1 pl-4 list-disc">
                    {byType.get(t)!.map(m => (
                      <li key={m.id}>
                        <span className="font-medium">{m.content}</span>
                        <span className="text-muted-foreground"> — {m.hazard.description}</span>
                        {m.responsible_name && <span className="text-xs text-muted-foreground"> · 책임자 {m.responsible_name}</span>}
                        {m.due_date && <span className="text-xs text-muted-foreground"> · {m.due_date}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          </>
        )}

        <footer className="mt-10 pt-4 border-t text-[10px] text-muted-foreground text-center">
          출력일시: {new Date().toLocaleString("ko-KR")}
        </footer>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 15mm; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded p-3 text-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </div>
  );
}
