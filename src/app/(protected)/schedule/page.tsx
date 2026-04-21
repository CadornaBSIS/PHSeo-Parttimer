import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import { ScheduleTable } from "@/features/schedule/components/schedule-table";
import { isMonday, isSunday } from "date-fns";

export default async function ScheduleListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; locked?: string }>;
}) {
  const params = await searchParams;
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();
  const now = new Date();
  const creationWindowOpen = isSunday(now) || isMonday(now);

  let query = supabase
    .from("schedules")
    .select("id, employee_id, week_start, week_end, status, submitted_at, profiles(full_name), schedule_days(approval_status)");

  if (profile.role === "employee") {
    query = query.eq("employee_id", profile.id).order("week_start", { ascending: false });
  } else {
    query = query
      .order("full_name", { foreignTable: "profiles", ascending: true, nullsFirst: false })
      .order("week_start", { ascending: false });
  }

  if (params.status) {
    query = query.eq("status", params.status);
  }

  const { data, error } = await query.limit(50);
  if (error) notFound();

  let rows =
    data?.map((item) => ({
      ...item,
      profiles: Array.isArray(item.profiles) ? item.profiles[0] ?? undefined : item.profiles,
    })) ?? [];

  if (profile.role === "manager") {
    rows = rows.sort((a, b) => {
      const nameA = (a.profiles?.full_name ?? "").toLowerCase();
      const nameB = (b.profiles?.full_name ?? "").toLowerCase();
      if (nameA === nameB) {
        // Newest week first when same employee
        return (b.week_start ?? "").localeCompare(a.week_start ?? "");
      }
      return nameA.localeCompare(nameB);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedules"
        description="Plan your weekly schedule. Drafts are editable until submitted."
        userId={profile.id}
        actions={
          profile.role === "employee" && creationWindowOpen ? (
            <Button asChild>
              <Link href="/schedule/new">
                <CalendarPlus className="h-4 w-4" />
                New schedule
              </Link>
            </Button>
          ) : null
        }
      />
      {profile.role === "employee" && !creationWindowOpen ? (
        <p className="text-sm text-slate-500">
          New schedules can be created on Sunday and Monday only.
        </p>
      ) : null}

      <div className="flex items-center gap-3 text-sm">
        <span className="text-slate-500">Filter:</span>
        <Link
          href="/schedule"
          className={`rounded-full px-3 py-1 border ${!params.status ? "bg-accent text-white border-accent" : "border-border text-slate-700"}`}
        >
          All
        </Link>
        <Link
          href="/schedule?status=draft"
          className={`rounded-full px-3 py-1 border ${params.status === "draft" ? "bg-accent text-white border-accent" : "border-border text-slate-700"}`}
        >
          Draft
        </Link>
        <Link
          href="/schedule?status=submitted"
          className={`rounded-full px-3 py-1 border ${params.status === "submitted" ? "bg-accent text-white border-accent" : "border-border text-slate-700"}`}
        >
          Submitted
        </Link>
      </div>

      {profile.role === "manager" ? (
        <ScheduleTable
          data={rows}
          isManager
          statusFilter={params.status}
          realtime
        />
      ) : (
        <div className="card">
          <ScheduleTable
            data={rows}
            isManager={false}
            statusFilter={params.status}
            employeeId={profile.id}
            realtime
          />
        </div>
      )}
    </div>
  );
}
