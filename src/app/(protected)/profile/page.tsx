import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowRight,
  Bell,
  Building2,
  CalendarDays,
  Clock3,
  Mail,
  Settings2,
  UserRound,
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
import { LiveUnreadCount } from "@/features/notifications/components/live-unread-count";
import { requireProfile } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function ProfilePage() {
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();
  const isManager = profile.role === "manager";

  const [
    { count: unreadNotifications = 0 },
    { data: latestScheduleRows },
    { data: latestDtrRows },
  ] = await Promise.all([
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("is_read", false),
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
  ]);

  const latestSchedule = latestScheduleRows?.[0];
  const latestDtr = latestDtrRows?.[0];
  const unreadNotificationCount = unreadNotifications ?? 0;
  const statusText = (profile.status ?? "inactive").replace(/_/g, " ");
  const joinedDate = format(new Date(profile.created_at), "MMMM d, yyyy");
  const lastUpdated = format(new Date(profile.updated_at), "MMMM d, yyyy");
  const roleLabel = isManager ? "Manager" : "Employee";

  return (
    <div className="space-y-6 md:space-y-8 w-full overflow-x-hidden">
      <PageHeader
        title="My Profile"
        description={
          isManager
            ? "Account identity and manager-level overview."
            : "Account identity and your personal work summary."
        }
        userId={profile.id}
      />

      <Card className="overflow-hidden border-slate-200 shadow-md">
        <CardContent className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(251,113,133,0.12),_transparent_24%),linear-gradient(135deg,_#ffffff_0%,_#f8fbff_45%,_#eef5ff_100%)] p-0">
          <div className="pointer-events-none absolute left-[-4rem] top-[-3rem] h-44 w-44 rounded-full bg-rose-200/35 blur-3xl" />
          <div className="pointer-events-none absolute right-[-2rem] top-[-1rem] h-52 w-52 rounded-full bg-sky-200/40 blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-4rem] right-[20%] h-40 w-40 rounded-full bg-amber-100/40 blur-3xl" />

          <div className="relative p-4 sm:p-6 lg:p-8">
            <div className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-center">
              <div className="space-y-3 sm:space-y-4">
                <div className="space-y-3">
                  <h2 className="break-words text-3xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-4xl xl:text-5xl">
                    {profile.full_name}
                  </h2>
                  <div className="flex flex-col gap-2 text-sm text-slate-500 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-2 sm:text-base">
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <Mail className="h-4 w-4 text-slate-400" />
                      <span className="min-w-0 break-all">{profile.email}</span>
                    </span>
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-slate-400" />
                      Joined {joinedDate}
                    </span>
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <Clock3 className="h-4 w-4 text-slate-400" />
                      Updated {lastUpdated}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1.5 text-sm font-semibold text-white shadow-sm">
                    <UserRound className="h-4 w-4 text-white/80" />
                    {roleLabel}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold capitalize text-emerald-700 shadow-sm">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    {statusText}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-sm text-slate-600 shadow-sm">
                    <Bell className="h-4 w-4 text-rose-500" />
                    <LiveUnreadCount
                      userId={profile.id}
                      initialCount={unreadNotificationCount}
                    />{" "}
                    unread notifications
                  </span>
                </div>

                <p className="max-w-3xl text-sm leading-7 text-slate-600 sm:text-base sm:leading-8">
                  Keep your account details current and stay on top of schedules, DTR submissions,
                  and team updates from one place.
                </p>
              </div>

              <div className="grid w-full gap-3 xl:justify-self-end xl:w-full">
                <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Quick actions
                  </p>
                  <div className="mt-3 grid gap-3">
                    <Button size="lg" asChild>
                      <Link href="/settings">
                        <Settings2 className="h-4 w-4" />
                        Open settings
                      </Link>
                    </Button>
                    <Button variant="outline" size="lg" asChild>
                      <Link href={isManager ? "/employees" : "/schedule"}>
                        {isManager ? "Manage team" : "Open schedule"}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 text-sm text-slate-600 shadow-sm backdrop-blur">
                  <p className="font-semibold text-slate-900">Stay current</p>
                  <p className="mt-1">
                    Review your submissions and account settings regularly to keep your records accurate.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        <Card className="h-full shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-5 w-5 text-accent" />
              Account Details
            </CardTitle>
            <CardDescription>
              Core information used for access, notifications, and records.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid content-start gap-3 space-y-0 sm:grid-cols-2 sm:auto-rows-fr">
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

        <Card className="h-full shadow-sm">
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
    <div className="flex h-full flex-col justify-center rounded-xl border border-border bg-white p-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div
        className={cn(
          "mt-1 flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-900",
          valueClassName,
        )}
      >
        {icon}
        <span className="min-w-0 break-words">{value}</span>
      </div>
    </div>
  );
}
