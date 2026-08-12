import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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

// ── 안전점검 전용 결재란(담당/과장/팀장/소장 4단계) ──
// 공용 결재(담당/검토/승인)와 별개. jsonb approval 컬럼에 { 역할: {name, at} } 로 저장.
export const INSP_APPROVAL_ROLES = ["담당", "과장", "팀장", "소장"] as const;
export type InspApproval = Record<string, { name: string; at: string }>;

export function InspectionApprovalEditor({ value, onChange }: { value?: InspApproval; onChange: (a: InspApproval) => void }) {
  const v = value ?? {};
  const setRole = (role: string, patch: Partial<{ name: string; at: string }>) =>
    onChange({ ...v, [role]: { name: v[role]?.name ?? "", at: v[role]?.at ?? "", ...patch } });
  // 순서(담당→과장→팀장→소장)상 아직 결재 안 한 첫 역할 = 지금 차례
  const nextRole = INSP_APPROVAL_ROLES.find((r) => !v[r]?.at) ?? null;
  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold">결재란 <span className="text-muted-foreground font-normal">(담당 → 과장 → 팀장 → 소장)</span></div>
        <div className="text-[11px] font-medium">
          {nextRole
            ? <span className="text-primary">▶ 다음 결재: <b>{nextRole}</b></span>
            : <span className="text-success">✓ 결재 완료</span>}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {INSP_APPROVAL_ROLES.map((role) => {
          const slot = v[role] ?? { name: "", at: "" };
          const signed = !!slot.at;
          const isNext = role === nextRole;
          return (
            <div key={role} className={`space-y-1 rounded-md p-1.5 transition-colors ${isNext ? "ring-2 ring-primary bg-primary/5" : signed ? "bg-success/5" : ""}`}>
              <Label className="text-[11px] flex items-center gap-1">
                {role}
                {isNext && <span className="text-[9px] leading-none px-1 py-0.5 rounded bg-primary text-white">지금 차례</span>}
                {signed && <span className="text-success text-[11px]">✓</span>}
              </Label>
              <Input className="h-8 text-xs" placeholder="성명" value={slot.name}
                onChange={(e) => setRole(role, { name: e.target.value })} />
              <div className={`text-[10px] min-h-[14px] ${signed ? "text-success" : "text-muted-foreground"}`}>{signed ? new Date(slot.at).toLocaleDateString("ko-KR") + " 결재" : "미결재"}</div>
              <Button type="button" variant={signed ? "secondary" : isNext ? "default" : "outline"} size="sm" className="w-full h-7 text-xs"
                onClick={() => (signed ? setRole(role, { at: "" }) : slot.name ? setRole(role, { at: new Date().toISOString() }) : toast.error("성명을 먼저 입력하세요"))}>
                {signed ? "결재취소" : "결재"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 인쇄용 결재란(우측 상단). PrintSheet의 headerRight로 넘긴다.
export function InspectionApprovalBox({ approval }: { approval?: InspApproval }) {
  const v = approval ?? {};
  return (
    <table className="ps-approval" style={{ width: "80mm" }}>
      <tbody>
        <tr>
          <th rowSpan={2} style={{ width: "7mm", writingMode: "vertical-rl" as any }}>결재</th>
          {INSP_APPROVAL_ROLES.map((r) => <th key={r}>{r}</th>)}
        </tr>
        <tr>
          {INSP_APPROVAL_ROLES.map((r) => (
            <td key={r}>
              <div style={{ fontWeight: 700 }}>{v[r]?.name || ""}</div>
              <div style={{ fontSize: "7pt", color: "#555", marginTop: "1mm" }}>{v[r]?.at ? new Date(v[r].at).toLocaleDateString("ko-KR") : ""}</div>
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}
