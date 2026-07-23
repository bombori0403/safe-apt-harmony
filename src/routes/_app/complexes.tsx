import { createFileRoute } from "@tanstack/react-router";
import { ComplexManager } from "@/components/complex-manager";

export const Route = createFileRoute("/_app/complexes")({ component: Complexes });

function Complexes() {
  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">단지 관리</h1>
        <p className="text-sm text-muted-foreground mt-1">평가 대상 단지(사업장)를 등록·수정·삭제합니다. 새 평가는 여기 등록된 단지에서 시작합니다.</p>
      </div>
      <ComplexManager />
    </div>
  );
}
