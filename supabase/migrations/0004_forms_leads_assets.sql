-- Forms, submissions, normalized leads, and media assets
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  storage_provider text not null default 'supabase-storage',
  storage_key text not null,
  mime_type text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.forms (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  name text not null,
  slug text not null,
  schema jsonb not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, slug)
);

create table if not exists public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  payload jsonb not null,
  source_ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  form_submission_id uuid references public.form_submissions(id) on delete set null,
  email text,
  phone text,
  full_name text,
  status text not null default 'new',
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_assets_org on public.assets(organization_id);
create index if not exists idx_forms_site on public.forms(site_id);
create index if not exists idx_form_submissions_form on public.form_submissions(form_id);
create index if not exists idx_leads_org on public.leads(organization_id);

drop trigger if exists assets_updated_at on public.assets;
create trigger assets_updated_at
before update on public.assets
for each row execute function public.set_updated_at();

drop trigger if exists forms_updated_at on public.forms;
create trigger forms_updated_at
before update on public.forms
for each row execute function public.set_updated_at();

drop trigger if exists leads_updated_at on public.leads;
create trigger leads_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

alter table public.assets enable row level security;
alter table public.forms enable row level security;
alter table public.form_submissions enable row level security;
alter table public.leads enable row level security;

create policy assets_access_read
on public.assets
for select
using (
  public.is_goldshore_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = assets.organization_id
      and p.role in ('owner', 'editor', 'viewer')
  )
);


create policy assets_access_write
on public.assets
for all
using (
  public.is_goldshore_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = assets.organization_id
      and p.role in ('owner', 'editor')
  )
)
with check (
  public.is_goldshore_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = assets.organization_id
      and p.role in ('owner', 'editor')
  )
);

create policy forms_access_read
on public.forms
for select
using (
  public.is_goldshore_admin()
  or exists (
    select 1
    from public.sites s
    join public.profiles p on p.organization_id = s.organization_id
    where s.id = forms.site_id
      and p.id = auth.uid()
      and p.role in ('owner', 'editor', 'viewer')
  )
);


create policy forms_access_write
on public.forms
for all
using (
  public.is_goldshore_admin()
  or exists (
    select 1
    from public.sites s
    join public.profiles p on p.organization_id = s.organization_id
    where s.id = forms.site_id
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
    where s.id = forms.site_id
      and p.id = auth.uid()
      and p.role in ('owner', 'editor')
  )
);

create policy form_submissions_insert
on public.form_submissions
for insert
with check (
  exists (
    select 1
    from public.forms f
    where f.id = form_submissions.form_id
      and f.site_id = form_submissions.site_id
      and f.status = 'active'
  )
);

create policy form_submissions_org_read
on public.form_submissions
for select
using (
  public.is_goldshore_admin()
  or exists (
    select 1
    from public.sites s
    join public.profiles p on p.organization_id = s.organization_id
    where s.id = form_submissions.site_id
      and p.id = auth.uid()
      and p.role in ('owner', 'editor', 'viewer')
  )
);

create policy leads_access_read
on public.leads
for select
using (
  public.is_goldshore_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = leads.organization_id
      and p.role in ('owner', 'editor', 'viewer')
  )
);


create policy leads_access_write
on public.leads
for all
using (
  public.is_goldshore_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = leads.organization_id
      and p.role in ('owner', 'editor')
  )
)
with check (
  public.is_goldshore_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = leads.organization_id
      and p.role in ('owner', 'editor')
  )
);
