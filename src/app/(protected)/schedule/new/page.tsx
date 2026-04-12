import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ScheduleWeekForm } from "@/features/schedule/components/schedule-week-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import { ensureMonday, computeWeekEnd } from "@/utils/date";
import { format, addDays, isSunday, isMonday } from "date-fns";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function NewSchedulePage({
  searchParams,
}: {
  searchParams?: { week?: string };
}) {
  const profile = await requireProfile();
  if (profile.role !== "employee") redirect("/schedule");

  const supabase = await createServerSupabaseClient();

  const now = new Date();
  const canCreate = isSunday(now) || isMonday(now);
  if (!canCreate) {
    redirect("/schedule?locked=create-window");
  }

  const todayMonday = ensureMonday(now);
  const nextMonday = addDays(todayMonday, 7);
  const weekParam = (searchParams?.week ?? "").toLowerCase();

  // Check if there is an existing schedule for the current week
  const { data: currentWeek } = await supabase
    .from("schedules")
    .select("id, week_start, week_end, status, schedule_days(*)")
    .eq("employee_id", profile.id)
    .eq("week_start", format(todayMonday, "yyyy-MM-dd"))
    .maybeSingle();

  // Default to next week when:
  // - user explicitly requests ?week=next
  // - today is Sunday (let employees plan ahead)
  // - current week's schedule is already submitted
  const monday =
    weekParam === "next" || isSunday(now) || currentWeek?.status === "submitted"
      ? nextMonday
      : todayMonday;

  const weekStart = format(monday, "yyyy-MM-dd");
  const weekEnd = format(computeWeekEnd(monday), "yyyy-MM-dd");

  const { data: existing } = await supabase
    .from("schedules")
    .select("id, week_start, week_end, status, schedule_days(*)")
    .eq("employee_id", profile.id)
    .eq("week_start", weekStart)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <PageHeader
        title="New weekly schedule"
        description="Save as draft first, then submit when ready."
        userId={profile.id}
      />
      <div className="card">
        <ScheduleWeekForm
          initialData={
            existing
              ? {
                  id: existing.id,
                  week_start: existing.week_start,
                  week_end: existing.week_end,
                  status: existing.status,
                  days: existing.schedule_days ?? undefined,
                }
              : { week_start: weekStart, week_end: weekEnd }
          }
        />
      </div>
    </div>
  );
}
