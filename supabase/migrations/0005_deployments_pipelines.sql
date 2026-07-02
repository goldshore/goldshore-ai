-- Deployments, checks, pipeline definitions, and run history
create table if not exists public.deployments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  environment text not null default 'production',
  provider text not null,
  commit_sha text,
  status text not null,
  deployed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deployment_checks (
  id uuid primary key default gen_random_uuid(),
  deployment_id uuid not null references public.deployments(id) on delete cascade,
  check_type text not null,
  status text not null,
  details jsonb,
  checked_at timestamptz not null default now()
);

create table if not exists public.pipelines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.pipelines(id) on delete cascade,
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  context jsonb
);

create table if not exists public.pipeline_steps (
  id uuid primary key default gen_random_uuid(),
  pipeline_run_id uuid not null references public.pipeline_runs(id) on delete cascade,
  step_name text not null,
  status text not null,
  output jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists idx_deployments_org on public.deployments(organization_id);
create index if not exists idx_deployment_checks_deployment on public.deployment_checks(deployment_id);
create index if not exists idx_pipelines_org on public.pipelines(organization_id);
create index if not exists idx_pipeline_runs_pipeline on public.pipeline_runs(pipeline_id);
create index if not exists idx_pipeline_steps_run on public.pipeline_steps(pipeline_run_id);

drop trigger if exists deployments_updated_at on public.deployments;
create trigger deployments_updated_at
before update on public.deployments
for each row execute function public.set_updated_at();

drop trigger if exists pipelines_updated_at on public.pipelines;
create trigger pipelines_updated_at
before update on public.pipelines
for each row execute function public.set_updated_at();

alter table public.deployments enable row level security;
alter table public.deployment_checks enable row level security;
alter table public.pipelines enable row level security;
alter table public.pipeline_runs enable row level security;
alter table public.pipeline_steps enable row level security;

create policy deployments_access_read
on public.deployments
for select
using (
  private.is_goldshore_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = deployments.organization_id
      and p.role in ('owner', 'editor', 'viewer')
  )
);

create policy deployments_access_write
on public.deployments
for all
using (
  private.is_goldshore_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = deployments.organization_id
      and p.role in ('owner', 'editor')
  )
)
with check (
  private.is_goldshore_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = deployments.organization_id
      and p.role in ('owner', 'editor')
  )
);

create policy deployment_checks_access_read
on public.deployment_checks
for select
using (
  private.is_goldshore_admin()
  or exists (
    select 1
    from public.deployments d
    join public.profiles p on p.organization_id = d.organization_id
    where d.id = deployment_checks.deployment_id
      and p.id = auth.uid()
      and p.role in ('owner', 'editor', 'viewer')
  )
);

create policy deployment_checks_access_write
on public.deployment_checks
for all
using (
  private.is_goldshore_admin()
  or exists (
    select 1
    from public.deployments d
    join public.profiles p on p.organization_id = d.organization_id
    where d.id = deployment_checks.deployment_id
      and p.id = auth.uid()
      and p.role in ('owner', 'editor')
  )
)
with check (
  private.is_goldshore_admin()
  or exists (
    select 1
    from public.deployments d
    join public.profiles p on p.organization_id = d.organization_id
    where d.id = deployment_checks.deployment_id
      and p.id = auth.uid()
      and p.role in ('owner', 'editor')
  )
);

create policy pipelines_access_read
on public.pipelines
for select
using (
  private.is_goldshore_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = pipelines.organization_id
      and p.role in ('owner', 'editor', 'viewer')
  )
);

create policy pipelines_access_write
on public.pipelines
for all
using (
  private.is_goldshore_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = pipelines.organization_id
      and p.role in ('owner', 'editor')
  )
)
with check (
  private.is_goldshore_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = pipelines.organization_id
      and p.role in ('owner', 'editor')
  )
);

create policy pipeline_runs_access_read
on public.pipeline_runs
for select
using (
  private.is_goldshore_admin()
  or exists (
    select 1
    from public.pipelines pl
    join public.profiles p on p.organization_id = pl.organization_id
    where pl.id = pipeline_runs.pipeline_id
      and p.id = auth.uid()
      and p.role in ('owner', 'editor', 'viewer')
  )
);

create policy pipeline_runs_access_write
on public.pipeline_runs
for all
using (
  private.is_goldshore_admin()
  or exists (
    select 1
    from public.pipelines pl
    join public.profiles p on p.organization_id = pl.organization_id
    where pl.id = pipeline_runs.pipeline_id
      and p.id = auth.uid()
      and p.role in ('owner', 'editor')
  )
)
with check (
  private.is_goldshore_admin()
  or exists (
    select 1
    from public.pipelines pl
    join public.profiles p on p.organization_id = pl.organization_id
    where pl.id = pipeline_runs.pipeline_id
      and p.id = auth.uid()
      and p.role in ('owner', 'editor')
  )
);

create policy pipeline_steps_access_read
on public.pipeline_steps
for select
using (
  private.is_goldshore_admin()
  or exists (
    select 1
    from public.pipeline_runs pr
    join public.pipelines pl on pl.id = pr.pipeline_id
    join public.profiles p on p.organization_id = pl.organization_id
    where pr.id = pipeline_steps.pipeline_run_id
      and p.id = auth.uid()
      and p.role in ('owner', 'editor', 'viewer')
  )
);

create policy pipeline_steps_access_write
on public.pipeline_steps
for all
using (
  private.is_goldshore_admin()
  or exists (
    select 1
    from public.pipeline_runs pr
    join public.pipelines pl on pl.id = pr.pipeline_id
    join public.profiles p on p.organization_id = pl.organization_id
    where pr.id = pipeline_steps.pipeline_run_id
      and p.id = auth.uid()
      and p.role in ('owner', 'editor')
  )
)
with check (
  private.is_goldshore_admin()
  or exists (
    select 1
    from public.pipeline_runs pr
    join public.pipelines pl on pl.id = pr.pipeline_id
    join public.profiles p on p.organization_id = pl.organization_id
    where pr.id = pipeline_steps.pipeline_run_id
      and p.id = auth.uid()
      and p.role in ('owner', 'editor')
  )
);
