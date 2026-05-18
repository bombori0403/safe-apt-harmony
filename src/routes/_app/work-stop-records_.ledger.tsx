import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Printer } from "lucide-react";

export const Route = createFileRoute("/_app/work-stop-records_/ledger")({
  component: Ledger,
});

function fmt(d?: string | null) {
  if (!d) return "";
  const dt = new Date(d);
  const yy = String(dt.getFullYear()).slice(2);
  return `${yy}/${dt.getMonth() + 1}/${dt.getDate()}`;
}

function Ledger() {
  const [items, setItems] = useState<any[]>([]);
  const [complexes, setComplexes] = useState<any[]>([]);
  const [complexId, setComplexId] = useState<string>("");
  const today = new Date();
  const [from, setFrom] = useState(`${today.getFullYear()}-01-01`);
  const [to, setTo] = useState(today.toISOString().slice(0, 10));

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const authId = auth.user?.id;
      let allowedComplexIds: string[] | null = null;
      if (authId) {
        const { data: me } = await supabase.from("users").select("id,org_role").eq("auth_id", authId).maybeSingle();
        if (me && me.org_role !== "admin") {
          const { data: cm } = await supabase.from("complex_members").select("complex_id").eq("user_id", me.id);
          allowedComplexIds = (cm ?? []).map((r: any) => r.complex_id);
        }
      }

      let cq = supabase.from("complexes").select("id,name");
      if (allowedComplexIds) cq = cq.in("id", allowedComplexIds.length ? allowedComplexIds : ["00000000-0000-0000-0000-000000000000"]);
      const { data: c } = await cq;
      setComplexes(c ?? []);

      let q: any = (supabase as any).from("work_stop_records").select("*").order("exercised_at", { ascending: true });
      if (allowedComplexIds) q = q.in("complex_id", allowedComplexIds.length ? allowedComplexIds : ["00000000-0000-0000-0000-000000000000"]);
      const { data } = await q;
      setItems(data ?? []);
    })();
  }, []);

  const filtered = useMemo(() => {
    const fromTs = new Date(from + "T00:00:00").getTime();
    const toTs = new Date(to + "T23:59:59").getTime();
    return items.filter((it: any) => {
      const t = new Date(it.exercised_at).getTime();
      if (t < fromTs || t > toTs) return false;
      if (complexId && it.complex_id !== complexId) return false;
      return true;
    });
  }, [items, from, to, complexId]);

  const selectedComplex = complexes.find((c: any) => c.id === complexId);
  const deptLabel = selectedComplex ? `${selectedComplex.name} 관리사무소` : "전체 단지";

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto">
      <div className="flex flex-wrap items-end gap-2 mb-4 print:hidden">
        <Link to="/work-stop-records">
          <Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="h-4 w-4" />목록</Button>
        </Link>
        <div className="ml-auto flex flex-wrap items-end gap-2">
          <div>
            <Label className="text-xs">단지</Label>
            <select value={complexId} onChange={(e) => setComplexId(e.target.value)}
              className="h-9 px-2 rounded-md border bg-background text-sm block mt-1">
              <option value="">전체</option>
              {complexes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">시작일</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 mt-1" />
          </div>
          <div>
            <Label className="text-xs">종료일</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 mt-1" />
          </div>
          <Button onClick={() => window.print()} className="gap-1.5"><Printer className="h-4 w-4" />인쇄 / PDF</Button>
        </div>
      </div>

      <div id="print-area" className="bg-white text-black p-6 border rounded-md print:border-0 print:p-0 print:shadow-none">
        <h1 className="text-center text-xl font-bold mb-2">근로자 작업중지 실적 관리대장</h1>
        <div className="text-sm mb-2">○ 부서명 : {deptLabel}</div>
        <div className="text-xs text-right mb-2">기간 : {from} ~ {to} (총 {filtered.length}건)</div>

        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black/70 px-1 py-1.5 w-16">날짜</th>
              <th className="border border-black/70 px-1 py-1.5">사업명</th>
              <th className="border border-black/70 px-1 py-1.5" colSpan={2}>작업중지 요청 현황</th>
              <th className="border border-black/70 px-1 py-1.5">사유</th>
              <th className="border border-black/70 px-1 py-1.5">조치내용</th>
              <th className="border border-black/70 px-1 py-1.5 w-16">재개일</th>
            </tr>
            <tr className="bg-gray-100">
              <th className="border border-black/70 px-1 py-1"></th>
              <th className="border border-black/70 px-1 py-1"></th>
              <th className="border border-black/70 px-1 py-1 w-28">구분<br/>요청자 *</th>
              <th className="border border-black/70 px-1 py-1 w-28">구분<br/>조치자 **</th>
              <th className="border border-black/70 px-1 py-1"></th>
              <th className="border border-black/70 px-1 py-1"></th>
              <th className="border border-black/70 px-1 py-1"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="border border-black/70 px-2 py-6 text-center text-gray-500">해당 기간에 등록된 기록이 없습니다.</td></tr>
            ) : filtered.map((it: any) => (
              <tr key={it.id} className="align-top">
                <td className="border border-black/70 px-1 py-1.5 text-center whitespace-nowrap">{fmt(it.exercised_at)}</td>
                <td className="border border-black/70 px-1 py-1.5 whitespace-pre-wrap">{it.work_description}</td>
                <td className="border border-black/70 px-1 py-1.5">
                  <div className="text-[10px] text-gray-600">{it.exerciser_position || "-"}</div>
                  <div>{it.exerciser_name}</div>
                </td>
                <td className="border border-black/70 px-1 py-1.5">
                  <div className="text-[10px] text-gray-600">관리감독자</div>
                  <div>{it.supervisor_name || "-"}</div>
                </td>
                <td className="border border-black/70 px-1 py-1.5 whitespace-pre-wrap">{it.stop_reason}</td>
                <td className="border border-black/70 px-1 py-1.5 whitespace-pre-wrap">{it.result_detail || (it.result === "작업재개" ? "-" : "(처리 중)")}</td>
                <td className="border border-black/70 px-1 py-1.5 text-center whitespace-nowrap">{it.result === "작업재개" ? fmt(it.updated_at) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="text-[10px] mt-3 leading-relaxed text-gray-700">
          <div>* 요청자는 중지권을 행사한 자.(수급업체 근로자, 수급업체 관리자, 공단 관리자 등)</div>
          <div>** 조치자는 중지권 요청에 대한 검토자, 조치자(수급업체 관리자, 공단 관리자 등)</div>
          <div>※ 사업장 특성에 따라 점검사항 추가 및 변경 가능</div>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
