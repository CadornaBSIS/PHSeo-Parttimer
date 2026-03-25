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

  return (
    <div className="space-y-6">
      <PageHeader
        title="New DTR entry"
        description="Log your actual work for the selected week."
        userId={profile.id}
      />
      <div className="card">
        <DtrForm projects={projects ?? []} />
      </div>
    </div>
  );
}
