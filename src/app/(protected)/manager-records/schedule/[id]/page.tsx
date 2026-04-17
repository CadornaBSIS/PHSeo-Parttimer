import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScheduleWeekForm } from "@/features/schedule/components/schedule-week-form";
import { ScheduleFormValues } from "@/features/schedule/schema";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import { formatWeekRange } from "@/utils/date";
import { ScheduleStatus } from "@/types/db";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ManagerScheduleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireProfile();
  if (profile.role !== "manager") redirect("/schedule");

  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("schedules")
    .select("id, employee_id, week_start, week_end, status, submitted_at, schedule_days(*)")
    .eq("id", id)
    .eq("employee_id", profile.id)
    .maybeSingle<{
      id: string;
      employee_id: string;
      week_start: string;
      week_end: string;
      status: ScheduleStatus;
      submitted_at?: string | null;
      schedule_days?: ScheduleFormValues["days"];
    }>();

  if (error || !data) notFound();

  const canEdit = data.status === "draft";
  const sortedScheduleDays =
    data.schedule_days
      ?.map((day) => ({ ...day, approval_status: day.approval_status ?? "approved" }))
      .sort((a, b) => a.day_of_week - b.day_of_week) ?? undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Schedule ${formatWeekRange(data.week_start)}`}
        description="Manager schedule (auto-approved)"
        userId={profile.id}
        actions={
          <Button asChild variant="outline">
            <Link href={`/api/export/schedule/${data.id}`}>
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
          <p className="text-sm text-slate-500">
            {data.submitted_at ? `Submitted ${new Date(data.submitted_at).toLocaleString()}` : "Draft - editable"}
          </p>
        </CardHeader>
        <CardContent>
          <ScheduleWeekForm
            initialData={{
              id: data.id,
              week_start: data.week_start,
              week_end: data.week_end,
              status: data.status,
              days: sortedScheduleDays,
            }}
            readOnly={!canEdit}
            viewerRole="employee"
            approvalStatusOnSave="approved"
            defaultApprovalStatus="approved"
          />
        </CardContent>
      </Card>
    </div>
  );
}

