-- 온라인 결제(연간) — payments 테이블 + 결제 활성화 함수
-- ⚠️ Supabase SQL Editor에서 실행하세요. (크롬 자동번역 OFF)
-- 과금 모델: 세대수 구간 정액제(단지당). 금액 계산은 앱(src/lib/pricing.ts)에서 하고,
--            서버가 계산한 금액으로 payments 행을 만든 뒤 토스 결제 승인 시 조직을 active로 전환한다.

-- 1) 결제 내역 테이블 -----------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id text not null unique,          -- 서버 생성 주문번호
  payment_key text,                       -- 토스 결제키(승인 후)
  amount integer not null,                -- 결제 금액(원)
  billing_cycle text not null default 'annual',  -- annual | monthly
  status text not null default 'ready',   -- ready | paid | failed
  method text,                            -- 카드/계좌 등
  receipt_url text,
  breakdown jsonb,                        -- 단지별 단가 명세 스냅샷
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.payments enable row level security;

-- 조직 구성원은 자기 조직 결제내역을 조회만 가능. INSERT/UPDATE는 서비스롤(서버)만.
drop policy if exists payments_select_own_org on public.payments;
create policy payments_select_own_org on public.payments
  for select using (
    organization_id in (
      select organization_id from public.users where auth_id = auth.uid()
    )
  );

create index if not exists payments_org_idx on public.payments(organization_id);
create index if not exists payments_status_idx on public.payments(status);

-- 2) 가드 트리거 확장 -----------------------------------------------------------
-- 기존 트리거는 플랫폼 관리자만 구독 컬럼을 바꿀 수 있게 막는다.
-- 결제 활성화는 아래 apply_paid_activation() 안에서만 켜지는 트랜잭션 로컬 GUC로 통과시킨다.
create or replace function public.guard_org_billing_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.is_platform_admin()
     and coalesce(current_setting('app.allow_billing_write', true), '') <> 'on' then
    new.subscription_status := old.subscription_status;
    new.expires_at          := old.expires_at;
    new.seat_limit          := old.seat_limit;
  end if;
  return new;
end;
$$;

-- 3) 결제 승인 후 조직 활성화 함수 ----------------------------------------------
-- 서버(서비스롤)가 토스 승인에 성공한 뒤에만 호출한다.
-- security definer + 트랜잭션 로컬 GUC로 가드 트리거를 안전하게 통과한다.
-- 만료일은 현재 만료일(또는 지금)에서 p_months 개월 연장한다(갱신 시 이어붙임).
create or replace function public.apply_paid_activation(p_org_id uuid, p_months integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.allow_billing_write', 'on', true);
  update public.organizations
     set subscription_status = 'active',
         expires_at = greatest(coalesce(expires_at, now()), now())
                      + make_interval(months => p_months),
         activation_requested_at = null
   where id = p_org_id;
  perform set_config('app.allow_billing_write', 'off', true);
end;
$$;

revoke all on function public.apply_paid_activation(uuid, integer) from public, anon, authenticated;
grant execute on function public.apply_paid_activation(uuid, integer) to service_role;
