-- 3단계 열람·공유 (2026-10-25)
-- ⚠️ Supabase SQL Editor에서 수동 실행 (크롬 자동번역 OFF). 실행 전에는 공개 열람(/view)과 열람 확인이 동작하지 않는다.
--
-- 1) assessments.share_enabled — 공유 링크(참여 확인 /confirm, 진행 현황 열람 /view) 켜기/끄기.
--    링크가 유출돼도 담당자가 끌 수 있게. 기본값 true (기존 평가는 지금처럼 열림).
-- 2) assessment_acks — 입주자대표·본사 담당 등 외부인이 진행 현황을 "확인했습니다"라고 남긴 기록.
--    결재가 아니라 보고·열람 증빙. 쓰기는 서버 함수(service role)만, 읽기는 그 평가에 접근 가능한 로그인 사용자.

ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS share_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.assessment_acks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  acked_at timestamptz NOT NULL DEFAULT now(),
  user_agent text
);
CREATE INDEX IF NOT EXISTS idx_assessment_acks_assessment ON public.assessment_acks(assessment_id);

ALTER TABLE public.assessment_acks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS assessment_acks_select ON public.assessment_acks;
CREATE POLICY assessment_acks_select
  ON public.assessment_acks FOR SELECT TO authenticated
  USING (public.can_access_assessment(assessment_id));
-- INSERT/UPDATE/DELETE 정책 없음 → 클라이언트에서는 쓸 수 없고 서버 함수(service role)만 기록한다.
