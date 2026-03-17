import Link from "next/link";
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
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();

  const monday = ensureMonday(new Date());
  const weekStartStr = format(monday, "yyyy-MM-dd");
  const weekEndStr = format(computeWeekEnd(monday), "yyyy-MM-dd");

  if (profile.role === "manager") {
    const [{ count: employeeCount }, { count: schedulesSubmitted }, { count: schedulesDraft }, { count: dtrSubmitted }] =
      await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
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
      ]);

    const { data: recentSchedules } = await supabase
      .from("schedules")
      .select("id, week_start, week_end, status, profiles(full_name)")
      .order("updated_at", { ascending: false })
      .limit(5);

    const { data: recentDtr } = await supabase
      .from("dtr_entries")
      .select("id, work_date, status, duration_minutes, profiles(full_name)")
      .order("updated_at", { ascending: false })
      .limit(5);

    const { data: notifications } = await supabase
      .from("notifications")
      .select("id, title, message, created_at, is_read")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(5);

    return (
      <div className="space-y-6">
        <PageHeader
          title="Manager Dashboard"
          description="Monitor schedules, DTR submissions, and team activity."
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
  const { data: mySchedules } = await supabase
    .from("schedules")
    .select("*")
    .eq("employee_id", profile.id)
    .gte("week_start", weekStartStr)
    .lte("week_end", weekEndStr)
    .order("week_start", { ascending: false })
    .limit(1);

  const { data: myDtr } = await supabase
    .from("dtr_entries")
    .select("*")
    .eq("employee_id", profile.id)
    .gte("week_start", weekStartStr)
    .lte("week_end", weekEndStr)
    .order("work_date", { ascending: false })
    .limit(1);

  const schedule = mySchedules?.[0];
  const dtr = myDtr?.[0];
  const prettyStatus = (val?: string | null) =>
    val ? `${val.slice(0, 1).toUpperCase()}${val.slice(1)}` : "Not started";

  const { data: myNotifications } = await supabase
    .from("notifications")
    .select("id, title, message, created_at, is_read")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Dashboard"
        description={`Week of ${formatWeekRange(weekStartStr)}`}
      />
      {/* Quick status chips */}
      <div className="grid gap-4 md:grid-cols-2">
        <StatCard
          label="Schedule status"
          value={prettyStatus(schedule?.status)}
          icon={<CalendarClock className="h-5 w-5" />}
          description={
            schedule ? formatWeekRange(schedule.week_start) : "Create your plan"
          }
        />
        <StatCard
          label="DTR status"
          value={prettyStatus(dtr?.status)}
          icon={<Clock3 className="h-5 w-5" />}
          description={
            dtr ? `${dtr.work_date}` : "Capture your actual work logs"
          }
        />
      </div>
      {/* Action buttons with state-aware styling */}
      <div className="flex flex-wrap gap-3">
        <Button
          asChild
          variant={schedule?.status === "submitted" ? "outline" : "default"}
          className={
            schedule?.status === "submitted"
              ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              : "bg-amber-500 hover:bg-amber-600"
          }
        >
          <Link href={schedule ? `/schedule/${schedule.id}` : "/schedule/new"}>
            <CalendarClock className="h-4 w-4" />
            {schedule
              ? schedule.status === "submitted"
                ? "View submitted schedule"
                : "Edit draft / view"
              : "Create schedule"}
          </Link>
        </Button>
        <Button
          variant="outline"
          className="border-accent text-accent hover:bg-accent/10"
          asChild
        >
          <Link href="/schedule/new?week=next">
            <CalendarClock className="h-4 w-4" />
            Plan next week
          </Link>
        </Button>
        <Button
          variant={dtr ? "outline" : "default"}
          className={dtr ? "border-sky-300 text-sky-700 hover:bg-sky-50" : ""}
          asChild
        >
          <Link href={dtr ? `/dtr/${dtr.id}` : "/dtr/new"}>
            <Clock3 className="h-4 w-4" />
            {dtr ? "View DTR" : "Create DTR"}
          </Link>
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-accent" />
              Current week schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            {schedule ? (
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
                  <p className="text-xs text-slate-500">Status</p>
                </div>
                <StatusBadge status={schedule.status} />
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                You have not created a schedule for this week. Start with a
                draft.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-accent" />
              Current week DTR
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dtr ? (
              <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {dtr.work_date}
                  </p>
                  <p className="text-xs text-slate-500">
                    Duration: {formatMinutes(dtr.duration_minutes)}
                  </p>
                </div>
                <StatusBadge status={dtr.status} />
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                No DTR entries for this week yet.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(myNotifications ?? []).map((n) => (
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
            {!myNotifications?.length ? (
              <p className="text-sm text-slate-500">No notifications yet.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
