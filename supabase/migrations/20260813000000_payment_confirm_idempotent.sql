-- 결제 승인 활성화를 "주문 단위 원자적·멱등"으로 개편 (2026-08-13)
-- ⚠️ Supabase SQL Editor에서 실행하세요. (크롬 자동번역 OFF)
--
-- 배경(버그): confirmPaymentAndActivate가 주문을 confirming으로 선점한 뒤
--   ① apply_paid_activation(RPC) 또는 ② 최종 payments update가 실패하면 복구 경로가 없었다.
--   → 주문이 confirming에 갇혀 재방문 시 "이미 처리 중" 데드엔드, billing이 새 주문을 만들어 중복결제 위험.
--   토스 confirm은 멱등이라 재구동할 수 있지만, apply_paid_activation은 만료일을 무조건 이어붙여
--   재구동하면 만료가 2배 연장되는 문제가 있었다.
--
-- 해결: 결제 승인 표시(payments.status→paid)와 조직 활성화(만료 연장)를 하나의 함수/트랜잭션에 합치고,
--   payments 행의 confirming→paid 전이를 원자적 가드로 삼는다. 이미 paid면 UPDATE가 0행이라 만료 연장을
--   건너뛴다(멱등). 덕분에 토스 confirm을 여러 번 재구동해도 활성화는 정확히 1회만 적용된다.

-- 시그니처가 바뀌므로 구버전 함수 제거
drop function if exists public.apply_paid_activation(uuid, integer);

create or replace function public.apply_paid_activation(
  p_order_id     text,
  p_payment_key  text default null,
  p_method       text default null,
  p_receipt_url  text default null
)
returns boolean            -- true=이번 호출에서 실제 활성화 적용, false=이미 처리됨(멱등 스킵)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org    uuid;
  v_months integer;
begin
  -- confirming 주문만 원자적으로 paid로 전이 + 결제정보 기록.
  -- 이미 paid거나 상태가 다르면 0행 → 조직 만료 연장을 하지 않는다(중복 활성화 방지).
  update public.payments
     set status      = 'paid',
         payment_key = coalesce(p_payment_key, payment_key),
         method      = coalesce(p_method, method),
         receipt_url = coalesce(p_receipt_url, receipt_url),
         paid_at     = now()
   where order_id = p_order_id
     and status   = 'confirming'
   returning organization_id,
             case when billing_cycle = 'monthly' then 1 else 12 end
    into v_org, v_months;

  if v_org is null then
    return false;   -- 이미 처리됐거나(paid) 선점되지 않은 주문 → 멱등 스킵
  end if;

  -- 가드 트리거를 트랜잭션 로컬 GUC로 통과시켜 조직을 active로 전환하고 만료를 연장한다.
  perform set_config('app.allow_billing_write', 'on', true);
  update public.organizations
     set subscription_status = 'active',
         expires_at = greatest(coalesce(expires_at, now()), now())
                      + make_interval(months => v_months),
         activation_requested_at = null
   where id = v_org;
  perform set_config('app.allow_billing_write', 'off', true);

  return true;
end;
$$;

revoke all on function public.apply_paid_activation(text, text, text, text) from public, anon, authenticated;
grant execute on function public.apply_paid_activation(text, text, text, text) to service_role;
