-- Tag a session end as either a break or an end-of-day timeout.

alter table public.time_log_sessions
add column if not exists end_reason text null check (end_reason in ('break','day_end'));

-- Backfill any existing completed sessions to day_end so we default to the safest behavior.
update public.time_log_sessions
set end_reason = 'day_end'
where time_out is not null and end_reason is null;

create index if not exists idx_time_log_sessions_end_reason
on public.time_log_sessions(employee_id, work_date, end_reason);

