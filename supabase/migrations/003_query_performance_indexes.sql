-- Performance indexes for fast list-page loading on feature clicks.
-- These match common filters/orders used by schedule, dtr, employees, and notifications pages.

create index if not exists idx_profiles_created_at_desc
  on public.profiles (created_at desc);

create index if not exists idx_schedules_week_start_desc
  on public.schedules (week_start desc);

create index if not exists idx_schedules_status_week_start_desc
  on public.schedules (status, week_start desc);

create index if not exists idx_schedules_employee_status_week_start_desc
  on public.schedules (employee_id, status, week_start desc);

create index if not exists idx_schedules_updated_at_desc
  on public.schedules (updated_at desc);

create index if not exists idx_dtr_work_date_desc
  on public.dtr_entries (work_date desc);

create index if not exists idx_dtr_status_work_date_desc
  on public.dtr_entries (status, work_date desc);

create index if not exists idx_dtr_employee_status_work_date_desc
  on public.dtr_entries (employee_id, status, work_date desc);

create index if not exists idx_dtr_updated_at_desc
  on public.dtr_entries (updated_at desc);

create index if not exists idx_notifications_user_created_at_desc
  on public.notifications (user_id, created_at desc);
