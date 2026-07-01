
create table public.regulation_content (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  overrides jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

grant select, insert, update, delete on public.regulation_content to authenticated;
grant all on public.regulation_content to service_role;

alter table public.regulation_content enable row level security;

create policy "org members can read regulation"
on public.regulation_content for select
to authenticated
using (
  organization_id in (
    select u.organization_id from public.users u where u.auth_id = auth.uid()
  )
);

create policy "org admins can upsert regulation"
on public.regulation_content for insert
to authenticated
with check (
  organization_id in (
    select u.organization_id from public.users u
    where u.auth_id = auth.uid() and u.org_role = 'admin'
  )
);

create policy "org admins can update regulation"
on public.regulation_content for update
to authenticated
using (
  organization_id in (
    select u.organization_id from public.users u
    where u.auth_id = auth.uid() and u.org_role = 'admin'
  )
)
with check (
  organization_id in (
    select u.organization_id from public.users u
    where u.auth_id = auth.uid() and u.org_role = 'admin'
  )
);
