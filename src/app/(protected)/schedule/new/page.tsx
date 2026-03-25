import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ScheduleWeekForm } from "@/features/schedule/components/schedule-week-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import { ensureMonday, computeWeekEnd } from "@/utils/date";
import { format, addDays } from "date-fns";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function NewSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const profile = await requireProfile();
  if (profile.role !== "employee") redirect("/schedule");

  const supabase = await createServerSupabaseClient();
  const todayMonday = ensureMonday(new Date());
  const resolvedSearchParams = await searchParams;
  const weekParam = (resolvedSearchParams?.week ?? "").toLowerCase();
  const monday = weekParam === "next" ? addDays(todayMonday, 7) : todayMonday;
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
