-- Time in / Time out logs

create table if not exists public.time_logs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null,
  time_in timestamptz not null,
  time_out timestamptz null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(employee_id, work_date)
);

create trigger handle_time_logs_updated_at
before update on public.time_logs
for each row execute function public.handle_updated_at();

create index if not exists idx_time_logs_employee_date on public.time_logs(employee_id, work_date);
create index if not exists idx_time_logs_date on public.time_logs(work_date);

alter table public.time_logs enable row level security;

create policy "time_logs_select_owner_or_manager"
on public.time_logs for select
using (employee_id = auth.uid() or public.is_manager());

create policy "time_logs_insert_owner"
on public.time_logs for insert
with check (employee_id = auth.uid());

create policy "time_logs_update_owner"
on public.time_logs for update
using (employee_id = auth.uid())
with check (employee_id = auth.uid());

