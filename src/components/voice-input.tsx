import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Check, X, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * 말로 입력 — Web Speech API(ko-KR). 타이핑이 힘든 고령 사용자용 **보조** 기능.
 *
 * 원칙 (UX 검토 중2 · 사용자 요구 "기기 무관 정상 작동"):
 * - 지원하지 않는 브라우저(아이폰 사파리 일부 등)나 마이크 권한 거부 시 버튼을 **숨기고** 아무 일도 하지 않는다.
 *   음성이 없어도 폼은 똑같이 동작한다.
 * - 인식 중인 글은 textarea 에 바로 쓰지 않고 이 상자 안에 보여준다. 상태를 글자로 표시한다:
 *   "듣는 중" / "정리하는 중" / "멈춤". '이 내용 넣기'를 눌렀을 때만 onCommit 으로 넘긴다.
 *   → 다시 말해도 중복 문장이 쌓이지 않고, 취소하면 이번 인식분만 사라진다.
 * - 인식기 이벤트는 "지금 살아 있는 세션"의 것만 받는다(세션 교체·취소 뒤에 늦게 오는 onend/onerror 무시).
 * - stop() 은 비동기라, 마지막 결과가 도착해 onend 가 올 때까지 '정리하는 중'으로 두고 확정 버튼을 잠근다.
 */
type SR = any;
function getSR(): (new () => SR) | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

type Status = "idle" | "listening" | "stopping" | "paused";

