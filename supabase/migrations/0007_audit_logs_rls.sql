-- Audit trail and public-safe views
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete set null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text,
  entity_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_org_created on public.audit_logs(organization_id, created_at desc);

alter table public.audit_logs enable row level security;

create policy audit_logs_access
on public.audit_logs
for select
using (
  public.is_goldshore_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = audit_logs.organization_id
      and p.role in ('owner', 'editor', 'viewer')
  )
);

create policy audit_logs_admin_insert
on public.audit_logs
for insert
with check (public.is_goldshore_admin());

create or replace view public.public_domain_health
with (security_invoker = true)
as
select
  d.hostname,
  d.canonical,
  d.platform,
  d.app_or_worker,
  d.updated_at
from public.domains d;

grant select on public.public_domain_health to anon, authenticated;
