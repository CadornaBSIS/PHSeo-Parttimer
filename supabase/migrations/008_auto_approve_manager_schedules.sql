-- Auto-approve manager-owned schedules (backfill).
-- If the schedule is owned by a manager, schedule_days should never stay "for_approval".

update public.schedule_days sd
set approval_status = 'approved'
from public.schedules s
join public.profiles p on p.id = s.employee_id
where sd.schedule_id = s.id
  and p.role = 'manager'
  and sd.approval_status = 'for_approval';

