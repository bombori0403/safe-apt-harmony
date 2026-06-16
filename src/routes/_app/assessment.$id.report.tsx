import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { riskLevelClass, type RiskLevel } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { WORK_STOP_LAW_TITLE, WORK_STOP_LAW_TEXT, WORK_STOP_PROCEDURE } from "@/lib/work-stop-law";

export const Route = createFileRoute("/_app/assessment/$id/report")({
  component: Report,
});

function Report() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [a, setA] = useState<any>(null);
  const [complex, setComplex] = useState<any>(null);
  const [hazards, setHazards] = useState<any[]>([]);
  const [parts, setParts] = useState<any[]>([]);
  const [sigs, setSigs] = useState<any[]>([]);
  const [inputs, setInputs] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("users").select("org_role").eq("auth_id", user.id).maybeSingle()
      .then(({ data }) => setRole(data?.org_role ?? null));
  }, [user]);

  useEffect(() => {
    (async () => {
      const { data: ass } = await supabase.from("assessments").select("*").eq("id", id).maybeSingle();
      setA(ass);
      if (ass?.complex_id) {
        const { data: c } = await supabase.from("complexes").select("*").eq("id", ass.complex_id).maybeSingle();
        setComplex(c);
      }
      const { data: h } = await supabase.from("hazards").select("*, measures(*)").eq("assessment_id", id);
      setHazards(h ?? []);
      const { data: p } = await supabase.from("participants").select("*").eq("assessment_id", id);
      setParts(p ?? []);
      const { data: s } = await supabase.from("signatures").select("*").eq("assessment_id", id);
      setSigs(s ?? []);
      const { data: ei } = await supabase.from("employee_inputs").select("*").eq("assessment_id", id).order("occurred_at", { ascending: false });
      setInputs(ei ?? []);
    })();
  }, [id]);

  if (role && role !== "admin" && role !== "manager") {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-3">
        <h1 className="text-xl font-bold">접근 권한이 없습니다</h1>
        <p className="text-sm text-muted-foreground">결과서는 매니저 이상만 사용할 수 있습니다.</p>
        <Link to="/assessment/$id" params={{ id }}><Button variant="outline" size="sm">돌아가기</Button></Link>
      </div>
    );
  }
  if (!a) return <div className="p-8 text-muted-foreground">불러오는 중...</div>;

  return (
    <div className="bg-white text-foreground">
      <div className="print:hidden p-4 max-w-4xl mx-auto flex justify-between items-center border-b">
        <Link to="/assessment/$id" params={{ id }}><Button variant="outline" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />돌아가기</Button></Link>
        <Button onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" />PDF 저장 / 인쇄</Button>
      </div>

      <div className="max-w-4xl mx-auto p-8 print:p-0 print:max-w-none">
        <header className="text-center border-b-2 border-foreground pb-4 mb-6">
          <div className="text-sm text-muted-foreground">공동주택 위험성평가 결과서</div>
          <h1 className="text-2xl font-bold mt-1">{a.work_name}</h1>
          <div className="text-sm mt-2">산업안전보건법 제36조 · 고용노동부 고시 제2024-76호</div>
        </header>

        <section className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-6">
          <Row label="단지명" value={complex?.name} />
          <Row label="주소" value={complex?.address} />
          <Row label="평가일자" value={a.assessment_date} />
          <Row label="평가종류" value={a.assessment_type} />
          <Row label="평가방법" value={a.method} />
          <Row label="평가장소" value={a.location ?? "-"} />
          <Row label="허용 위험성수준" value={a.allowable_level} />
          <Row label="작업 카테고리" value={a.work_category ?? "-"} />
        </section>

        <section className="mb-6">
          <h2 className="font-bold border-b pb-1 mb-3">1. 유해·위험요인 및 위험성 결정</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-foreground">
                <th className="py-2 text-left w-10">번호</th>
                <th className="py-2 text-left">유해·위험요인</th>
                <th className="py-2 text-center w-24">위험성수준</th>
                <th className="py-2 text-center w-24">표준환산</th>
              </tr>
            </thead>
            <tbody>
              {hazards.map((h, i) => (
                <tr key={h.id} className="border-b">
                  <td className="py-2">{i+1}</td>
                  <td className="py-2">{h.description}</td>
                  <td className="py-2 text-center">{h.level ?? "-"}</td>
                  <td className="py-2 text-center">
                    {h.level_standardized && <span className={`px-2 py-0.5 rounded text-xs ${riskLevelClass(h.level_standardized as RiskLevel)}`}>{h.level_standardized}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mb-6">
          <h2 className="font-bold border-b pb-1 mb-3">2. 위험성 감소대책</h2>
          {hazards.filter(h => h.measures?.length > 0).length === 0 ? (
            <p className="text-sm text-muted-foreground">감소대책이 등록되지 않았습니다.</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-foreground">
                  <th className="py-2 text-left">유해·위험요인</th>
                  <th className="py-2 text-left w-20">유형</th>
                  <th className="py-2 text-left">대책 내용</th>
                  <th className="py-2 text-left w-24">책임자</th>
                  <th className="py-2 text-left w-24">이행예정</th>
                </tr>
              </thead>
              <tbody>
                {hazards.flatMap(h => (h.measures ?? []).map((m: any) => (
                  <tr key={m.id} className="border-b">
                    <td className="py-2">{h.description}</td>
                    <td className="py-2">{m.type?.replace("_대책", "") ?? "-"}</td>
                    <td className="py-2">{m.content}</td>
                    <td className="py-2">{m.responsible_name ?? "-"}</td>
                    <td className="py-2">{m.due_date ?? "-"}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          )}
        </section>

        <section className="mb-6">
          <h2 className="font-bold border-b pb-1 mb-3">3. 직원 참여 의견 (청취조사 · 오픈채팅 이력)</h2>
          {inputs.length === 0 ? (
            <p className="text-sm text-muted-foreground">등록된 직원 의견이 없습니다.</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-foreground">
                  <th className="py-2 text-left w-20">구분</th>
                  <th className="py-2 text-left w-28">일시</th>
                  <th className="py-2 text-left w-28">응답자/채팅방</th>
                  <th className="py-2 text-left">내용</th>
                </tr>
              </thead>
              <tbody>
                {inputs.map(it => (
                  <tr key={it.id} className="border-b align-top">
                    <td className="py-2">{it.input_type === "hearing" ? "청취조사" : "오픈채팅"}</td>
                    <td className="py-2 text-xs">{new Date(it.occurred_at).toLocaleString("ko-KR")}</td>
                    <td className="py-2">{[it.respondent_name, it.respondent_role].filter(Boolean).join(" / ") || "-"}</td>
                    <td className="py-2 whitespace-pre-wrap">{it.content}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <h2 className="font-bold border-b pb-1 mb-3">4. 참여자 확인</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-foreground">
                <th className="py-2 text-left">성명</th>
                <th className="py-2 text-left">직책</th>
                <th className="py-2 text-left">참여구분</th>
                <th className="py-2 text-left w-32">서명</th>
                <th className="py-2 text-left w-32">확인일시</th>
              </tr>
            </thead>
            <tbody>
              {parts.map(p => {
                const sig = sigs.find(s => s.participant_id === p.id);
                return (
                  <tr key={p.id} className="border-b">
                    <td className="py-2">{p.name}</td>
                    <td className="py-2">{p.role ?? "-"}</td>
                    <td className="py-2">{p.participation_role}</td>
                    <td className="py-2">
                      {sig?.signature_image?.startsWith("data:image") ? (
                        <img src={sig.signature_image} alt="서명" className="h-10 w-24 object-contain" />
                      ) : sig ? "확인됨" : "—"}
                    </td>
                    <td className="py-2 text-xs">{sig ? new Date(sig.signed_at).toLocaleString("ko-KR") : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="mt-8 break-before-page">
          <h2 className="font-bold border-b pb-1 mb-3">[부록] {WORK_STOP_LAW_TITLE}</h2>
          <pre className="whitespace-pre-wrap text-xs leading-relaxed font-sans">{WORK_STOP_LAW_TEXT}</pre>
          <h3 className="font-semibold mt-4 mb-2 text-sm">행사 절차</h3>
          <ol className="text-xs space-y-1">
            {WORK_STOP_PROCEDURE.map((p,i)=>(<li key={i}>{p}</li>))}
          </ol>
          <p className="text-[10px] text-muted-foreground mt-3">본 안내문은 산업안전보건법 제52조에 따라 위험성평가 결과서에 첨부되었습니다.</p>
        </section>

        <footer className="mt-10 pt-4 border-t text-[10px] text-muted-foreground text-center">
          본 결과서는 산업안전보건법 시행규칙에 따라 3년간 보존됩니다.
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

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex border-b pb-1">
      <span className="w-28 text-muted-foreground">{label}</span>
      <span className="flex-1 font-medium">{value ?? "-"}</span>
    </div>
  );
}
