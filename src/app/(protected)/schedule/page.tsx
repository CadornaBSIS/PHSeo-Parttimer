import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import { ScheduleTable } from "@/features/schedule/components/schedule-table";

export default async function ScheduleListPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from("schedules")
    .select("id, week_start, week_end, status, submitted_at, profiles(full_name), schedule_days(approval_status)")
    .order("week_start", { ascending: false });

  if (profile.role === "employee") {
    query = query.eq("employee_id", profile.id);
  }

  if (searchParams.status) {
    query = query.eq("status", searchParams.status);
  }

  const { data, error } = await query.limit(50);
  if (error) notFound();

  const rows =
    data?.map((item) => ({
      ...item,
      profiles: Array.isArray(item.profiles) ? item.profiles[0] ?? undefined : item.profiles,
    })) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedules"
        description="Plan your weekly schedule. Drafts are editable until submitted."
        actions={
          profile.role === "employee" ? (
            <Button asChild>
              <Link href="/schedule/new">
                <CalendarPlus className="h-4 w-4" />
                New schedule
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="flex items-center gap-3 text-sm">
        <span className="text-slate-500">Filter:</span>
        <Link
          href="/schedule"
          className={`rounded-full px-3 py-1 border ${!searchParams.status ? "bg-accent text-white border-accent" : "border-border text-slate-700"}`}
        >
          All
        </Link>
        <Link
          href="/schedule?status=draft"
          className={`rounded-full px-3 py-1 border ${searchParams.status === "draft" ? "bg-accent text-white border-accent" : "border-border text-slate-700"}`}
        >
          Draft
        </Link>
        <Link
          href="/schedule?status=submitted"
          className={`rounded-full px-3 py-1 border ${searchParams.status === "submitted" ? "bg-accent text-white border-accent" : "border-border text-slate-700"}`}
        >
          Submitted
        </Link>
      </div>

      <div className="card">
        <ScheduleTable data={rows} isManager={profile.role === "manager"} />
      </div>
    </div>
  );
}
