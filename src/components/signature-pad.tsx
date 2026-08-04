import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Props {
  onChange?: (dataUrl: string | null) => void;
  height?: number;
}

export function SignaturePad({ onChange, height = 160 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * ratio;
    c.height = rect.height * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#1E40AF";
  }, []);

  function pos(e: React.PointerEvent) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function start(e: React.PointerEvent) {
    drawing.current = true;
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    (e.target as Element).setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    if (empty) setEmpty(false);
  }
  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    const c = canvasRef.current!;
    onChange?.(c.toDataURL("image/png"));
  }
  function clear() {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    setEmpty(true);
    onChange?.(null);
  }

  return (
    <div className="space-y-2">
      <div className="relative rounded-md border-2 border-dashed border-border bg-card overflow-hidden touch-none" style={{ height }}>
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
        {empty && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            여기에 손가락 또는 마우스로 서명하세요
          </div>
        )}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={clear} className="gap-1">
        <Eraser className="h-3.5 w-3.5" /> 다시 서명
      </Button>
    </div>
  );
}

/**
 * 참석자 이름 옆 서명 컨트롤. 값이 없으면 [서명] 버튼, 있으면 서명 썸네일(누르면 다시).
 * 서명은 작은 PNG dataURL로 참석자 객체에 저장 → 별도 업로드/마이그레이션 없음.
 * 소장 기기 한 대를 돌려가며 각자 손가락으로 서명하는 현장 방식. 출력물에도 인쇄됨.
 */
export function SignatureButton({ value, onChange, name }: { value?: string; onChange: (dataUrl: string) => void; name?: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  function openPad() { setDraft(null); setOpen(true); }
  return (
    <>
      {value ? (
        <button type="button" onClick={openPad} title="서명 다시" className="shrink-0">
          <img src={value} alt="서명" className="h-8 w-20 object-contain border rounded bg-white" />
        </button>
      ) : (
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs shrink-0" onClick={openPad}>
          <Pencil className="h-3 w-3" />서명
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{name ? `${name} 서명` : "서명"}</DialogTitle></DialogHeader>
          <SignaturePad onChange={setDraft} />
          <DialogFooter className="gap-2 sm:gap-2">
            {value && <Button variant="ghost" className="text-danger hover:text-danger mr-auto" onClick={() => { onChange(""); setOpen(false); }}>서명 삭제</Button>}
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button onClick={() => { if (!draft) { toast.error("서명을 입력해주세요"); return; } onChange(draft); setOpen(false); }}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
