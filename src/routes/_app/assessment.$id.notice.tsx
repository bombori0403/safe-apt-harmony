import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { METHOD_GLOSS } from "@/lib/glossary";
import { Printer, ArrowLeft } from "lucide-react";

/**
 * 게시용 공지 1장 (A4) — 실시 전 "일정·참여방법 안내" / 실시 후 "결과 공지".
 * 법 제36조 제4항: 위험성평가 관련 사항을 안전보건교육, 설명회, 사업장 게시, 서면 또는 전자적 방법 등으로 알려야 한다.
 * 협의·공유 단계가 "마지막 서명"에만 머물지 않도록 둔다 (법령 검토 반영).
 */
export const Route = createFileRoute("/_app/assessment/$id/notice")({
  validateSearch: (s: Record<string, unknown>): { kind: "before" | "after" } => ({ kind: s.kind === "after" ? "after" : "before" }),
  component: Notice,
});

const STATUS_LABEL: Record<string, string> = { 대기: "실행 전", 진행중: "실행 중", 완료: "실행 완료" };

function Notice() {
  const { id } = Route.useParams();
  const { kind } = Route.useSearch();
  const [a, setA] = useState<any>(null);
  const [cx, setCx] = useState<any>(null);
  const [hazards, setHazards] = useState<any[]>([]);
  const [qr, setQr] = useState("");
  const viewUrl = typeof window !== "undefined" ? `${window.location.origin}/view/${id}` : "";

  useEffect(() => {
    (async () => {
      const { data: ass } = await supabase.from("assessments").select("*").eq("id", id).maybeSingle();
      setA(ass);
      if (ass?.complex_id) {
        const { data: c } = await supabase.from("complexes").select("name, manager_phone").eq("id", ass.complex_id).maybeSingle();
        setCx(c);
      }
      const { data: h } = await supabase.from("hazards").select("id, description, level, post_level, measures(content, status, due_date)").eq("assessment_id", id).order("created_at");
      setHazards(h ?? []);
    })();
  }, [id]);
  useEffect(() => { if (viewUrl) QRCode.toDataURL(viewUrl, { width: 200, margin: 1 }).then(setQr).catch(() => {}); }, [viewUrl]);

  if (!a) return <div className="p-8 text-muted-foreground">불러오는 중...</div>;
  const method = METHOD_GLOSS[a.method as keyof typeof METHOD_GLOSS];
  const title = kind === "before" ? "위험성평가 실시 안내" : "위험성평가 결과 공지";
  const today = new Date().toLocaleDateString("ko-KR");

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-4">
      <style>{`@media print { @page { size: A4 portrait; margin: 15mm; } .no-print { display: none !important; } body { background: white !important; } }`}</style>
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link to="/assessment/$id/share" params={{ id }}><Button variant="outline" className="gap-1"><ArrowLeft className="h-5 w-5" />협의·공유로</Button></Link>
        <div className="flex gap-2">
          <Link to="/assessment/$id/notice" params={{ id }} search={{ kind: "before" }}><Button variant={kind === "before" ? "default" : "outline"}>실시 전 안내</Button></Link>
          <Link to="/assessment/$id/notice" params={{ id }} search={{ kind: "after" }}><Button variant={kind === "after" ? "default" : "outline"}>실시 후 결과</Button></Link>
          <Button className="gap-1" onClick={() => window.print()}><Printer className="h-5 w-5" />인쇄</Button>
        </div>
      </div>

      <article className="bg-white text-black rounded-lg border p-8 space-y-5 text-[15px] leading-relaxed print:border-0 print:p-0">
        <header className="text-center space-y-1">
          <div className="text-sm text-gray-600">{cx?.name ?? ""} 관리사무소</div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <div className="text-sm text-gray-600">게시일 {today}</div>
        </header>

        <table className="w-full border-collapse text-[15px]">
          <tbody>
            <Row k="평가 대상 작업" v={a.work_name} />
            <Row k="평가 종류" v={a.assessment_type} />
            <Row k={kind === "before" ? "실시 예정일" : "평가일"} v={a.assessment_date} />
            {a.location && <Row k="장소" v={a.location} />}
            <Row k="평가 방법" v={method ? `${method.title} — ${method.short}` : a.method} />
            <Row k="허용 가능한 위험성 수준" v={a.allowable_level ?? "-"} />
          </tbody>
        </table>

        {kind === "before" ? (
          <section className="space-y-3">
            <h2 className="font-bold text-lg">근로자 여러분의 참여를 부탁드립니다</h2>
            <p>위 작업에 대해 위험성평가를 실시합니다. 산업안전보건법 제36조 제2항에 따라 해당 작업을 하는 근로자가 평가에 참여해야 하며, 다음 방법으로 참여하실 수 있습니다.</p>
            <ol className="list-decimal pl-6 space-y-1">
              <li><b>사업장 순회점검</b>: 담당자와 함께 현장을 돌며 위험한 곳을 짚어 주세요.</li>
              <li><b>면담·설문</b>: 평소 위험하다고 느낀 점을 담당자에게 말씀해 주세요.</li>
              <li><b>앱으로 의견 보내기</b>: 리스크로그 앱 "안전 의견 남기기"에 글이나 사진으로 보내 주세요.</li>
            </ol>
            <p>평가가 끝나면 결과(위험요인, 위험성 수준, 개선대책과 이행 결과)를 다시 알려드리고, 참여하신 분께 확인 서명을 받습니다.</p>
            <p className="text-sm text-gray-600">근거: 산업안전보건법 제36조, 같은 법 시행규칙 제37조의2(근로자 참여) · 문의: {cx?.manager_phone || "관리사무소"}</p>
          </section>
        ) : (
          <section className="space-y-3">
            <h2 className="font-bold text-lg">평가 결과</h2>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-2 py-1.5 text-left">위험요인</th>
                  <th className="border px-2 py-1.5 w-20">위험성</th>
                  <th className="border px-2 py-1.5 text-left">개선대책</th>
                  <th className="border px-2 py-1.5 w-24">이행</th>
                  <th className="border px-2 py-1.5 w-20">개선 후</th>
                </tr>
              </thead>
              <tbody>
                {hazards.map((h) => (
                  <tr key={h.id}>
                    <td className="border px-2 py-1.5 align-top">{h.description}</td>
                    <td className="border px-2 py-1.5 align-top text-center">{h.level ?? "-"}</td>
                    <td className="border px-2 py-1.5 align-top">{(h.measures ?? []).map((m: any) => m.content).join(" / ") || "-"}</td>
                    <td className="border px-2 py-1.5 align-top text-center">{(h.measures ?? []).length ? (h.measures.every((m: any) => m.status === "완료") ? "실행 완료" : `실행 전·중 ${h.measures.filter((m: any) => m.status !== "완료").length}건`) : "-"}</td>
                    <td className="border px-2 py-1.5 align-top text-center">{h.post_level ?? "-"}</td>
                  </tr>
                ))}
                {hazards.length === 0 && <tr><td className="border px-2 py-3 text-center text-gray-500" colSpan={5}>등록된 위험요인이 없습니다</td></tr>}
              </tbody>
            </table>
            <p>위험성이 허용 수준을 넘는 항목은 개선대책을 수립해 실행 중이며, 실행 결과는 관리사무소에서 확인할 수 있습니다. 궁금한 점이나 추가로 위험하다고 느끼는 곳이 있으면 언제든 알려 주세요.</p>
            <div className="flex items-center gap-4 pt-2">
              {qr && <img src={qr} alt="진행 현황 열람 QR" className="w-28 h-28" />}
              <div className="text-sm text-gray-700">
                <div className="font-semibold">휴대폰으로 전체 내용 보기</div>
                <div className="break-all">{viewUrl}</div>
                <div className="text-gray-500 mt-1">QR을 찍으면 위험요인·대책 전체와 진행 상황을 볼 수 있습니다.</div>
              </div>
            </div>
            <p className="text-sm text-gray-600">근거: 산업안전보건법 제36조 제4항(결과 공유) · 같은 법 시행규칙 제37조의3 · 문의: {cx?.manager_phone || "관리사무소"}</p>
          </section>
        )}

        <footer className="pt-4 border-t text-sm text-gray-600 flex justify-between">
          <span>{cx?.name ?? ""} 관리사무소</span>
          <span>리스크로그로 작성</span>
        </footer>
      </article>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr>
      <th className="border bg-gray-50 px-3 py-2 text-left w-44 font-semibold">{k}</th>
      <td className="border px-3 py-2">{v}</td>
    </tr>
  );
}
