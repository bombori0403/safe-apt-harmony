import { myComplexMemberships } from "@/lib/my-complexes";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { MemberOpinionList } from "@/components/member-opinion-form";
import { ChevronRight, MessageCircle, PenLine } from "lucide-react";

/**
 * 직원(member) 대시보드 — "할 일" 두 가지만 크게.
 *   ① 안전 의견 남기기
 *   ② 확인·서명할 평가 (내 이름으로 참여자 등록된 평가 중 아직 확인 안 한 것)
 * 아차사고 접수·새 평가·이력 전체보기는 관리자·매니저 업무라 보여주지 않는다.
 *
 * 참여자(participants)는 명부(staff_roster)의 이름으로 등록되어 user_id 가 비어 있는 행이 대부분이다.
 * user_id 가 있으면 그것으로, 없으면 내 이름과 같은 행으로 찾는다. 동명이인이면 두 건 다 보일 수 있다 —
 * 확인 화면에서 본인 것만 서명하면 된다. "확인 완료"는 participants.confirmed 또는 서명(signatures) 존재로 판단한다.
 */
type Pending = { id: string; work_name: string; assessment_date: string | null; complex_name: string };

export function MemberHome({ userRow }: { userRow: any }) {
  const [pending, setPending] = useState<Pending[] | null>(null);

  useEffect(() => {
    if (!userRow?.id) return;
    (async () => {
      const { data: cm } = await myComplexMemberships(userRow.id);
      const ids = (cm ?? []).map((c: any) => c.complex_id);
      if (ids.length === 0) { setPending([]); return; }
      const { data: as } = await supabase
        .from("assessments").select("id, work_name, assessment_date, complex_id, status")
        .in("complex_id", ids).neq("status", "완료").order("created_at", { ascending: false }).limit(50);
      const list = as ?? [];
      if (list.length === 0) { setPending([]); return; }
      const myName = String(userRow.name ?? "").trim();
      const aIds = list.map((a: any) => a.id);
      const [{ data: ps }, { data: sigs }] = await Promise.all([
        supabase.from("participants").select("id, assessment_id, name, user_id, confirmed").in("assessment_id", aIds),
        supabase.from("signatures").select("participant_id").in("assessment_id", aIds),
      ]);
      const signed = new Set((sigs ?? []).map((s: any) => s.participant_id));
      const need = new Set(
        (ps ?? [])
          .filter((p: any) => {
            const mine = p.user_id ? p.user_id === userRow.id : String(p.name ?? "").trim() === myName;
            return mine && !p.confirmed && !signed.has(p.id);
          })
          .map((p: any) => p.assessment_id),
      );
      const { data: cx } = await supabase.from("complexes").select("id, name").in("id", ids);
      const cname: Record<string, string> = {};
      (cx ?? []).forEach((c: any) => { cname[c.id] = c.name; });
      setPending(
        list.filter((a: any) => need.has(a.id)).map((a: any) => ({
          id: a.id, work_name: a.work_name, assessment_date: a.assessment_date, complex_name: cname[a.complex_id] ?? "",
        })),
      );
    })();
  }, [userRow?.id, userRow?.name]);

  const n = pending?.length ?? 0;

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">안녕하세요, {userRow?.name ?? ""}님</h1>
        <p className="text-base text-muted-foreground mt-1">오늘 할 일을 골라 주세요.</p>
      </div>

      {/* 할 일 ① */}
      <Link to="/employee-inputs" className="block">
        <Card className="border-primary/40 hover:border-primary transition-colors">
          <CardContent className="p-5 md:p-6 flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <MessageCircle className="h-7 w-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xl font-bold">안전 의견 남기기</div>
              <div className="text-base text-muted-foreground">현장에서 위험하다고 느낀 것을 알려 주세요. 사진만 올려도 됩니다.</div>
            </div>
            <ChevronRight className="h-6 w-6 text-muted-foreground shrink-0" />
          </CardContent>
        </Card>
      </Link>

      {/* 할 일 ② */}
      <Card className={n > 0 ? "border-warning/60" : ""}>
        <CardContent className="p-5 md:p-6 space-y-3">
          <div className="flex items-center gap-4">
            <div className={`h-14 w-14 rounded-xl flex items-center justify-center shrink-0 ${n > 0 ? "bg-warning text-warning-foreground" : "bg-muted text-muted-foreground"}`}>
              <PenLine className="h-7 w-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xl font-bold">
                {pending === null ? "확인·서명할 평가" : n > 0 ? `확인·서명할 평가 ${n}건` : "확인·서명할 평가 없음"}
              </div>
              <div className="text-base text-muted-foreground">
                {n > 0 ? "내용을 확인하고 참여 확인 서명을 해 주세요." : "관리자가 확인을 요청하면 여기에 표시됩니다."}
              </div>
            </div>
          </div>
          {n > 0 && (
            <ul className="divide-y border-t">
              {pending!.map((a) => (
                <li key={a.id}>
                  <Link to="/confirm/$id" params={{ id: a.id }} className="flex items-center justify-between gap-3 py-3 hover:bg-muted/40 -mx-2 px-2 rounded">
                    <div className="min-w-0">
                      <div className="text-base font-medium truncate">{a.work_name}</div>
                      <div className="text-sm text-muted-foreground">{a.complex_name}{a.assessment_date ? ` · ${a.assessment_date}` : ""}</div>
                    </div>
                    <span className="text-primary font-semibold shrink-0">확인하기 →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 md:p-6 space-y-2">
          <h2 className="text-lg font-semibold">내가 남긴 의견</h2>
          <MemberOpinionList limit={5} />
        </CardContent>
      </Card>
    </div>
  );
}
