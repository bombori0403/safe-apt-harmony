-- 긴급 신고 플래그
-- Supabase SQL Editor에서 실행. (크롬 자동번역 OFF)
-- 아차사고·직원참여에 '긴급' 표시를 추가한다. 긴급 등록 시 서버 함수가
-- 조직 관리자(관리소장)에게 이메일로 즉시 알린다(SMS는 공급자 연동 시 추가).

ALTER TABLE public.near_miss
  ADD COLUMN IF NOT EXISTS urgent boolean NOT NULL DEFAULT false;

ALTER TABLE public.employee_inputs
  ADD COLUMN IF NOT EXISTS urgent boolean NOT NULL DEFAULT false;
