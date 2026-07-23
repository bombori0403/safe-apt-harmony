-- 업체별·단지별 사용량 집계 (플랫폼 관리자용) — Supabase SQL Editor에서 실행. (자동번역 OFF)
-- 건수는 FK로 정확히 집계. 저장용량은 사진 경로로 매핑 가능한 범위만:
--   · 평가사진(assessment-photos): 경로 {평가ID}/... → 단지·업체로 매핑
--   · 아차사고사진(near-miss-photos): 경로 {사용자ID}/... → 업체까지만 매핑
--   · 작업중지사진(work-stop/...): 경로에 식별자가 없어 개별 매핑 불가(전체 합계에만 포함)
-- DB 용량(pg_database_size)은 DB 전체 단일 수치라 업체별로 나눌 수 없다(get_platform_usage의 총량 참고).

create or replace function public.get_usage_breakdown()
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_result jsonb;
  v_uuid_re text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/';
begin
  with ap as (
    select (split_part(name, '/', 1))::uuid as assessment_id,
           sum((metadata->>'size')::bigint) as bytes, count(*) as cnt
    from storage.objects
    where bucket_id = 'assessment-photos' and name ~ v_uuid_re
    group by 1
  ),
  ap_cx as (
    select a.complex_id, sum(ap.bytes) as bytes, sum(ap.cnt) as cnt
    from ap join public.assessments a on a.id = ap.assessment_id
    group by 1
  ),
  ap_org as (
    select a.organization_id, sum(ap.bytes) as bytes, sum(ap.cnt) as cnt
    from ap join public.assessments a on a.id = ap.assessment_id
    group by 1
  ),
  nmp_org as (
    select u.organization_id, sum(o.bytes) as bytes, sum(o.cnt) as cnt
    from (
      select (split_part(name, '/', 1))::uuid as auth_user,
             sum((metadata->>'size')::bigint) as bytes, count(*) as cnt
      from storage.objects
      where bucket_id = 'near-miss-photos' and name ~ v_uuid_re
      group by 1
    ) o join public.users u on u.auth_id = o.auth_user
    group by 1
  ),
  orgs_j as (
    select jsonb_agg(row_to_json(t)) as j from (
      select
        org.id, org.name, org.subscription_status,
        (select count(*) from public.complexes c where c.organization_id = org.id) as complexes,
        (select count(*) from public.assessments a where a.organization_id = org.id) as assessments,
        (select count(*) from public.hazards h join public.assessments a on a.id = h.assessment_id where a.organization_id = org.id) as hazards,
        (select count(*) from public.near_miss n where n.organization_id = org.id) as near_miss,
        (select count(*) from public.users u where u.organization_id = org.id) as users,
        coalesce((select bytes from ap_org where organization_id = org.id), 0)
          + coalesce((select bytes from nmp_org where organization_id = org.id), 0) as storage_bytes
      from public.organizations org
      order by org.name
    ) t
  ),
  cx_j as (
    select jsonb_agg(row_to_json(t)) as j from (
      select
        c.id, c.name, c.organization_id as org_id, org.name as org_name, c.household_count,
        (select count(*) from public.assessments a where a.complex_id = c.id) as assessments,
        (select count(*) from public.hazards h join public.assessments a on a.id = h.assessment_id where a.complex_id = c.id) as hazards,
        (select count(*) from public.near_miss n where n.complex_id = c.id) as near_miss,
        coalesce((select bytes from ap_cx where complex_id = c.id), 0) as storage_bytes
      from public.complexes c
      left join public.organizations org on org.id = c.organization_id
      order by org.name, c.name
    ) t
  )
  select jsonb_build_object(
    'orgs', coalesce((select j from orgs_j), '[]'::jsonb),
    'complexes', coalesce((select j from cx_j), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_usage_breakdown() from public, anon, authenticated;
grant execute on function public.get_usage_breakdown() to service_role;
