import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserPlus, X, Pencil, Check } from "lucide-react";
import { toast } from "sonner";
import { writeErrorMessage } from "@/lib/write-error";
import { ATTENDEE_ROLES } from "@/lib/tbm-presets";

/**
 * 단지별 직원 명부에서 참석자를 체크로 끌어오는 공용 피커.
 * - 명부(staff_roster)에서 아직 선택되지 않은 사람을 칩으로 보여주고, 누르면 onPick.
 * - 새 이름은 명부에 저장(자동 축적)하고 바로 선택.
 * - 편집 모드에서 잘못 넣은 명부 항목을 비활성(active=false) 처리.
 * onPick(name, role)에서 부모가 각자 형식의 참석자 객체를 만들어 추가한다.
 */
export function AttendeePicker({
  complexId, orgId, selectedNames, onPick,
}: {
  complexId: string;
  orgId?: string;
  selectedNames: string[];
  onPick: (name: string, role: string) => void;
}) {
  const [roster, setRoster] = useState<{ id: string; name: string; role: string | null }[]>([]);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState(ATTENDEE_ROLES[0]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (complexId) load(); /* eslint-disable-next-line */ }, [complexId]);

  async function load() {
    const { data } = await (supabase as any)
      .from("staff_roster")
      .select("id,name,role")
      .eq("complex_id", complexId)
      .eq("active", true)
      .order("role", { ascending: true })
      .order("name", { ascending: true });
    setRoster(data ?? []);
  }

  async function addNew() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    const { data, error } = await (supabase as any).from("staff_roster")
      .insert({ complex_id: complexId, organization_id: orgId, name, role: newRole })
      .select("id,name,role").maybeSingle();
    setBusy(false);
    if (error) { toast.error(writeErrorMessage(error)); return; }
    if (data) setRoster((r) => [...r, data]);
    onPick(name, newRole);
    setNewName("");
  }

  async function deactivate(id: string) {
    const { error } = await (supabase as any).from("staff_roster").update({ active: false }).eq("id", id);
    if (error) { toast.error(writeErrorMessage(error)); return; }
    setRoster((r) => r.filter((x) => x.id !== id));
  }

  const picked = new Set(selectedNames);
  const available = roster.filter((m) => !picked.has(m.name));

  return (
    <div className="rounded-md border p-3 space-y-2 bg-muted/20">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">직원 명부에서 참석자 추가</span>
        {roster.length > 0 && (
          <button type="button" onClick={() => setEditing((v) => !v)} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            {editing ? <><Check className="h-3 w-3" />완료</> : <><Pencil className="h-3 w-3" />명부 편집</>}
          </button>
        )}
      </div>

      {roster.length === 0 ? (
        <p className="text-xs text-muted-foreground">명부가 비어 있습니다. 아래에서 이름을 추가하면 다음부터 눌러서 바로 넣을 수 있어요.</p>
      ) : editing ? (
        <div className="flex flex-wrap gap-1.5">
          {roster.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border bg-background text-sm">
              {m.name}<span className="text-[10px] text-muted-foreground">{m.role}</span>
              <button type="button" onClick={() => deactivate(m.id)} className="text-muted-foreground hover:text-danger" title="명부에서 제거"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      ) : available.length === 0 ? (
        <p className="text-xs text-muted-foreground">명부의 모든 인원이 이미 추가되었습니다.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {available.map((m) => (
            <button key={m.id} type="button" onClick={() => onPick(m.name, m.role ?? "기타")}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border bg-background text-sm hover:border-primary hover:bg-primary/5">
              <UserPlus className="h-3 w-3 text-primary" />{m.name}<span className="text-[10px] text-muted-foreground">{m.role}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="새 이름 추가" className="h-9 flex-1"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNew(); } }} />
        <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="h-9 px-2 rounded-md border bg-background text-sm">
          {ATTENDEE_ROLES.map((r) => <option key={r}>{r}</option>)}
        </select>
        <Button type="button" variant="outline" className="h-9 shrink-0" onClick={addNew} disabled={busy}><UserPlus className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
