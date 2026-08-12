import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";

// 앱 공통 결재라인(담당·검토·승인). 직원참여(청취조사)와 동일한 형식으로
// TBM·작업허가서 등에서 재사용한다. 값은 jsonb 한 컬럼(approval)에 저장.
export type Approval = {
  drafter_name: string;
  reviewer_name: string;
  approver_name: string;
  drafter_signed_at: string;
  reviewer_signed_at: string;
  approver_signed_at: string;
};

export const EMPTY_APPROVAL: Approval = {
  drafter_name: "",
  reviewer_name: "",
  approver_name: "",
  drafter_signed_at: "",
  reviewer_signed_at: "",
  approver_signed_at: "",
};

export const APPROVAL_ROLES: { key: keyof Approval; nameKey: keyof Approval; label: string }[] = [
  { key: "drafter_signed_at", nameKey: "drafter_name", label: "담당" },
  { key: "reviewer_signed_at", nameKey: "reviewer_name", label: "검토" },
  { key: "approver_signed_at", nameKey: "approver_name", label: "승인" },
];

export function ApprovalLineEditor({ value, onChange }: { value?: Approval; onChange: (a: Approval) => void }) {
  const v = value ?? { ...EMPTY_APPROVAL };
  function setField<K extends keyof Approval>(k: K, val: string) { onChange({ ...v, [k]: val }); }
  function sign(nameKey: keyof Approval, dateKey: keyof Approval) {
    if (!v[nameKey]) { toast.error("성명을 먼저 입력하세요"); return; }
    setField(dateKey, new Date().toISOString());
  }
  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="text-xs font-semibold">결재라인</div>
      <div className="grid grid-cols-3 gap-2">
        {APPROVAL_ROLES.map(({ key, nameKey, label }) => (
          <div key={label} className="space-y-1">
            <Label className="text-[11px]">{label}</Label>
            <Input className="h-8 text-xs" placeholder="성명" value={(v[nameKey] as string) || ""}
              onChange={(e) => setField(nameKey, e.target.value)} />
            <div className="text-[10px] text-muted-foreground min-h-[14px]">
              {v[key] ? new Date(v[key] as string).toLocaleString("ko-KR") : "미결재"}
            </div>
            <Button type="button" variant={v[key] ? "secondary" : "outline"} size="sm" className="w-full h-7 text-xs"
              onClick={() => v[key] ? setField(key, "") : sign(nameKey, key)}>
              {v[key] ? "결재취소" : "결재"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ApprovalLineView({ approval }: { approval?: Approval }) {
  const a = approval;
  if (!a || (!a.drafter_name && !a.reviewer_name && !a.approver_name)) return null;
  return (
    <div className="mt-2 border rounded-md overflow-hidden text-xs">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>{APPROVAL_ROLES.map((r) => <th key={r.label} className="px-2 py-1 border-r last:border-r-0 font-medium">{r.label}</th>)}</tr>
        </thead>
        <tbody>
          <tr>
            {APPROVAL_ROLES.map(({ key, nameKey, label }) => (
              <td key={label} className="px-2 py-2 border-r last:border-r-0 text-center align-top">
                <div className="font-medium">{(a[nameKey] as string) || "-"}</div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {a[key] ? new Date(a[key] as string).toLocaleDateString("ko-KR") : "미결재"}
                </div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── 안전점검 전용 결재란(인원·직책·이름 편집 가능) ──
// 공용 결재(담당/검토/승인)와 별개. jsonb approval 컬럼에 [{role,name,at}, ...] 배열로 저장.
// 단지마다 결재자 수가 달라 추가/삭제 가능. 구버전 Record 형태도 자동 변환.
export const INSP_DEFAULT_ROLES = ["담당", "과장", "팀장", "소장"];
export type ApprovalRow = { role: string; name: string; at: string };
export type InspApproval = ApprovalRow[];

export function normalizeApproval(v: any): ApprovalRow[] {
  if (Array.isArray(v)) return v.map((r) => ({ role: r?.role ?? "", name: r?.name ?? "", at: r?.at ?? "" }));
  if (v && typeof v === "object" && Object.keys(v).length) {
    return Object.entries(v).map(([role, s]: any) => ({ role, name: s?.name ?? "", at: s?.at ?? "" }));
  }
  return INSP_DEFAULT_ROLES.map((role) => ({ role, name: "", at: "" }));
}

export function InspectionApprovalEditor({ value, onChange, title }: { value?: InspApproval; onChange: (a: InspApproval) => void; title?: string }) {
  const rows = normalizeApproval(value);
  const set = (r: ApprovalRow[]) => onChange(r);
  const patch = (i: number, p: Partial<ApprovalRow>) => set(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const nextIdx = rows.findIndex((r) => !r.at); // 순서상 아직 결재 안 한 첫 칸 = 지금 차례
  const nextRow = nextIdx >= 0 ? rows[nextIdx] : null;
  async function copyRequest() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const who = nextRow?.role || "다음 결재자";
    const msg = `[리스크로그] "${title || "안전점검"}" ${who} 결재를 부탁드립니다.\n${url}`;
    try {
      await navigator.clipboard.writeText(msg);
      toast.success(`${who} 결재 요청 링크를 복사했습니다. 카톡 등에 붙여넣어 전달하세요.`);
    } catch {
      window.prompt("아래 내용을 복사해 전달하세요", msg);
    }
  }
  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs font-semibold">결재란 <span className="text-muted-foreground font-normal">(직책·이름 수정, 결재자 추가·삭제 가능)</span></div>
        <div className="flex items-center gap-2">
          <div className="text-[11px] font-medium">
            {nextRow
              ? <span className="text-primary">▶ 다음 결재: <b>{nextRow.role || "(직책)"}</b></span>
              : <span className="text-success">✓ 결재 완료</span>}
          </div>
          {nextRow && (
            <Button type="button" variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={copyRequest}>
              결재 요청 링크 복사
            </Button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {rows.map((r, i) => {
          const signed = !!r.at;
          const isNext = i === nextIdx;
          return (
            <div key={i} className={`space-y-1 rounded-md p-1.5 border transition-colors ${isNext ? "ring-2 ring-primary bg-primary/5" : signed ? "bg-success/5" : ""}`}>
              <div className="flex items-center gap-1">
                <Input className="h-7 text-[11px] font-semibold px-1.5" placeholder="직책" value={r.role}
                  onChange={(e) => patch(i, { role: e.target.value })} />
                {rows.length > 1 && (
                  <button type="button" onClick={() => set(rows.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-danger shrink-0" title="삭제"><X className="h-3.5 w-3.5" /></button>
                )}
              </div>
              <div className="flex items-center gap-1">
                {isNext && <span className="text-[9px] leading-none px-1 py-0.5 rounded bg-primary text-white shrink-0">지금</span>}
                {signed && <span className="text-success text-[11px] shrink-0">✓</span>}
                <Input className="h-8 text-xs" placeholder="성명" value={r.name} onChange={(e) => patch(i, { name: e.target.value })} />
              </div>
              <div className={`text-[10px] min-h-[14px] ${signed ? "text-success" : "text-muted-foreground"}`}>{signed ? new Date(r.at).toLocaleDateString("ko-KR") + " 결재" : "미결재"}</div>
              <Button type="button" variant={signed ? "secondary" : isNext ? "default" : "outline"} size="sm" className="w-full h-7 text-xs"
                onClick={() => (signed ? patch(i, { at: "" }) : r.name ? patch(i, { at: new Date().toISOString() }) : toast.error("성명을 먼저 입력하세요"))}>
                {signed ? "결재취소" : "결재"}
              </Button>
            </div>
          );
        })}
        <button type="button" onClick={() => set([...rows, { role: "", name: "", at: "" }])}
          className="min-h-[92px] rounded-md border-2 border-dashed flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary text-xs">
          <Plus className="h-4 w-4" />결재자 추가
        </button>
      </div>
    </div>
  );
}

// 인쇄용 결재란(우측 상단). PrintSheet의 headerRight로 넘긴다.
export function InspectionApprovalBox({ approval }: { approval?: InspApproval }) {
  const rows = normalizeApproval(approval).filter((r) => r.role || r.name);
  if (rows.length === 0) return null;
  const width = Math.min(22 + rows.length * 16, 130);
  return (
    <table className="ps-approval" style={{ width: `${width}mm` }}>
      <tbody>
        <tr>
          <th rowSpan={2} style={{ width: "7mm", writingMode: "vertical-rl" as any }}>결재</th>
          {rows.map((r, i) => <th key={i}>{r.role}</th>)}
        </tr>
        <tr>
          {rows.map((r, i) => (
            <td key={i}>
              <div style={{ fontWeight: 700 }}>{r.name || ""}</div>
              <div style={{ fontSize: "7pt", color: "#555", marginTop: "1mm" }}>{r.at ? new Date(r.at).toLocaleDateString("ko-KR") : ""}</div>
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}
