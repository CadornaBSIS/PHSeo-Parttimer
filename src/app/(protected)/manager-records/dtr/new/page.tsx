import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { DtrForm } from "@/features/dtr/components/dtr-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ManagerNewDtrPage() {
  const profile = await requireProfile();
  if (profile.role !== "manager") redirect("/dtr");

  const supabase = await createServerSupabaseClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("is_active", true);

  const { data: scheduleWeeks } = await supabase
    .from("schedules")
    .select("week_start, week_end")
    .eq("employee_id", profile.id)
    .order("week_start", { ascending: false })
    .limit(24);

  const allowedWeeks =
    scheduleWeeks?.map((item) => ({ start: item.week_start, end: item.week_end })) ?? [];

  if (!allowedWeeks.length) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="New DTR entry"
          description="Create a schedule first to unlock DTR creation."
          userId={profile.id}
          actions={
            <Button asChild>
              <Link href="/manager-records/schedule/new">Create schedule</Link>
            </Button>
          }
        />
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No schedule weeks found for your account.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New DTR entry"
        description="Log your actual work for the selected week."
        userId={profile.id}
      />
      <div className="card">
        <DtrForm projects={projects ?? []} allowedWeeks={allowedWeeks} />
      </div>
    </div>
  );
}