export function VoiceInput({
  onCommit,
  onCommitted,
  className,
  hint,
}: {
  onCommit: (text: string) => void;
  /** 넣은 뒤 포커스를 돌려줄 곳(예: textarea) — 접근성 */
  onCommitted?: () => void;
  className?: string;
  hint?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const [notice, setNotice] = useState(""); // 화면 읽기용 짧은 상태 안내(aria-live)
  const recRef = useRef<SR | null>(null);
  const baseRef = useRef(""); // 이전 세션('이어서 말하기' 전)까지 확정된 글 — 현재 세션 결과는 여기에 더해 다시 조립
  const startBtn = useRef<HTMLButtonElement | null>(null);
  const stopBtn = useRef<HTMLButtonElement | null>(null);
  const commitBtn = useRef<HTMLButtonElement | null>(null);

  useEffect(() => { setSupported(!!getSR()); }, []);
  useEffect(() => () => { detachAndAbort(); }, []); // 언마운트: 핸들러 해제 후 중단

  // 상태 전환 뒤 다음 조작 버튼으로 포커스 이동 (버튼이 DOM 에서 바뀌므로)
  useEffect(() => {
    const t = setTimeout(() => {
      if (status === "listening") stopBtn.current?.focus();
      else if (status === "paused") commitBtn.current?.focus();
    }, 0);
    return () => clearTimeout(t);
  }, [status]);

  function detachAndAbort() {
    const rec = recRef.current;
    if (!rec) return;
    rec.onresult = rec.onerror = rec.onend = rec.onstart = null;
    recRef.current = null;
    try { rec.abort?.(); } catch { /* 무시 */ }
  }

  function disable(msg: string) {
    detachAndAbort();
    setSupported(false);
    setStatus("idle");
    setFinalText(""); setInterim("");
    toast.info(msg);
  }

  function start() {
    const Ctor = getSR();
    if (!Ctor) { disable("이 기기에서는 음성 입력을 쓸 수 없습니다. 글로 적어 주세요."); return; }
    detachAndAbort(); // 이전 세션이 남아 있으면 정리
    let rec: SR;
    try { rec = new Ctor(); } catch { disable("이 기기에서는 음성 입력을 쓸 수 없습니다. 글로 적어 주세요."); return; }
    rec.lang = "ko-KR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    const mine = () => recRef.current === rec; // 늦게 오는 옛 세션 이벤트 거르기

    rec.onresult = (e: any) => {
      if (!mine()) return;
      // 안드로이드 크롬 계열은 지금까지의 결과 전체를 매번 다시 보내고 resultIndex 도 믿을 수 없다.
      // 그래서 "새로 온 부분만 누적"하지 않고, 확정·임시 모두 e.results 전체에서 매번 다시 조립한다(멱등 → 반복 입력 없음).
      let fin = "", mid = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        const t = (r[0]?.transcript ?? "").trim();
        if (!t) continue;
        if (r.isFinal) fin += (fin ? " " : "") + t; else mid += (mid ? " " : "") + t;
      }
      setFinalText(baseRef.current ? (fin ? `${baseRef.current} ${fin}` : baseRef.current) : fin);
      setInterim(mid);
    };
    rec.onerror = (e: any) => {
      if (!mine()) return;
      const code = e?.error;
      if (code === "aborted") return; // 우리가 abort 한 것
      if (code === "not-allowed" || code === "service-not-allowed" || code === "audio-capture" || code === "language-not-supported") {
        disable("마이크를 쓸 수 없어 음성 입력을 껐습니다. 글로 적어 주세요.");
        return;
      }
      if (code === "network") toast.error("인터넷 연결이 필요합니다. 글로 적어 주세요.");
      // no-speech 등: onend 가 이어서 오므로 거기서 paused 처리
    };
    rec.onend = () => {
      if (!mine()) return;
      setInterim("");
      setStatus("paused"); // 사용자가 멈췄든, 무음으로 끝났든 → 지금까지 들은 내용을 넣을지 고르게
      setNotice("듣기를 멈췄습니다. 내용을 확인하고 넣어 주세요.");
    };
    recRef.current = rec;
    baseRef.current = finalText.trim(); // 이어서 말하기: 지금까지 확정된 글은 그대로 두고 그 뒤에 붙인다
    try {
      rec.start();
      setStatus("listening");
      setNotice("듣는 중입니다. 말씀하세요.");
    } catch {
      disable("음성 입력을 시작하지 못했습니다. 글로 적어 주세요.");
    }
  }

  /** 말하기 끝내기: stop() 은 비동기 — 마지막 결과·onend 가 올 때까지 '정리하는 중' */
  function stopListening() {
    setStatus("stopping");
    setNotice("말한 내용을 정리하는 중입니다.");
    try { recRef.current?.stop?.(); } catch { setStatus("paused"); }
  }

  function commit() {
    const text = (finalText + (interim ? " " + interim : "")).trim();
    detachAndAbort();
    baseRef.current = "";
    setStatus("idle"); setFinalText(""); setInterim("");
    if (text) {
      onCommit(text);
      setNotice("말한 내용을 입력칸에 넣었습니다.");
      setTimeout(() => onCommitted?.(), 0);
    } else {
      toast.info("들린 말이 없어 넣을 내용이 없습니다.");
      setNotice("");
      setTimeout(() => startBtn.current?.focus(), 0);
    }
  }

  function cancel() {
    detachAndAbort();
    baseRef.current = "";
    setStatus("idle"); setFinalText(""); setInterim("");
    setNotice("이번 음성 입력을 취소했습니다.");
    setTimeout(() => startBtn.current?.focus(), 0);
  }

  if (!supported) return null;

  const live = (finalText + (interim ? " " + interim : "")).trim();

  if (status === "idle") {
    return (
      <div className={cn("space-y-1", className)}>
        <Button ref={startBtn} type="button" variant="outline" className="gap-2" onClick={start}>
          <Mic className="h-5 w-5" />말로 입력하기
        </Button>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        <span className="sr-only" role="status" aria-live="polite">{notice}</span>
      </div>
    );
  }

  return (
    <div className={cn("rounded-md border border-primary/40 bg-primary/5 p-3 space-y-2", className)} role="group" aria-label="음성 입력">
      {/* 상태 한 줄만 음성 안내 — 실시간 미리보기는 aria-live 를 걸지 않는다 */}
      <div className="flex items-center gap-2 text-base font-medium" role="status" aria-live="polite">
        {status === "listening" && <><span className="inline-block h-3 w-3 rounded-full bg-destructive animate-pulse" aria-hidden="true" />듣는 중… 말씀하세요</>}
        {status === "stopping" && <><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />말한 내용을 정리하는 중…</>}
        {status === "paused" && <><Mic className="h-5 w-5 text-muted-foreground" aria-hidden="true" />듣기를 멈췄습니다. 내용을 확인하세요</>}
      </div>
      <div className="min-h-[3rem] rounded bg-background border px-3 py-2 text-base whitespace-pre-wrap" aria-label="들린 내용">
        {live || <span className="text-muted-foreground">여기에 들리는 말이 글로 나타납니다</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {status === "listening" && (
          <Button ref={stopBtn} type="button" onClick={stopListening} className="gap-2"><Square className="h-4 w-4" />말하기 끝내기</Button>
        )}
        {status === "stopping" && (
          <Button type="button" disabled className="gap-2"><Loader2 className="h-4 w-4 animate-spin" />정리하는 중…</Button>
        )}
        {status === "paused" && (
          <>
            <Button ref={commitBtn} type="button" onClick={commit} disabled={!live} className="gap-2"><Check className="h-5 w-5" />이 내용 넣기</Button>
            <Button type="button" variant="outline" onClick={start} className="gap-2"><RotateCcw className="h-4 w-4" />이어서 말하기</Button>
          </>
        )}
        <Button type="button" variant="ghost" onClick={cancel} className="gap-2 text-muted-foreground"><X className="h-5 w-5" />이번 입력 취소</Button>
      </div>
      {status === "listening" && <p className="text-sm text-muted-foreground">다 말했으면 "말하기 끝내기"를 누른 뒤 내용을 확인하고 넣습니다.</p>}
    </div>
  );
}

/** textarea 끝에 음성 결과를 붙일 때 쓰는 도우미 — 기존 글 끝의 공백을 정리하고 줄을 바꿔 붙인다 */
export function appendSpoken(prev: string, spoken: string) {
  const base = (prev ?? "").replace(/\s+$/, "");
  return base ? `${base}\n${spoken}` : spoken;
}
