import { BUSINESS } from "@/lib/business-info";

/**
 * 전자상거래법 사업자정보 푸터. 사업자등록번호가 채워지기 전에는 렌더하지 않아
 * 미완성 상태로 노출되지 않는다. 값은 business-info.ts 한 곳에서 관리.
 */
export function BusinessFooter({ className = "" }: { className?: string }) {
  if (!BUSINESS.bizNo) return null;
  const parts = [
    `상호: ${BUSINESS.company}`,
    `대표: ${BUSINESS.ceo}`,
    `사업자등록번호: ${BUSINESS.bizNo}`,
    BUSINESS.mailOrderNo && `통신판매업신고: ${BUSINESS.mailOrderNo}`,
    BUSINESS.address && `주소: ${BUSINESS.address}`,
    BUSINESS.contact && `문의: ${BUSINESS.contact}`,
  ].filter(Boolean);
  return (
    <div className={`text-[11px] leading-relaxed text-muted-foreground ${className}`}>
      {parts.join(" | ")}
    </div>
  );
}
