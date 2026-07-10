import { riskLevelClass, scoreToRiskLevel } from "@/lib/types";
import { suggestLegalBasis } from "@/lib/legal-basis-keywords";

// Pull the "제N조" article number out of a full legal-basis string, so
// manually-entered hazards (which only store the full text) still show
// an article number in the KRAS table.
function extractArticleNo(text?: string | null): string | null {
  if (!text) return null;
  const m = text.match(/제\s*\d+조/);
  return m ? m[0] : null;
}

// Shared KRAS-format table for one assessment. Used by both the single-report
// page and the whole-history batch export.
export function KrasReportTable({ workName, hazards }: { workName: string; hazards: any[] }) {
  return (
    <table className="w-full text-[11px] border-collapse kras-table">
      <thead>
        <tr className="border-b-2 border-foreground">
          <th rowSpan={2} className="border p-1 w-8">No.</th>
          <th rowSpan={2} className="border p-1 w-20">공정명</th>
          <th rowSpan={2} className="border p-1">위험발생상황 및 결과<br />(유해위험요인 파악)</th>
          <th colSpan={3} className="border p-1">현재위험성</th>
          <th rowSpan={2} className="border p-1">위험성 감소대책</th>
          <th colSpan={3} className="border p-1">감소대책 실행</th>
          <th colSpan={3} className="border p-1">개선 후 위험성</th>
          <th colSpan={2} className="border p-1">관련근거 법적기준</th>
        </tr>
        <tr className="border-b-2 border-foreground">
          <th className="border p-1 w-8">가능성<br />(빈도)</th>
          <th className="border p-1 w-8">중대성<br />(강도)</th>
          <th className="border p-1 w-10">위험성</th>
          <th className="border p-1 w-16">개선예정일</th>
          <th className="border p-1 w-16">개선완료일</th>
          <th className="border p-1 w-14">담당자</th>
          <th className="border p-1 w-8">가능성<br />(빈도)</th>
          <th className="border p-1 w-8">중대성<br />(강도)</th>
          <th className="border p-1 w-10">위험성</th>
          <th className="border p-1 w-10">조문번호</th>
          <th className="border p-1">법적기준</th>
        </tr>
      </thead>
      <tbody>
        {hazards.length === 0 && (
          <tr><td colSpan={15} className="border p-3 text-center text-muted-foreground">등록된 유해·위험요인이 없습니다.</td></tr>
        )}
        {hazards.map((h, i) => {
          const score = h.likelihood && h.severity ? h.likelihood * h.severity : null;
          const postScore = h.post_likelihood && h.post_severity ? h.post_likelihood * h.post_severity : null;
          const postLevel = postScore ? scoreToRiskLevel(postScore) : null;
          const measures = h.measures ?? [];
          const suggested = suggestLegalBasis(h.description);
          const legalBasis = h.legal_basis_override || h.hazard_library?.legal_basis || suggested?.legal_basis || "-";
          const articleNo = h.hazard_library?.article_no || extractArticleNo(h.legal_basis_override) || suggested?.article_no || "-";
          return (
            <tr key={h.id} className="align-top">
              <td className="border p-1 text-center">{i + 1}</td>
              <td className="border p-1">{h.work_name ?? workName}</td>
              <td className="border p-1">{h.description}</td>
              <td className="border p-1 text-center">{h.likelihood ?? "-"}</td>
              <td className="border p-1 text-center">{h.severity ?? "-"}</td>
              <td className="border p-1 text-center">
                {h.level ? <span className={`px-1 py-0.5 rounded ${riskLevelClass(h.level)}`}>{score ?? h.level}</span> : "-"}
              </td>
              <td className="border p-1">
                {measures.length === 0 ? "-" : measures.map((m: any, mi: number) => (
                  <div key={m.id} className={mi > 0 ? "border-t mt-1 pt-1" : ""}>{m.content}</div>
                ))}
              </td>
              <td className="border p-1">
                {measures.length === 0 ? "-" : measures.map((m: any, mi: number) => (
                  <div key={m.id} className={mi > 0 ? "border-t mt-1 pt-1" : ""}>{m.due_date ?? "-"}</div>
                ))}
              </td>
              <td className="border p-1">
                {measures.length === 0 ? "-" : measures.map((m: any, mi: number) => (
                  <div key={m.id} className={mi > 0 ? "border-t mt-1 pt-1" : ""}>{m.completed_at ? new Date(m.completed_at).toLocaleDateString("ko-KR") : "-"}</div>
                ))}
              </td>
              <td className="border p-1">
                {measures.length === 0 ? "-" : measures.map((m: any, mi: number) => (
                  <div key={m.id} className={mi > 0 ? "border-t mt-1 pt-1" : ""}>{m.responsible_name ?? "-"}</div>
                ))}
              </td>
              <td className="border p-1 text-center">{h.post_likelihood ?? "-"}</td>
              <td className="border p-1 text-center">{h.post_severity ?? "-"}</td>
              <td className="border p-1 text-center">
                {postLevel ? <span className={`px-1 py-0.5 rounded ${riskLevelClass(postLevel)}`}>{postScore}</span> : "-"}
              </td>
              <td className="border p-1 text-center">{articleNo}</td>
              <td className="border p-1">{legalBasis}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export const KRAS_PRINT_STYLE = `
  @media print {
    @page { size: A4 landscape; margin: 10mm; }
    body { background: white; }
    .kras-table, .kras-table tr, .kras-table td, .kras-table th {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .kras-section { break-before: page; page-break-before: page; }
    .kras-section:first-of-type { break-before: auto; page-break-before: auto; }
  }
`;
