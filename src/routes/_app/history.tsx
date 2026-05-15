import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { riskLevelClass, type RiskLevel } from "@/lib/types";
import { deleteAssessment } from "@/lib/assessment.functions";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/history")({
  component: History,
});

function History() {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [pendingDelete, setPendingDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const del = useServerFn(deleteAssessment);
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const canManage = role === "admin" || role === "manager";

  useEffect(() => {
    if (!user) return;
    supabase.from("users").select("org_role").eq("auth_id", user.id).maybeSingle()
      .then(({ data }) => setRole(data?.org_role ?? null));
  }, [user]);

  const load = () =>
    supabase.from("assessments").select("*").order("assessment_date", { ascending: false }).then(({ data }) => {
      setItems(data ?? []);
    });

  useEffect(() => { load(); }, []);

  const filtered = items.filter(i => !q || i.work_name?.includes(q));

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await del({ data: { assessmentId: pendingDelete.id } });
      toast.success("삭제되었습니다.");
      setPendingDelete(null);
      await load();
    } catch (e: any) {
      toast.error("삭제 실패: " + (e?.message ?? e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold">평가 이력</h1>
        <p className="text-sm text-muted-foreground mt-1">
          위험성평가 결과는 3년간 보존하여야 합니다 (산업안전보건법 시행규칙).
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={e=>setQ(e.target.value)} placeholder="작업명 검색..." className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {filtered.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">기록이 없습니다.</div>
            )}
            {filtered.map(a => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 p-4 hover:bg-muted/40 transition-colors">
                <Link to="/assessment/$id" params={{ id: a.id }} className="flex-1 min-w-0">
                  <div className="font-medium truncate">{a.work_name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {a.assessment_date} · {a.method} · {a.work_category ?? "-"}
                  </div>
                </Link>
                <Badge variant="outline">{a.status}</Badge>
                {a.allowable_level && (
                  <span className={`px-2 py-1 rounded-md text-xs font-medium ${riskLevelClass(a.allowable_level as RiskLevel)}`}>
                    허용 {a.allowable_level}
                  </span>
                )}
                {canManage && (
                  <Button
                    variant="ghost" size="icon"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPendingDelete(a); }}
                    aria-label="삭제"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>평가를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              "{pendingDelete?.work_name}" 평가와 관련된 모든 유해·위험요인, 감소대책, 참여자, 서명이 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
