import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { DtrForm } from "@/features/dtr/components/dtr-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function NewDtrPage() {
  const profile = await requireProfile();
  if (profile.role !== "employee") redirect("/dtr");

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
    redirect("/dtr?locked=no-schedule");
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
