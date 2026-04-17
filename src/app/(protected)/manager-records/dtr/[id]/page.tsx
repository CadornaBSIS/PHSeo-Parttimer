import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DtrForm } from "@/features/dtr/components/dtr-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import { formatMinutes, formatWeekRange } from "@/utils/date";
import { format, parseISO } from "date-fns";
import { DtrStatus } from "@/types/db";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ManagerDtrDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireProfile();
  if (profile.role !== "manager") redirect("/dtr");

  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("dtr_entries")
    .select(
      "id, employee_id, week_start, week_end, work_date, start_time, end_time, project_account, project_id, notes, image_link, duration_minutes, status, submitted_at, projects(id, name)",
    )
    .eq("id", id)
    .eq("employee_id", profile.id)
    .maybeSingle();

  if (error || !data) notFound();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("is_active", true);

  const canEdit = data.status === "draft";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`DTR for ${format(parseISO(data.work_date), "MM-dd-yyyy")}`}
        description={`Manager - Week ${formatWeekRange(data.week_start)}`}
        userId={profile.id}
        actions={
          <Button asChild variant="outline">
            <Link href={`/api/export/dtr/${data.id}`}>
              <FileText className="h-4 w-4" />
              Export PDF
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2">
            Status <StatusBadge status={data.status} />
          </CardTitle>
          <p className="text-sm text-slate-500">Duration: {formatMinutes(data.duration_minutes)}</p>
          {data.submitted_at ? (
            <p className="text-xs text-slate-500">
              Submitted {new Date(data.submitted_at).toLocaleString()}
            </p>
          ) : null}
        </CardHeader>
        <CardContent>
          <DtrForm
            initialData={{
              id: data.id,
              week_start: data.week_start,
              week_end: data.week_end,
              work_date: data.work_date,
              start_time: data.start_time ?? undefined,
              end_time: data.end_time ?? undefined,
              project_account: data.project_account ?? undefined,
              project_id: data.project_id ?? undefined,
              notes: data.notes ?? undefined,
              image_link: data.image_link ?? undefined,
              status: data.status as DtrStatus,
            }}
            projects={projects ?? []}
            readOnly={!canEdit}
          />
        </CardContent>
      </Card>
    </div>
  );
}

