import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarPlus, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import { ScheduleTable } from "@/features/schedule/components/schedule-table";
import { DtrTable } from "@/features/dtr/components/dtr-table";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ManagerRecordsPage() {
  const profile = await requireProfile();
  if (profile.role !== "manager") redirect("/dashboard");

  const supabase = await createServerSupabaseClient();

  const { data: schedules } = await supabase
    .from("schedules")
    .select(
      "id, employee_id, week_start, week_end, status, submitted_at, profiles(full_name), schedule_days(approval_status)",
    )
    .eq("employee_id", profile.id)
    .order("week_start", { ascending: false })
    .limit(25);

  const { data: dtrs } = await supabase
    .from("dtr_entries")
    .select("id, work_date, status, duration_minutes, project_account, profiles(full_name)")
    .eq("employee_id", profile.id)
    .order("work_date", { ascending: false })
    .limit(50);

  const scheduleRows =
    schedules?.map((item) => ({
      ...item,
      profiles: Array.isArray(item.profiles) ? item.profiles[0] ?? undefined : item.profiles,
    })) ?? [];

  const dtrRows =
    dtrs?.map((item) => ({
      ...item,
      profiles: Array.isArray(item.profiles) ? item.profiles[0] ?? undefined : item.profiles,
    })) ?? [];

  const hasAnySchedule = scheduleRows.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Records"
        description="Create your own schedule and DTR entries (auto-approved)."
        userId={profile.id}
      />

      <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link href="/manager-records/schedule/new">
            <CalendarPlus className="h-4 w-4" />
            New schedule
          </Link>
        </Button>
        <Button asChild disabled={!hasAnySchedule} className="w-full sm:w-auto">
          <Link href="/manager-records/dtr/new">
            <Plus className="h-4 w-4" />
            New DTR
          </Link>
        </Button>
      </div>

      {!hasAnySchedule ? (
        <p className="text-sm text-slate-500">
          Create a schedule first to unlock DTR creation.
        </p>
      ) : null}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Schedules</h2>
        <div className="card p-3 sm:p-4">
          <ScheduleTable
            data={scheduleRows}
            isManager={false}
            employeeId={profile.id}
            realtime
            detailHrefBase="/manager-records/schedule"
          />
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">DTR</h2>
        <div className="card p-3 sm:p-4">
          <DtrTable data={dtrRows} isManager={false} detailHrefBase="/manager-records/dtr" />
        </div>
      </div>
    </div>
  );
}
