-- Sites, pages, revisions, and reusable content blocks
create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  primary_domain_id uuid references public.domains(id) on delete set null,
  slug text not null,
  name text not null,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists public.site_pages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  path text not null,
  title text not null,
  status text not null default 'draft',
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, path)
);

create table if not exists public.page_revisions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.site_pages(id) on delete cascade,
  revision_number integer not null,
  content jsonb not null,
  published boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (page_id, revision_number)
);

create table if not exists public.content_blocks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  name text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, key)
);

create index if not exists idx_sites_org on public.sites(organization_id);
create index if not exists idx_site_pages_site on public.site_pages(site_id);
create index if not exists idx_page_revisions_page on public.page_revisions(page_id);
create index if not exists idx_content_blocks_org on public.content_blocks(organization_id);

drop trigger if exists sites_updated_at on public.sites;
create trigger sites_updated_at
before update on public.sites
for each row execute function public.set_updated_at();

drop trigger if exists site_pages_updated_at on public.site_pages;
create trigger site_pages_updated_at
before update on public.site_pages
for each row execute function public.set_updated_at();

drop trigger if exists content_blocks_updated_at on public.content_blocks;
create trigger content_blocks_updated_at
before update on public.content_blocks
for each row execute function public.set_updated_at();

alter table public.sites enable row level security;
alter table public.site_pages enable row level security;
alter table public.page_revisions enable row level security;
alter table public.content_blocks enable row level security;

create policy sites_access_read
on public.sites
for select
using (
  public.is_goldshore_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = sites.organization_id
      and p.role in ('owner', 'editor', 'viewer')
  )
);


create policy sites_access_write
on public.sites
for all
using (
  public.is_goldshore_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = sites.organization_id
      and p.role in ('owner', 'editor')
  )
)
with check (
  public.is_goldshore_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = sites.organization_id
      and p.role in ('owner', 'editor')
  )
);

create policy site_pages_access_read
on public.site_pages
for select
using (
  public.is_goldshore_admin()
  or exists (
    select 1
    from public.sites s
    join public.profiles p on p.organization_id = s.organization_id
    where s.id = site_pages.site_id
      and p.id = auth.uid()
      and p.role in ('owner', 'editor', 'viewer')
  )
);


create policy site_pages_access_write
on public.site_pages
for all
using (
  public.is_goldshore_admin()
  or exists (
    select 1
    from public.sites s
    join public.profiles p on p.organization_id = s.organization_id
    where s.id = site_pages.site_id
      and p.id = auth.uid()
      and p.role in ('owner', 'editor')
  )
)
with check (
  public.is_goldshore_admin()
  or exists (
    select 1
    from public.sites s
    join public.profiles p on p.organization_id = s.organization_id
    where s.id = site_pages.site_id
      and p.id = auth.uid()
      and p.role in ('owner', 'editor')
  )
);

create policy page_revisions_access_read
on public.page_revisions
for select
using (
  public.is_goldshore_admin()
  or exists (
    select 1
    from public.site_pages sp
    join public.sites s on s.id = sp.site_id
    join public.profiles p on p.organization_id = s.organization_id
    where sp.id = page_revisions.page_id
      and p.id = auth.uid()
      and p.role in ('owner', 'editor', 'viewer')
  )
);


create policy page_revisions_access_write
on public.page_revisions
for all
using (
  public.is_goldshore_admin()
  or exists (
    select 1
    from public.site_pages sp
    join public.sites s on s.id = sp.site_id
    join public.profiles p on p.organization_id = s.organization_id
    where sp.id = page_revisions.page_id
      and p.id = auth.uid()
      and p.role in ('owner', 'editor')
  )
)
with check (
  public.is_goldshore_admin()
  or exists (
    select 1
    from public.site_pages sp
    join public.sites s on s.id = sp.site_id
    join public.profiles p on p.organization_id = s.organization_id
    where sp.id = page_revisions.page_id
      and p.id = auth.uid()
      and p.role in ('owner', 'editor')
  )
);

create policy content_blocks_access_read
on public.content_blocks
for select
using (
  public.is_goldshore_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = content_blocks.organization_id
      and p.role in ('owner', 'editor', 'viewer')
  )
);


create policy content_blocks_access_write
on public.content_blocks
for all
using (
  public.is_goldshore_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = content_blocks.organization_id
      and p.role in ('owner', 'editor')
  )
)
with check (
  public.is_goldshore_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = content_blocks.organization_id
      and p.role in ('owner', 'editor')
  )
);
