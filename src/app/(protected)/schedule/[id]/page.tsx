import Link from "next/link";
import { FileText, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScheduleWeekForm } from "@/features/schedule/components/schedule-week-form";
import { ScheduleFormValues } from "@/features/schedule/schema";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import { formatWeekRange } from "@/utils/date";
import { ScheduleStatus } from "@/types/db";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ScheduleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  type ScheduleRecord = {
    id: string;
    employee_id: string;
    week_start: string;
    week_end: string;
    status: ScheduleStatus;
    submitted_at?: string | null;
    profiles?: { full_name?: string | null } | { full_name?: string | null }[];
    schedule_days?: ScheduleFormValues["days"];
  };
  try {
    const { id } = await params;
    const profile = await requireProfile();
    // Use service role to avoid RLS blocking related schedule_days; enforce access manually.
    const supabase = await createServiceSupabaseClient();

    const { data, error } = await supabase
      .from("schedules")
      .select(
        "id, employee_id, week_start, week_end, status, submitted_at, profiles(full_name), schedule_days(*)",
      )
      .eq("id", id)
      .maybeSingle<ScheduleRecord>();

    if (error) {
      return (
        <div className="space-y-4">
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Error loading schedule: {error.message}
          </div>
        </div>
      );
    }

    if (!data || !data.employee_id) {
      return (
        <div className="space-y-4">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            Schedule not found or you do not have access.
          </div>
        </div>
      );
    }

    const approvalStatuses =
      data.schedule_days?.map((day) => day.approval_status ?? "for_approval") ?? [];
    const hasReviewedDays = approvalStatuses.some((status) => status !== "for_approval");
    const pendingCount = approvalStatuses.filter((status) => status === "for_approval").length;
    const isReviewFinalized = hasReviewedDays && pendingCount === 0;
    const isOwner = data.employee_id === profile.id;
    const canEdit =
      profile.role === "employee" && isOwner && data.status === "draft";
    const canReview =
      profile.role === "manager" &&
      data.status === "submitted" &&
      pendingCount > 0;

    const employeeName = Array.isArray(data.profiles)
      ? data.profiles[0]?.full_name
      : data.profiles?.full_name;
    const sortedScheduleDays =
      data.schedule_days
        ?.map((day) => ({
          ...day,
          approval_status: day.approval_status ?? "for_approval",
        }))
        .sort((a, b) => a.day_of_week - b.day_of_week) ?? undefined;
    const approvedCount = approvalStatuses.filter((status) => status === "approved").length;
    const notApprovedCount = approvalStatuses.filter((status) => status === "not_approved").length;

    return (
      <div className="space-y-6">
        <PageHeader
          title={`Schedule ${formatWeekRange(data.week_start)}`}
          description={employeeName ?? "Schedule"}
          userId={profile.id}
          actions={
            profile.role === "manager" ? (
              <Button asChild variant="outline">
                <Link href={`/api/export/schedule/${data.id}`}>
                  <FileText className="h-4 w-4" />
                  Export PDF
                </Link>
              </Button>
            ) : null
          }
        />

        <Card>
          <CardHeader className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-2">
              Status <StatusBadge status={data.status} />
            </CardTitle>
            <p className="text-sm text-slate-500">
              {data.submitted_at
                ? `Submitted ${new Date(data.submitted_at).toLocaleString()}`
                : "Draft - editable"}
            </p>
            {canReview ? (
              <p className="text-xs text-slate-500">
                Review the submitted schedule by setting each day to Approve or Not Approve.
              </p>
            ) : null}
            {profile.role === "manager" && data.status === "submitted" && isReviewFinalized ? (
              <p className="text-xs text-slate-500">
                This schedule has already been reviewed. Review fields are now locked.
              </p>
            ) : null}
            {profile.role === "manager" && data.status === "submitted" && canReview && hasReviewedDays ? (
              <p className="text-xs text-slate-500">
                This schedule has partially reviewed days. You can continue reviewing the remaining pending days.
              </p>
            ) : null}
            {profile.role === "manager" ? (
              <p className="text-xs text-slate-500">
                Review summary: {approvedCount} approved, {notApprovedCount} not approved, {pendingCount} pending.
              </p>
            ) : null}
            {profile.role === "employee" && data.status === "submitted" ? (
              <p className="text-xs text-slate-500">
                Review summary: {approvedCount} approved, {notApprovedCount} not approved, {pendingCount} pending.
              </p>
            ) : null}
            {!canEdit && profile.role === "employee" ? (
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                Submitted schedules are locked. Contact manager for changes.
              </p>
            ) : null}
          </CardHeader>
          <CardContent>
            <ScheduleWeekForm
              initialData={{
                id: data.id,
                week_start: data.week_start,
                week_end: data.week_end,
                status: data.status as ScheduleStatus,
                days: sortedScheduleDays,
              }}
              readOnly={!canEdit && !canReview}
              viewerRole={profile.role}
              scheduleId={data.id}
              reviewLocked={isReviewFinalized}
            />
          </CardContent>
        </Card>
      </div>
    );
  } catch (err: unknown) {
    console.error("ScheduleDetailPage error", err);
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load schedule: {err instanceof Error ? err.message : "Unknown error"}
        </div>
      </div>
    );
  }
}
