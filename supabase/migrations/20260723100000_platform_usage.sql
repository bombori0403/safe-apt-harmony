-- 플랫폼 관리자용 Supabase 실사용량 조회 함수
-- ⚠️ Supabase SQL Editor에서 실행하세요. (크롬 자동번역 OFF)
-- DB 용량 + 스토리지(사진) 용량 + 주요 카운트를 한 번에 반환한다.
-- 대역폭(전송량)은 SQL로 얻을 수 없어 Supabase 대시보드에서 확인해야 한다.

create or replace function public.get_platform_usage()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_db bigint;
  v_storage bigint;
  v_photos bigint;
  v_assessments bigint;
  v_orgs bigint;
  v_users bigint;
begin
  select pg_database_size(current_database()) into v_db;
  select coalesce(sum((metadata->>'size')::bigint), 0) into v_storage from storage.objects;
  select count(*) into v_photos from storage.objects;
  select count(*) into v_assessments from public.assessments;
  select count(*) into v_orgs from public.organizations;
  select count(*) into v_users from public.users;
  return jsonb_build_object(
    'db_bytes', v_db,
    'storage_bytes', v_storage,
    'photo_count', v_photos,
    'assessments', v_assessments,
    'organizations', v_orgs,
    'users', v_users
  );
end;
$$;

revoke all on function public.get_platform_usage() from public, anon, authenticated;
grant execute on function public.get_platform_usage() to service_role;
