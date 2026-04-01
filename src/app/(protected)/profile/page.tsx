import Link from "next/link";
import { format } from "date-fns";
import {
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Clock3,
  Mail,
  UserRound,
  UsersRound,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireProfile } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function ProfilePage() {
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();
  const isManager = profile.role === "manager";

  const [
    { count: unreadNotifications = 0 },
    { count: submittedSchedules = 0 },
    { count: submittedDtr = 0 },
    { data: latestScheduleRows },
    { data: latestDtrRows },
    { count: teamMembers = 0 },
  ] = await Promise.all([
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("is_read", false),
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
      .select("week_start, status, updated_at")
      .eq("employee_id", profile.id)
      .order("updated_at", { ascending: false })
      .limit(1),
    supabase
      .from("dtr_entries")
      .select("work_date, status, duration_minutes, updated_at")
      .eq("employee_id", profile.id)
      .order("updated_at", { ascending: false })
      .limit(1),
    isManager
      ? supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "employee")
          .eq("status", "active")
      : Promise.resolve({ count: 0 }),
  ]);

  const latestSchedule = latestScheduleRows?.[0];
  const latestDtr = latestDtrRows?.[0];
  const initials = profile.full_name
    .split(" ")
    .map((token) => token.slice(0, 1).toUpperCase())
    .join("")
    .slice(0, 2);
  const joinedDate = format(new Date(profile.created_at), "MMMM d, yyyy");
  const lastUpdated = format(new Date(profile.updated_at), "MMMM d, yyyy");
  const roleLabel = isManager ? "Manager" : "Employee";

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        description={
          isManager
            ? "Account identity and manager-level overview."
            : "Account identity and your personal work summary."
        }
        userId={profile.id}
      />

      <Card className="overflow-hidden border-slate-200">
        <CardContent className="bg-gradient-to-r from-white via-slate-50 to-blue-50 p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-lg font-bold text-white">
                {initials}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Account Identity
                </p>
                <h2 className="text-2xl font-semibold text-slate-950">
                  {profile.full_name}
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{roleLabel}</Badge>
                  <StatusBadge status={profile.status ?? "inactive"} />
                </div>
              </div>
            </div>

            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white/90 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Department
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {profile.department ?? "Not set"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white/90 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Employee Code
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {profile.employee_code ?? "Not set"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="space-y-2 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Unread Notifications
            </p>
            <p className="text-2xl font-semibold text-slate-900">
              {unreadNotifications}
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Bell className="h-4 w-4" />
              Pending updates
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Schedules Submitted
            </p>
            <p className="text-2xl font-semibold text-slate-900">
              {submittedSchedules}
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <CalendarClock className="h-4 w-4" />
              Personal total
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              DTR Submitted
            </p>
            <p className="text-2xl font-semibold text-slate-900">
              {submittedDtr}
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock3 className="h-4 w-4" />
              Personal total
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {isManager ? "Active Team Members" : "Profile Role"}
            </p>
            <p className="text-2xl font-semibold text-slate-900">
              {isManager ? teamMembers : roleLabel}
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {isManager ? (
                <>
                  <UsersRound className="h-4 w-4" />
                  Employee accounts
                </>
              ) : (
                <>
                  <BriefcaseBusiness className="h-4 w-4" />
                  Current role
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-5 w-5 text-accent" />
              Account Details
            </CardTitle>
            <CardDescription>
              Core information used for access, notifications, and records.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <InfoItem label="Full Name" value={profile.full_name} />
            <InfoItem
              label="Email Address"
              value={profile.email}
              icon={<Mail className="h-4 w-4" />}
            />
            <InfoItem label="Role" value={roleLabel} />
            <InfoItem
              label="Department"
              value={profile.department ?? "Not set"}
              icon={<Building2 className="h-4 w-4" />}
            />
            <InfoItem
              label="Employee Code"
              value={profile.employee_code ?? "Not set"}
            />
            <InfoItem
              label="Account Status"
              value={profile.status}
              valueClassName="capitalize"
            />
            <InfoItem label="Joined Date" value={joinedDate} />
            <InfoItem label="Last Updated" value={lastUpdated} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isManager ? "Manager Snapshot" : "Employee Snapshot"}</CardTitle>
            <CardDescription>
              {isManager
                ? "Your account and team-level context."
                : "Your latest work submission details."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Latest Schedule
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {latestSchedule ? latestSchedule.week_start : "No schedule yet"}
              </p>
              <div className="mt-2">
                {latestSchedule ? (
                  <StatusBadge status={latestSchedule.status} />
                ) : (
                  <Badge variant="muted">No record</Badge>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Latest DTR
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {latestDtr ? latestDtr.work_date : "No DTR yet"}
              </p>
              <div className="mt-2 flex items-center gap-2">
                {latestDtr ? (
                  <>
                    <StatusBadge status={latestDtr.status} />
                    <Badge variant="secondary">{latestDtr.duration_minutes} mins</Badge>
                  </>
                ) : (
                  <Badge variant="muted">No record</Badge>
                )}
              </div>
            </div>

            <div
              className={cn(
                "rounded-xl border p-4",
                isManager
                  ? "border-indigo-200 bg-indigo-50"
                  : "border-emerald-200 bg-emerald-50",
              )}
            >
              <p className="text-sm font-semibold text-slate-900">
                {isManager
                  ? "You can manage employee accounts and review schedules/DTR entries."
                  : "Keep your schedule and DTR submissions updated every week."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/settings">Open Settings</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href={isManager ? "/employees" : "/schedule"}>
                    {isManager ? "Manage Team" : "Open Schedule"}
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
  icon,
  valueClassName,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div
        className={cn(
          "mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900",
          valueClassName,
        )}
      >
        {icon}
        <span>{value}</span>
      </div>
    </div>
  );
}
