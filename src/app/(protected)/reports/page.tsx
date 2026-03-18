import { notFound } from "next/navigation";
import { startOfWeek, subWeeks, format } from "date-fns";
import { PageHeader } from "@/components/layout/page-header";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import { ReportsDashboard } from "@/features/reports/components/reports-dashboard";

type ProfileRow = {
  id: string;
  full_name: string;
  role: string;
  status: string;
};

type ScheduleRow = {
  id: string;
  employee_id: string;
  week_start: string;
  status: "draft" | "submitted";
};

type DtrRow = {
  id: string;
  employee_id: string;
  week_start: string;
  work_date: string;
  duration_minutes: number;
  status: "draft" | "submitted";
};

type ScheduleDayRow = {
  schedule_id: string;
  approval_status: "for_approval" | "approved" | "not_approved";
};

type AuditRow = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  created_at: string;
  actor_id: string | null;
};

function formatAuditDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function ReportsPage() {
  const profile = await requireProfile();
  if (profile.role !== "manager") notFound();

  const supabase = await createServerSupabaseClient();
  const currentWeek = startOfWeek(new Date(), { weekStartsOn: 1 });
  const earliestWeek = subWeeks(currentWeek, 5);
  const earliestWeekKey = format(earliestWeek, "yyyy-MM-dd");
  const currentWeekKey = format(currentWeek, "yyyy-MM-dd");
  const weekKeys = Array.from({ length: 6 }, (_, index) => {
    const weekDate = subWeeks(currentWeek, 5 - index);
    return {
      key: format(weekDate, "yyyy-MM-dd"),
      label: format(weekDate, "MMM d"),
    };
  });

  const [
    { count: submittedSchedules },
    { count: draftSchedules },
    { count: submittedDtr },
    { count: draftDtr },
    { data: profiles },
    { data: schedules },
    { data: dtrEntries },
    { data: auditLogs },
  ] = await Promise.all([
    supabase.from("schedules").select("*", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("schedules").select("*", { count: "exact", head: true }).eq("status", "draft"),
    supabase.from("dtr_entries").select("*", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("dtr_entries").select("*", { count: "exact", head: true }).eq("status", "draft"),
    supabase.from("profiles").select("id, full_name, role, status").returns<ProfileRow[]>(),
    supabase
      .from("schedules")
      .select("id, employee_id, week_start, status")
      .gte("week_start", earliestWeekKey)
      .returns<ScheduleRow[]>(),
    supabase
      .from("dtr_entries")
      .select("id, employee_id, week_start, work_date, duration_minutes, status")
      .gte("week_start", earliestWeekKey)
      .returns<DtrRow[]>(),
    supabase
      .from("audit_logs")
      .select("id, action, target_type, target_id, created_at, actor_id")
      .order("created_at", { ascending: false })
      .limit(12)
      .returns<AuditRow[]>(),
  ]);

  const scheduleIds = (schedules ?? []).map((schedule) => schedule.id);
  const { data: scheduleDays } = scheduleIds.length
    ? await supabase
        .from("schedule_days")
        .select("schedule_id, approval_status")
        .in("schedule_id", scheduleIds)
        .returns<ScheduleDayRow[]>()
    : { data: [] as ScheduleDayRow[] };

  const profileMap = new Map((profiles ?? []).map((row) => [row.id, row.full_name]));
  const employeeProfiles = (profiles ?? []).filter((row) => row.role === "employee" && row.status === "active");

  const trendData = weekKeys.map((week) => {
    const weekSchedules = (schedules ?? []).filter((item) => item.week_start === week.key);
    const weekDtr = (dtrEntries ?? []).filter((item) => item.week_start === week.key);
    const totalMinutes = weekDtr.reduce((sum, item) => sum + (item.duration_minutes ?? 0), 0);

    return {
      label: week.label,
      schedules: weekSchedules.filter((item) => item.status === "submitted").length,
      dtrEntries: weekDtr.filter((item) => item.status === "submitted").length,
      hours: Number((totalMinutes / 60).toFixed(1)),
    };
  });

  const scheduleStatusData = [
    { name: "Submitted", value: submittedSchedules ?? 0, tone: "submitted" },
    { name: "Draft", value: draftSchedules ?? 0, tone: "draft" },
  ].filter((item) => item.value > 0);

  const reviewStatusData = [
    {
      name: "For Approval",
      value: (scheduleDays ?? []).filter((item) => item.approval_status === "for_approval").length,
      tone: "for_approval",
    },
    {
      name: "Approved",
      value: (scheduleDays ?? []).filter((item) => item.approval_status === "approved").length,
      tone: "approved",
    },
    {
      name: "Not Approved",
      value: (scheduleDays ?? []).filter((item) => item.approval_status === "not_approved").length,
      tone: "not_approved",
    },
  ].filter((item) => item.value > 0);

  const topEmployeeHours = employeeProfiles
    .map((employee) => {
      const minutes = (dtrEntries ?? [])
        .filter(
          (entry) =>
            entry.employee_id === employee.id &&
            entry.week_start === currentWeekKey &&
            entry.status === "submitted",
        )
        .reduce((sum, entry) => sum + (entry.duration_minutes ?? 0), 0);

      return {
        name: employee.full_name,
        hours: Number((minutes / 60).toFixed(1)),
      };
    })
    .filter((item) => item.hours > 0)
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 6);

  const auditFeed = (auditLogs ?? []).map((log) => ({
    id: log.id,
    action: log.action.replaceAll("_", " "),
    target: `${log.target_type}${log.target_id ? ` ${log.target_id.slice(0, 8)}` : ""}`,
    actor: log.actor_id ? profileMap.get(log.actor_id) ?? "Unknown user" : "System",
    when: formatAuditDate(log.created_at),
  }));

  const snapshot = {
    submittedSchedules: submittedSchedules ?? 0,
    draftSchedules: draftSchedules ?? 0,
    submittedDtr: submittedDtr ?? 0,
    draftDtr: draftDtr ?? 0,
    activeEmployees: employeeProfiles.length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Interactive manager analytics for schedules, DTR activity, and review flow."
      />
      <ReportsDashboard
        snapshot={snapshot}
        trendData={trendData}
        scheduleStatusData={scheduleStatusData}
        reviewStatusData={reviewStatusData}
        topEmployeeHours={topEmployeeHours}
        auditFeed={auditFeed}
      />
    </div>
  );
}
