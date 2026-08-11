import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getSignedUrls } from "@/lib/storage";
import { APPROVAL_ROLES, type Approval } from "@/components/approval-line";

/**
 * 공용 A4 인쇄 시트. 직원참여(청취조사)의 단일 시트 인쇄 방식을 재사용한다.
 * - 평소엔 화면에서 숨김(.print-sheet { display:none }).
 * - printSheet() 호출 시 body에 printing-single-active 클래스를 붙여 다른 요소를
 *   전부 감추고 이 시트만 인쇄한다.
 * - 사진은 비공개 버킷이라 인쇄 전에 서명 URL을 미리 발급·프리로드해야 뜬다.
 *
 * 사용: 상세 페이지에 <PrintSheet title=... approval=...> {본문 테이블} </PrintSheet> 를
 * 항상 렌더해 두고(숨겨져 있음), 출력 버튼에서 printSheet(사진URL배열)를 호출.
 */

const PRINT_CSS = `
.print-sheet { display: none; }
@media print {
  @page { size: A4 portrait; margin: 10mm; }
  /* 시트는 body 직속으로 포탈됨 → body 직계 자식 중 시트만 빼고 숨기면 빈 페이지 없이 이것만 인쇄된다. */
  body.printing-single-active > *:not(.print-sheet) { display: none !important; }
  body.printing-single-active .print-sheet {
    display: block !important;
    width: 100%;
    font-family: 'Malgun Gothic', system-ui, sans-serif; color: #000; font-size: 10pt;
  }
  .print-sheet * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .ps-table { page-break-inside: auto; }
  .ps-table tr { page-break-inside: avoid; }
  /* 한 장을 꽉 채우는 표: 남은 높이만큼 행이 늘어난다(항목 적은 점검표도 페이지를 채움). */
  .print-sheet .ps-fill { height: 200mm; }
}
.print-sheet .ps-title { text-align: center; font-size: 17pt; font-weight: 800; margin: 0; }
.print-sheet .ps-sub { text-align: center; font-size: 8.5pt; color: #333; margin: 1mm 0 0; }
.print-sheet .ps-headwrap { display: flex; align-items: flex-start; justify-content: space-between; gap: 4mm; margin-bottom: 3mm; }
.print-sheet .ps-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 2mm; }
.print-sheet .ps-table th, .print-sheet .ps-table td { border: 1px solid #111; padding: 1.5mm 2mm; vertical-align: top; box-sizing: border-box; word-break: break-word; }
.print-sheet .ps-label { background: #f1f1f1; text-align: center; font-weight: 700; white-space: nowrap; }
.print-sheet .ps-approval { border-collapse: collapse; table-layout: fixed; width: 62mm; }
.print-sheet .ps-approval th, .print-sheet .ps-approval td { border: 1px solid #111; padding: 1mm; text-align: center; font-size: 8pt; }
.print-sheet .ps-approval td { height: 15mm; vertical-align: top; }
.print-sheet .ps-photo-row { display: flex; flex-wrap: wrap; gap: 2mm; }
.print-sheet .ps-photo-box { width: 42mm; height: 32mm; border: 1px solid #555; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.print-sheet .ps-photo-box img { width: 100%; height: 100%; object-fit: cover; }
.print-sheet .ps-footer { text-align: right; font-size: 7.5pt; color: #555; margin-top: 2mm; }
.print-sheet .ps-center { text-align: center; }
/* 점검표 항목 표: 항목이 많아도(최대 30여개) A4 1장에 들어가도록 조밀하게 */
.print-sheet .ps-compact th, .print-sheet .ps-compact td { padding: 0.6mm 1.4mm; font-size: 8.3pt; line-height: 1.2; }
`;

function preload(url: string) {
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

// 사진 서명 URL을 미리 데워두고 단일 시트 인쇄 실행.
export async function printSheet(photoUrls: string[] = []) {
  try {
    const signed = (await getSignedUrls(photoUrls)).filter(Boolean);
    await Promise.all(signed.map(preload));
  } catch { /* 사진 없이도 인쇄 진행 */ }
  document.body.classList.add("printing-single-active");
  await new Promise((r) => setTimeout(r, 200));
  window.print();
  document.body.classList.remove("printing-single-active");
}

export function PrintSheet({
  title, subtitle, approval, children,
}: {
  title: string;
  subtitle?: string;
  approval?: Approval;
  children: React.ReactNode;
}) {
  // body 직속으로 포탈해야 인쇄 시 앱(#root)을 통째로 숨겨도 시트는 남는다(빈 페이지 방지).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div className="print-sheet">
      <style>{PRINT_CSS}</style>
      <div className="ps-headwrap">
        <div style={{ flex: 1 }}>
          <h1 className="ps-title">{title}</h1>
          {subtitle && <p className="ps-sub">{subtitle}</p>}
        </div>
        {approval && (
          <table className="ps-approval">
            <tbody>
              <tr>
                <th rowSpan={2} style={{ width: "8mm", writingMode: "vertical-rl" as any }}>결재</th>
                {APPROVAL_ROLES.map((r) => <th key={r.label}>{r.label}</th>)}
              </tr>
              <tr>
                {APPROVAL_ROLES.map(({ key, nameKey, label }) => (
                  <td key={label}>
                    <div style={{ fontWeight: 700 }}>{(approval[nameKey] as string) || ""}</div>
                    <div style={{ fontSize: "7pt", color: "#555", marginTop: "1mm" }}>
                      {approval[key] ? new Date(approval[key] as string).toLocaleDateString("ko-KR") : ""}
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        )}
      </div>
      {children}
      <div className="ps-footer">출력일: {new Date().toLocaleString("ko-KR")}</div>
    </div>,
    document.body,
  );
}
