-- API client trust records and third-party integrations
create table if not exists public.api_clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id text not null,
  display_name text not null,
  allowed_origins text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, client_id)
);

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  api_client_id uuid not null references public.api_clients(id) on delete cascade,
  key_prefix text not null,
  key_hash text not null,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- Prevent hashed API key material from being readable by client roles.
revoke select (key_hash) on public.api_keys from anon, authenticated;

create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  name text not null,
  config jsonb not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.webhooks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  endpoint text not null,
  secret_hash text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Prevent webhook secret material from being readable by client roles.
revoke select (secret_hash) on public.webhooks from anon, authenticated;

create index if not exists idx_api_clients_org on public.api_clients(organization_id);
create index if not exists idx_api_keys_client on public.api_keys(api_client_id);
create index if not exists idx_integrations_org on public.integrations(organization_id);
create index if not exists idx_webhooks_org on public.webhooks(organization_id);

drop trigger if exists api_clients_updated_at on public.api_clients;
create trigger api_clients_updated_at
before update on public.api_clients
for each row execute function public.set_updated_at();

drop trigger if exists integrations_updated_at on public.integrations;
create trigger integrations_updated_at
before update on public.integrations
for each row execute function public.set_updated_at();

drop trigger if exists webhooks_updated_at on public.webhooks;
create trigger webhooks_updated_at
before update on public.webhooks
for each row execute function public.set_updated_at();

alter table public.api_clients enable row level security;
alter table public.api_keys enable row level security;
alter table public.integrations enable row level security;
alter table public.webhooks enable row level security;

create policy api_clients_access
on public.api_clients
for all
using (
  public.is_goldshore_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = api_clients.organization_id
      and p.role in ('owner', 'editor', 'viewer')
  )
)
with check (
  public.is_goldshore_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = api_clients.organization_id
      and p.role in ('owner', 'editor')
  )
);

create policy api_keys_access
on public.api_keys
for all
using (
  public.is_goldshore_admin()
  or exists (
    select 1
    from public.api_clients ac
    join public.profiles p on p.organization_id = ac.organization_id
    where ac.id = api_keys.api_client_id
      and p.id = auth.uid()
      and p.role in ('owner', 'editor', 'viewer')
  )
)
with check (
  public.is_goldshore_admin()
  or exists (
    select 1
    from public.api_clients ac
    join public.profiles p on p.organization_id = ac.organization_id
    where ac.id = api_keys.api_client_id
      and p.id = auth.uid()
      and p.role in ('owner', 'editor')
  )
);

create policy integrations_access
on public.integrations
for all
using (
  public.is_goldshore_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = integrations.organization_id
      and p.role in ('owner', 'editor', 'viewer')
  )
)
with check (
  public.is_goldshore_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = integrations.organization_id
      and p.role in ('owner', 'editor')
  )
);

create policy webhooks_access
on public.webhooks
for all
using (
  public.is_goldshore_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = webhooks.organization_id
      and p.role in ('owner', 'editor', 'viewer')
  )
)
with check (
  public.is_goldshore_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = webhooks.organization_id
      and p.role in ('owner', 'editor')
  )
);
