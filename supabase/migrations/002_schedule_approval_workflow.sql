alter table public.schedule_days
  add column if not exists approval_status text not null default 'for_approval';

update public.schedule_days
set approval_status = 'for_approval'
where approval_status is null;

alter table public.schedule_days
  drop constraint if exists schedule_days_approval_status_check;

alter table public.schedule_days
  add constraint schedule_days_approval_status_check
  check (approval_status in ('for_approval', 'approved', 'not_approved'));

create index if not exists idx_schedule_days_approval_status
  on public.schedule_days(schedule_id, approval_status);
