-- Break-capable time record sessions (multiple work sessions per day).
-- Keeps `time_logs` table intact for backward compatibility, but the app should use `time_log_sessions`.

create table if not exists public.time_log_sessions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null,
  time_in timestamptz not null,
  time_out timestamptz null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger handle_time_log_sessions_updated_at
before update on public.time_log_sessions
for each row execute function public.handle_updated_at();

-- Only one open session per employee/day.
create unique index if not exists uniq_time_log_sessions_open
on public.time_log_sessions(employee_id, work_date)
where time_out is null;

create index if not exists idx_time_log_sessions_employee_date
on public.time_log_sessions(employee_id, work_date, time_in);

alter table public.time_log_sessions enable row level security;

create policy "time_log_sessions_select_owner_or_manager"
on public.time_log_sessions for select
using (employee_id = auth.uid() or public.is_manager());

create policy "time_log_sessions_insert_owner"
on public.time_log_sessions for insert
with check (employee_id = auth.uid());

create policy "time_log_sessions_update_owner"
on public.time_log_sessions for update
using (employee_id = auth.uid())
with check (employee_id = auth.uid());

-- One-time backfill from legacy `time_logs` if present.
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'time_logs'
  ) then
    insert into public.time_log_sessions(employee_id, work_date, time_in, time_out)
    select tl.employee_id, tl.work_date, tl.time_in, tl.time_out
    from public.time_logs tl
    where not exists (
      select 1
      from public.time_log_sessions s
      where s.employee_id = tl.employee_id and s.work_date = tl.work_date
    );
  end if;
end $$;

