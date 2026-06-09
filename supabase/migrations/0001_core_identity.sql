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

create or replace function public.is_goldshore_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

create policy organizations_admin_all
on public.organizations
for all
using (public.is_goldshore_admin())
with check (public.is_goldshore_admin());

create policy organizations_member_read
on public.organizations
for select
using (
  public.is_goldshore_admin()
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
using (public.is_goldshore_admin())
with check (public.is_goldshore_admin());

create policy profiles_self_read
on public.profiles
for select
using (id = auth.uid());

create policy profiles_self_update
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());
