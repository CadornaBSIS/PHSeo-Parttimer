-- Core schema for ViteSeo Parttimer
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- helper updated_at trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- role helper functions
create or replace function public.is_manager()
returns boolean as $$
  select exists(
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager'
  );
$$ language sql security definer;

create or replace function public.is_employee()
returns boolean as $$
  select exists(
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'employee'
  );
$$ language sql security definer;

create or replace function public.owns_schedule(target uuid)
returns boolean as $$
  select exists(
    select 1 from public.schedules s where s.id = target and s.employee_id = auth.uid()
  );
$$ language sql security definer;

create or replace function public.owns_dtr(target uuid)
returns boolean as $$
  select exists(
    select 1 from public.dtr_entries d where d.id = target and d.employee_id = auth.uid()
  );
$$ language sql security definer;

-- tables
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text unique not null,
  role text not null check (role in ('manager','employee')),
  department text null,
  employee_code text null,
  status text not null default 'active',
  avatar_url text null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create trigger handle_profiles_updated_at
before update on public.profiles
for each row execute function public.handle_updated_at();

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text null,
  description text null,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create trigger handle_projects_updated_at
before update on public.projects
for each row execute function public.handle_updated_at();

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  status text not null check (status in ('draft','submitted')),
  submitted_at timestamptz null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(employee_id, week_start)
);
create trigger handle_schedules_updated_at
before update on public.schedules
for each row execute function public.handle_updated_at();

create table if not exists public.schedule_days (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 1 and 7),
  work_date date not null,
  work_status text not null check (work_status in ('working','day_off','leave','holiday','requested')),
  start_time time null,
  end_time time null,
  notes text null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(schedule_id, day_of_week)
);
create trigger handle_schedule_days_updated_at
before update on public.schedule_days
for each row execute function public.handle_updated_at();

create table if not exists public.dtr_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  work_date date not null,
  start_time time null,
  end_time time null,
  project_id uuid null references public.projects(id),
  project_account text null,
  notes text null,
  image_link text null,
  duration_minutes integer not null default 0,
  status text not null check (status in ('draft','submitted')),
  submitted_at timestamptz null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create trigger handle_dtr_entries_updated_at
before update on public.dtr_entries
for each row execute function public.handle_updated_at();

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  is_read boolean default false,
  link text null,
  created_at timestamptz default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid null references public.profiles(id),
  action text not null,
  target_type text not null,
  target_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

-- indexes
create index if not exists idx_schedules_employee_week on public.schedules(employee_id, week_start);
create index if not exists idx_schedules_status on public.schedules(status);
create index if not exists idx_schedule_days_date on public.schedule_days(schedule_id, work_date);
create index if not exists idx_dtr_employee_week on public.dtr_entries(employee_id, week_start);
create index if not exists idx_dtr_work_date on public.dtr_entries(work_date);
create index if not exists idx_dtr_status on public.dtr_entries(status);
create index if not exists idx_notifications_user on public.notifications(user_id, is_read);
create index if not exists idx_audit_logs_actor on public.audit_logs(actor_id, created_at desc);

-- RLS
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.schedules enable row level security;
alter table public.schedule_days enable row level security;
alter table public.dtr_entries enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- profiles policies
create policy "profiles_select_self_or_manager"
on public.profiles for select
using (id = auth.uid() or public.is_manager());

create policy "profiles_update_self"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "profiles_manager_manage"
on public.profiles for all
using (public.is_manager());

create policy "profiles_insert_manager"
on public.profiles for insert
with check (public.is_manager());

-- projects policies
create policy "projects_select_active"
on public.projects for select
using (public.is_manager() or is_active = true);

create policy "projects_manager_manage"
on public.projects for all
using (public.is_manager());

-- schedules policies
create policy "schedules_select_owner_or_manager"
on public.schedules for select
using (employee_id = auth.uid() or public.is_manager());

create policy "schedules_insert_owner"
on public.schedules for insert
with check (employee_id = auth.uid() or public.is_manager());

create policy "schedules_update_draft_owner"
on public.schedules for update
using (employee_id = auth.uid() and status = 'draft')
with check (employee_id = auth.uid());

create policy "schedules_manager_all"
on public.schedules for all
using (public.is_manager());

-- schedule_days policies
create policy "schedule_days_select"
on public.schedule_days for select
using (
  public.is_manager() or
  exists(select 1 from public.schedules s where s.id = schedule_id and s.employee_id = auth.uid())
);

create policy "schedule_days_modify_draft"
on public.schedule_days for all
using (
  exists(
    select 1 from public.schedules s
    where s.id = schedule_id
      and s.employee_id = auth.uid()
      and s.status = 'draft'
  ) or public.is_manager()
);

-- dtr_entries policies
create policy "dtr_select_owner_or_manager"
on public.dtr_entries for select
using (employee_id = auth.uid() or public.is_manager());

create policy "dtr_insert_owner"
on public.dtr_entries for insert
with check (employee_id = auth.uid() or public.is_manager());

create policy "dtr_update_draft_owner"
on public.dtr_entries for update
using (employee_id = auth.uid() and status = 'draft')
with check (employee_id = auth.uid());

create policy "dtr_manager_all"
on public.dtr_entries for all
using (public.is_manager());

-- notifications policies
create policy "notifications_select_own"
on public.notifications for select
using (user_id = auth.uid());

create policy "notifications_insert_manager_or_self"
on public.notifications for insert
with check (public.is_manager() or user_id = auth.uid());

create policy "notifications_update_own"
on public.notifications for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- audit_logs policies
create policy "audit_logs_select_manager"
on public.audit_logs for select
using (public.is_manager());

create policy "audit_logs_insert_any"
on public.audit_logs for insert
with check (true);

-- ensure default privileges
grant usage on schema public to authenticated;
grant usage on schema public to service_role;
