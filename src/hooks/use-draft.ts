import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 폼 입력을 이 기기(localStorage)에 자동 저장하는 훅.
 *
 * 왜: 새 평가·의견·신고 폼이 새로고침/뒤로가기 한 번에 전부 사라지는 것이
 * 고령 사용자에게 가장 큰 좌절이었다. 서버 저장(공식 기록)과는 별개의 "임시 저장"이다.
 *
 * 사용법:
 *   const draft = useDraft(`assessment-new:${userId}:${complexId}`, form);
 *   // 마운트 시 draft.pending 에 이전 저장분이 들어온다 → <DraftBanner> 로 "이어서 쓰기 / 새로 쓰기" 선택
 *   // 이어서 쓰기: setForm(draft.take()!)   새로 쓰기: draft.discard()
 *   // 제출 성공: draft.clear()
 *
 * 규칙:
 * - key 에 반드시 사용자 ID를 넣는다 (사무소 공동 PC에서 남의 초안을 보면 안 된다).
 * - pending(복구 대기)이 남아 있는 동안은 현재 값을 덮어쓰지 않는다 — 빈 폼이 초안을 지우는 사고 방지.
 * - 키가 바뀌면(단지 변경 등) 그 키에서 실제 입력 변경이 생기기 전까지는 저장하지 않는다 — 초안 섞임 방지.
 * - clear() 는 예약된 저장까지 취소한다 — 제출 직후 초안이 되살아나는 사고 방지.
 * - 같은 내용은 다시 저장하지 않는다 (객체 리터럴을 넘겨도 무한 저장 루프가 생기지 않는다).
 * - 사진 파일은 저장하지 않는다. 이미 업로드된 경로(string)만 복원된다.
 * - localStorage 가 막힌 환경(사생활 모드 등)에서는 조용히 아무것도 하지 않는다.
 */
export function useDraft<T>(
  key: string | null | undefined,
  value: T,
  options: { debounceMs?: number; enabled?: boolean } = {},
) {
  const { debounceMs = 800, enabled = true } = options;
  const fullKey = key ? `riskeulog:draft:${key}` : null;

  // pending 은 "어느 키의 복구분인지"를 함께 들고 있어 키가 바뀌면 자동으로 무효가 된다.
  const [pendingFor, setPendingFor] = useState<{ key: string; value: T; at: Date } | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string | null>(null); // 마지막으로 저장한 직렬화 문자열
  const armedKey = useRef<string | null>(null); // 이 키에서 "초기화 이후 첫 렌더"가 지났는지
  const cleared = useRef(false); // clear() 이후 예약 콜백 차단

  const cancelTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  // 키가 정해지거나 바뀌면: 예약 저장 취소, 상태 초기화, 이전 저장분 읽기
  useEffect(() => {
    cancelTimer();
    cleared.current = false;
    lastSaved.current = null;
    armedKey.current = null;
    setSavedAt(null);
    setPendingFor(null);
    if (!fullKey) return;
    try {
      const raw = localStorage.getItem(fullKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { value: T; at: number };
        if (parsed && typeof parsed.at === "number") {
          lastSaved.current = JSON.stringify(parsed.value);
          setPendingFor({ key: fullKey, value: parsed.value, at: new Date(parsed.at) });
        }
      }
    } catch {
      /* 저장소 접근 불가 — 무시 */
    }
    return cancelTimer;
  }, [fullKey]);

  const pending = pendingFor && pendingFor.key === fullKey ? pendingFor : null;

  // 값이 바뀌면 디바운스 후 저장
  useEffect(() => {
    if (!fullKey || !enabled) return;
    // 이 키에서의 첫 렌더(초기값)는 저장하지 않는다. 그 다음 실제 변경부터 저장.
    if (armedKey.current !== fullKey) {
      armedKey.current = fullKey;
      return;
    }
    if (pending) return; // 복구 대기 중엔 덮어쓰지 않음
    let serialized: string;
    try {
      serialized = JSON.stringify(value);
    } catch {
      return;
    }
    if (serialized === lastSaved.current) return; // 같은 내용은 다시 저장하지 않음
    cancelTimer();
    cleared.current = false;
    timer.current = setTimeout(() => {
      timer.current = null;
      if (cleared.current) return;
      try {
        localStorage.setItem(fullKey, JSON.stringify({ value, at: Date.now() }));
        lastSaved.current = serialized;
        setSavedAt(new Date());
      } catch {
        /* 용량 초과·접근 불가 — 무시 */
      }
    }, debounceMs);
    return cancelTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullKey, value, enabled, debounceMs, pending]);

  /** 복구 대기분을 꺼내고 대기 상태를 끝낸다 (이어서 쓰기). */
  const take = useCallback(() => {
    const v = pending ? pending.value : null;
    setPendingFor(null);
    return v;
  }, [pending]);

  /** 복구 대기분을 버리고 새로 쓴다. 저장소의 값은 다음 입력 때 덮어써진다. */
  const discard = useCallback(() => {
    setPendingFor(null);
  }, []);

  /** 제출 성공 후: 저장소에서 지우고, 예약된 저장도 취소한다. */
  const clear = useCallback(() => {
    cancelTimer();
    cleared.current = true;
    lastSaved.current = null;
    if (fullKey) {
      try {
        localStorage.removeItem(fullKey);
      } catch {
        /* 무시 */
      }
    }
    setPendingFor(null);
    setSavedAt(null);
  }, [fullKey]);

  return {
    pending: pending ? pending.value : null,
    pendingAt: pending ? pending.at : null,
    savedAt,
    take,
    discard,
    clear,
  };
}
