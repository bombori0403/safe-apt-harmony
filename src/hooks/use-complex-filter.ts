import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

// 안전활동 목록 화면 공용 단지 필터.
// 관리자는 조직 전체 단지, 그 외는 배정된 단지(complex_members)만.
// 단지가 2개 이상일 때만 필터를 노출하면 된다(complexes.length > 1).
export function useComplexFilter() {
  const { user } = useAuth();
  const [complexes, setComplexes] = useState<{ id: string; name: string }[]>([]);
  const [filterComplex, setFilterComplex] = useState<string>("all");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: u } = await supabase.from("users").select("id, org_role").eq("auth_id", user.id).maybeSingle();
      let list: { id: string; name: string }[] = [];
      if (u?.org_role === "admin") {
        list = (await supabase.from("complexes").select("id,name").order("name")).data ?? [];
      } else {
        const { data: m } = await supabase.from("complex_members").select("complex_id").eq("user_id", u?.id ?? "");
        const ids = [...new Set((m ?? []).map((x: any) => x.complex_id).filter(Boolean))];
        list = ids.length ? (await supabase.from("complexes").select("id,name").in("id", ids)).data ?? [] : [];
      }
      setComplexes(list);
    })();
  }, [user]);

  const nameById = useMemo(() => Object.fromEntries(complexes.map((c) => [c.id, c.name])), [complexes]);
  return { complexes, filterComplex, setFilterComplex, nameById };
}
