-- Core identity and organization model
create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  is_goldshore boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  role text not null check (role in ('admin', 'owner', 'editor', 'viewer')),
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists organizations_updated_at on public.organizations;
create trigger organizations_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.is_goldshore_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  );
$$;

revoke all on function private.is_goldshore_admin() from public;
grant execute on function private.is_goldshore_admin() to anon, authenticated;

create or replace function private.can_update_own_profile(
  target_id uuid,
  target_organization_id uuid,
  target_role text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      where p.id = target_id
        and p.organization_id is not distinct from target_organization_id
        and p.role = target_role
    );
$$;

revoke all on function private.can_update_own_profile(uuid, uuid, text) from public;
grant execute on function private.can_update_own_profile(uuid, uuid, text) to authenticated;

create policy organizations_admin_all
on public.organizations
for all
using (private.is_goldshore_admin())
with check (private.is_goldshore_admin());

create policy organizations_member_read
on public.organizations
for select
using (
  private.is_goldshore_admin()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = organizations.id
  )
);

create policy profiles_admin_all
on public.profiles
for all
using (private.is_goldshore_admin())
with check (private.is_goldshore_admin());

create policy profiles_self_read
on public.profiles
for select
using (id = auth.uid());

create policy profiles_self_update
on public.profiles
for update
using (id = auth.uid())
with check (private.can_update_own_profile(id, organization_id, role));
