import { format } from "date-fns";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/common/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/common/status-badge";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import { formatWeekRange, ensureMonday, computeWeekEnd, formatMinutes } from "@/utils/date";
import { Badge } from "@/components/ui/badge";

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();

  const monday = ensureMonday(new Date());
  const weekStartStr = format(monday, "yyyy-MM-dd");
  const weekEndStr = format(computeWeekEnd(monday), "yyyy-MM-dd");

  if (profile.role === "manager") {
        const [
          { count: employeeCount },
          { count: schedulesSubmitted },
          { count: schedulesDraft },
          { count: dtrSubmitted },
      { data: recentSchedules },
      { data: recentDtr },
      { data: notifications },
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("role", "employee")
            .eq("status", "active"),
          supabase
            .from("schedules")
            .select("*", { count: "exact", head: true })
            .eq("status", "submitted"),
      supabase
        .from("schedules")
        .select("*", { count: "exact", head: true })
        .eq("status", "draft"),
      supabase
        .from("dtr_entries")
        .select("*", { count: "exact", head: true })
        .eq("status", "submitted"),
      supabase
        .from("schedules")
        .select("id, week_start, week_end, status, profiles(full_name)")
        .order("updated_at", { ascending: false })
        .limit(5),
      supabase
        .from("dtr_entries")
        .select("id, work_date, status, duration_minutes, profiles(full_name)")
        .order("updated_at", { ascending: false })
        .limit(5),
      supabase
        .from("notifications")
        .select("id, title, message, created_at, is_read")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    return (
      <div className="space-y-6">
        <PageHeader
          title="Manager Dashboard"
          description="Monitor schedules, DTR submissions, and team activity."
          userId={profile.id}
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Employees"
            value={employeeCount ?? 0}
            icon={<Users className="h-5 w-5" />}
          />
          <StatCard
            label="Schedules submitted"
            value={schedulesSubmitted ?? 0}
            icon={<CalendarClock className="h-5 w-5" />}
          />
          <StatCard
            label="Schedules in draft"
            value={schedulesDraft ?? 0}
            icon={<CalendarClock className="h-5 w-5 text-amber-500" />}
          />
          <StatCard
            label="DTR submitted"
            value={dtrSubmitted ?? 0}
            icon={<Clock3 className="h-5 w-5" />}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-accent" />
                Recent schedules
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(recentSchedules ?? [])
                .map((item) => ({
                  ...item,
                  profiles: Array.isArray(item.profiles)
                    ? item.profiles[0] ?? undefined
                    : item.profiles,
                }))
                .map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {item.profiles?.full_name ?? "Employee"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatWeekRange(item.week_start)}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
              ))}
              {!recentSchedules?.length ? (
                <p className="text-sm text-slate-500">No schedules yet.</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock3 className="h-5 w-5 text-accent" />
                Recent DTR entries
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(recentDtr ?? [])
                .map((item) => ({
                  ...item,
                  profiles: Array.isArray(item.profiles)
                    ? item.profiles[0] ?? undefined
                    : item.profiles,
                }))
                .map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {item.profiles?.full_name ?? "Employee"}
                    </p>
                    <p className="text-xs text-slate-500">{item.work_date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">
                      {formatMinutes(item.duration_minutes)}
                    </Badge>
                    <StatusBadge status={item.status} />
                  </div>
                </div>
              ))}
              {!recentDtr?.length ? (
                <p className="text-sm text-slate-500">No DTR entries yet.</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="secondary">Notifications</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(notifications ?? []).map((n) => (
                <div
                  key={n.id}
                  className="rounded-lg border border-border px-3 py-2"
                >
                  <p className="text-sm font-semibold text-slate-900">
                    {n.title}
                  </p>
                  <p className="text-xs text-slate-500">{n.message}</p>
                  <p className="text-[11px] text-slate-400">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
              {!notifications?.length ? (
                <p className="text-sm text-slate-500">No notifications.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Employee view
  const [
    { data: mySchedules },
    { data: myDtr },
    { data: myNotifications },
    { count: mySubmittedSchedules },
    { count: mySubmittedDtr },
    { data: myRecentSchedules },
    { data: myRecentDtr },
    { data: dtrDurationRows },
  ] =
    await Promise.all([
      supabase
        .from("schedules")
        .select("*")
        .eq("employee_id", profile.id)
        .gte("week_start", weekStartStr)
        .lte("week_end", weekEndStr)
        .order("week_start", { ascending: false })
        .limit(1),
      supabase
        .from("dtr_entries")
        .select("*")
        .eq("employee_id", profile.id)
        .gte("week_start", weekStartStr)
        .lte("week_end", weekEndStr)
        .order("work_date", { ascending: false })
        .limit(1),
      supabase
        .from("notifications")
        .select("id, title, message, created_at, is_read")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("schedules")
        .select("id", { count: "exact", head: true })
        .eq("employee_id", profile.id)
        .eq("status", "submitted"),
      supabase
        .from("dtr_entries")
        .select("id", { count: "exact", head: true })
        .eq("employee_id", profile.id)
        .eq("status", "submitted"),
      supabase
        .from("schedules")
        .select("id, week_start, status, submitted_at")
        .eq("employee_id", profile.id)
        .order("updated_at", { ascending: false })
        .limit(5),
      supabase
        .from("dtr_entries")
        .select("id, work_date, status, duration_minutes")
        .eq("employee_id", profile.id)
        .order("updated_at", { ascending: false })
        .limit(5),
      supabase
        .from("dtr_entries")
        .select("duration_minutes")
        .eq("employee_id", profile.id)
        .eq("status", "submitted"),
    ]);

  const schedule = mySchedules?.[0];
  const dtr = myDtr?.[0];
  const prettyStatus = (val?: string | null) =>
    val ? `${val.slice(0, 1).toUpperCase()}${val.slice(1)}` : "Not started";
  const unreadNotifications = (myNotifications ?? []).filter(
    (n) => !n.is_read,
  ).length;
  const totalLoggedMinutes = (dtrDurationRows ?? []).reduce(
    (sum, row) => sum + (row.duration_minutes ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Dashboard"
        description={`Week of ${formatWeekRange(weekStartStr)}`}
        userId={profile.id}
      />

      <Card className="overflow-hidden border-slate-200">
        <CardContent className="space-y-4 bg-gradient-to-r from-white via-slate-50 to-blue-50 p-5 sm:p-6">
          <div className="space-y-1">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                This week
              </p>
              <h2 className="text-2xl font-semibold text-slate-950">
                Stay on track
              </h2>
              <p className="text-sm text-slate-600">
                Monitor your schedule, DTR, and review updates in one place.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white/90 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Schedule
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-950">
                {prettyStatus(schedule?.status)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {schedule ? formatWeekRange(schedule.week_start) : "No schedule yet"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/90 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                DTR
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-950">
                {prettyStatus(dtr?.status)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {dtr ? dtr.work_date : "No DTR entry yet"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/90 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Logged duration
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-950">
                {dtr ? formatMinutes(dtr.duration_minutes) : "0h 0m"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Current week latest entry
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Schedules submitted"
          value={mySubmittedSchedules ?? 0}
          icon={<CalendarClock className="h-5 w-5 text-emerald-600" />}
          description="All-time submitted schedules"
        />
        <StatCard
          label="DTR submitted"
          value={mySubmittedDtr ?? 0}
          icon={<CheckCircle2 className="h-5 w-5 text-sky-600" />}
          description="All-time submitted DTR entries"
        />
        <StatCard
          label="Total logged hours"
          value={formatMinutes(totalLoggedMinutes)}
          icon={<Clock3 className="h-5 w-5 text-indigo-600" />}
          description="From submitted DTR records"
        />
        <StatCard
          label="Unread notifications"
          value={unreadNotifications}
          icon={<Badge variant="secondary">New</Badge>}
          description="Pending updates for review"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-accent" />
              Current week schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {schedule ? (
              <>
                <div
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                  schedule.status === "submitted"
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-amber-200 bg-amber-50"
                }`}
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatWeekRange(schedule.week_start)}
                    </p>
                    <p className="text-xs text-slate-500">Current schedule window</p>
                  </div>
                  <StatusBadge status={schedule.status} />
                </div>

                <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Week start
                    </p>
                    <p className="text-sm font-semibold text-slate-900">{schedule.week_start}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Week end
                    </p>
                    <p className="text-sm font-semibold text-slate-900">{schedule.week_end}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6">
                <p className="text-sm text-slate-600">
                  You have not created a schedule for this week yet.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-accent" />
              Current week DTR
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dtr ? (
              <>
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{dtr.work_date}</p>
                    <p className="text-xs text-slate-500">
                      Duration: {formatMinutes(dtr.duration_minutes)}
                    </p>
                  </div>
                  <StatusBadge status={dtr.status} />
                </div>

                <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Week range
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatWeekRange(dtr.week_start)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Last logged date
                    </p>
                    <p className="text-sm font-semibold text-slate-900">{dtr.work_date}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6">
                <p className="text-sm text-slate-600">
                  No DTR entries for this week yet.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Notifications</span>
              <Badge variant="secondary">{unreadNotifications} unread</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(myNotifications ?? []).map((n) => (
              <div
                key={n.id}
                className={`rounded-lg border px-3 py-3 ${
                  n.is_read
                    ? "border-slate-200 bg-white"
                    : "border-sky-200 bg-sky-50/60"
                }`}
              >
                <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                <p className="text-xs text-slate-500">{n.message}</p>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-[11px] text-slate-400">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                  {!n.is_read ? (
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">
                      New
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
            {!myNotifications?.length ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6">
                <p className="text-sm text-slate-600">No notifications yet.</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-accent" />
              Recent schedule submissions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(myRecentSchedules ?? []).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatWeekRange(item.week_start)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.submitted_at
                      ? new Date(item.submitted_at).toLocaleString()
                      : "Not yet submitted"}
                  </p>
                </div>
                <StatusBadge status={item.status} />
              </div>
            ))}
            {!myRecentSchedules?.length ? (
              <p className="text-sm text-slate-500">
                No schedules submitted yet.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock3 className="h-5 w-5 text-accent" />
              Recent DTR submissions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(myRecentDtr ?? []).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {item.work_date}
                  </p>
                  <p className="text-xs text-slate-500">
                    Duration: {formatMinutes(item.duration_minutes)}
                  </p>
                </div>
                <StatusBadge status={item.status} />
              </div>
            ))}
            {!myRecentDtr?.length ? (
              <p className="text-sm text-slate-500">No DTR entries yet.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
