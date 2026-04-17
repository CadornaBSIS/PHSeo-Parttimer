-- Ensure only 1 DTR exists per employee per work date.
-- This prevents accidental duplicates (e.g., double submit / race conditions).

-- 1) Deduplicate existing rows (keep: submitted > draft, newest updated/created).
with ranked as (
  select
    id,
    employee_id,
    work_date,
    row_number() over (
      partition by employee_id, work_date
      order by
        (status = 'submitted') desc,
        updated_at desc nulls last,
        created_at desc nulls last,
        id desc
    ) as rn,
    first_value(id) over (
      partition by employee_id, work_date
      order by
        (status = 'submitted') desc,
        updated_at desc nulls last,
        created_at desc nulls last,
        id desc
    ) as keep_id
  from public.dtr_entries
),
dupes as (
  select id, keep_id from ranked where rn > 1
)
update public.notifications n
set link = '/dtr/' || d.keep_id::text
from dupes d
where n.link = '/dtr/' || d.id::text;

with ranked as (
  select
    id,
    employee_id,
    work_date,
    row_number() over (
      partition by employee_id, work_date
      order by
        (status = 'submitted') desc,
        updated_at desc nulls last,
        created_at desc nulls last,
        id desc
    ) as rn,
    first_value(id) over (
      partition by employee_id, work_date
      order by
        (status = 'submitted') desc,
        updated_at desc nulls last,
        created_at desc nulls last,
        id desc
    ) as keep_id
  from public.dtr_entries
),
dupes as (
  select id, keep_id from ranked where rn > 1
)
update public.audit_logs a
set target_id = d.keep_id
from dupes d
where a.target_type = 'dtr_entry'
  and a.target_id = d.id;

with ranked as (
  select
    id,
    employee_id,
    work_date,
    row_number() over (
      partition by employee_id, work_date
      order by
        (status = 'submitted') desc,
        updated_at desc nulls last,
        created_at desc nulls last,
        id desc
    ) as rn
  from public.dtr_entries
)
delete from public.dtr_entries e
using ranked r
where e.id = r.id
  and r.rn > 1;

-- 2) Enforce uniqueness going forward.
create unique index if not exists idx_dtr_entries_employee_work_date_unique
  on public.dtr_entries (employee_id, work_date);

