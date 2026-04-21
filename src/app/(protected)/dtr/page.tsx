import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import { DtrTable } from "@/features/dtr/components/dtr-table";

export default async function DtrListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; locked?: string }>;
}) {
  const params = await searchParams;
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();
  let canCreate = true;

  if (profile.role === "employee") {
    const { data: scheduleExists } = await supabase
      .from("schedules")
      .select("id")
      .eq("employee_id", profile.id)
      .limit(1);
    canCreate = Boolean(scheduleExists?.length);
  }

  let query = supabase
    .from("dtr_entries")
    .select("id, work_date, status, duration_minutes, project_account, profiles(full_name)");

  if (profile.role === "employee") {
    query = query.eq("employee_id", profile.id).order("work_date", { ascending: false });
  } else {
    // For managers, sort by employee name first, then by most recent date.
    query = query
      .order("full_name", { foreignTable: "profiles", ascending: true, nullsFirst: false })
      .order("work_date", { ascending: false });
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

  // Sort by employee name for managers to make tracking easier.
  if (profile.role === "manager") {
    rows = rows.sort((a, b) => {
      const nameA = (a.profiles?.full_name ?? "").toLowerCase();
      const nameB = (b.profiles?.full_name ?? "").toLowerCase();
      if (nameA === nameB) {
        // If same employee, newest date first.
        return (b.work_date ?? "").localeCompare(a.work_date ?? "");
      }
      return nameA.localeCompare(nameB);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="DTR"
        description="Actual work logs. Drafts are editable until submitted."
        userId={profile.id}
        actions={
          profile.role === "employee" && canCreate ? (
            <Button asChild>
              <Link href="/dtr/new">
                <Plus className="h-4 w-4" />
                New entry
              </Link>
            </Button>
          ) : null
        }
      />
      {profile.role === "employee" && !canCreate ? (
        <p className="text-sm text-slate-500">
          Create a schedule first before logging DTR entries.
        </p>
      ) : null}
      {profile.role === "employee" && params.locked === "no-schedule" ? (
        <p className="text-sm text-amber-600">
          No schedule found for that week. Please add your schedule, then create a DTR.
        </p>
      ) : null}

      <div className="flex items-center gap-3 text-sm">
        <span className="text-slate-500">Filter:</span>
        <Link
          href="/dtr"
          className={`rounded-full px-3 py-1 border ${!params.status ? "bg-accent text-white border-accent" : "border-border text-slate-700"}`}
        >
          All
        </Link>
        <Link
          href="/dtr?status=draft"
          className={`rounded-full px-3 py-1 border ${params.status === "draft" ? "bg-accent text-white border-accent" : "border-border text-slate-700"}`}
        >
          Draft
        </Link>
        <Link
          href="/dtr?status=submitted"
          className={`rounded-full px-3 py-1 border ${params.status === "submitted" ? "bg-accent text-white border-accent" : "border-border text-slate-700"}`}
        >
          Submitted
        </Link>
      </div>

      {profile.role === "manager" ? (
        <DtrTable data={rows} isManager />
      ) : (
        <div className="card">
          <DtrTable data={rows} isManager={false} />
        </div>
      )}
    </div>
  );
}
