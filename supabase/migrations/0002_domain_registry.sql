-- Domain inventory and DNS target state
create table if not exists public.domains (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hostname text unique not null,
  role text not null,
  canonical boolean not null default false,
  repo text,
  app_or_worker text,
  platform text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dns_records (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid not null references public.domains(id) on delete cascade,
  record_type text not null,
  name text not null,
  value text not null,
  proxied boolean,
  ttl integer,
  expected_owner text,
  observed_owner text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_domains_org on public.domains(organization_id);
create index if not exists idx_dns_records_domain on public.dns_records(domain_id);

drop trigger if exists domains_updated_at on public.domains;
create trigger domains_updated_at
before update on public.domains
for each row execute function public.set_updated_at();

drop trigger if exists dns_records_updated_at on public.dns_records;
create trigger dns_records_updated_at
before update on public.dns_records
for each row execute function public.set_updated_at();

alter table public.domains enable row level security;
alter table public.dns_records enable row level security;

create policy domains_admin_all
on public.domains
for all
using (public.is_goldshore_admin())
with check (public.is_goldshore_admin());

create policy domains_org_read
on public.domains
for select
using (
  public.is_goldshore_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = domains.organization_id
  )
);

create policy domains_org_write
on public.domains
for all
using (
  public.is_goldshore_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = domains.organization_id
      and p.role in ('owner', 'editor')
  )
)
with check (
  public.is_goldshore_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = domains.organization_id
      and p.role in ('owner', 'editor')
  )
);

create policy dns_records_admin_all
on public.dns_records
for all
using (public.is_goldshore_admin())
with check (public.is_goldshore_admin());

create policy dns_records_org_access_read
on public.dns_records
for select
using (
  public.is_goldshore_admin()
  or exists (
    select 1
    from public.domains d
    join public.profiles p on p.organization_id = d.organization_id
    where p.id = auth.uid()
      and d.id = dns_records.domain_id
      and p.role in ('owner', 'editor', 'viewer')
  )
);


create policy dns_records_org_access_write
on public.dns_records
for all
using (
  public.is_goldshore_admin()
  or exists (
    select 1
    from public.domains d
    join public.profiles p on p.organization_id = d.organization_id
    where p.id = auth.uid()
      and d.id = dns_records.domain_id
      and p.role in ('owner', 'editor')
  )
)
with check (
  public.is_goldshore_admin()
  or exists (
    select 1
    from public.domains d
    join public.profiles p on p.organization_id = d.organization_id
    where p.id = auth.uid()
      and d.id = dns_records.domain_id
      and p.role in ('owner', 'editor')
  )
);
