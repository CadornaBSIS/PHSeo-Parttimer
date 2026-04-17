"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";
import { scheduleFormSchema, ScheduleFormValues } from "./schema";
import { createNotification } from "@/features/notifications/service";
import { logAudit } from "@/features/audit/log";
import { ScheduleApprovalStatus } from "@/types/db";

export type ScheduleActionResponse = {
  error?: string;
  success?: string;
  scheduleId?: string;
};

async function notifyManagers(params: {
  title: string;
  message: string;
  type: string;
  link?: string | null;
}) {
  const serviceSupabase = await createServiceSupabaseClient();
  const { data: managers } = await serviceSupabase
    .from("profiles")
    .select("id")
    .eq("role", "manager")
    .eq("status", "active");

  if (!managers?.length) return;

  await serviceSupabase.from("notifications").insert(
    managers.map((manager) => ({
      user_id: manager.id,
      title: params.title,
      message: params.message,
      type: params.type,
      link: params.link ?? null,
    })),
  );
}

export async function saveScheduleAction(
  payload: ScheduleFormValues,
  submit = false,
): Promise<ScheduleActionResponse> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: "Unauthenticated" };
  }

  const { data: actorProfile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", session.user.id)
    .maybeSingle();

  const parsed = scheduleFormSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: "Validation failed" };
  }

  const data = parsed.data;
  const weekStart = data.week_start;
  const weekEnd = data.week_end;
  const employeeName = actorProfile?.full_name ?? "Employee";
  const approvalStatusOnSave: ScheduleApprovalStatus =
    actorProfile?.role === "manager" ? "approved" : "for_approval";

  const { data: existing } = await supabase
    .from("schedules")
    .select("*")
    .eq("employee_id", session.user.id)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (existing && existing.status === "submitted") {
    return { error: "Submitted schedules can no longer be edited." };
  }

  let scheduleId = existing?.id ?? data.id;

  if (!scheduleId) {
    const { data: inserted, error } = await supabase
      .from("schedules")
      .insert({
        employee_id: session.user.id,
        week_start: weekStart,
        week_end: weekEnd,
        status: "draft",
      })
      .select("id")
      .single();
    if (error || !inserted) {
      return { error: error?.message ?? "Failed to create schedule" };
    }
    scheduleId = inserted.id;
  } else if (existing) {
    const { error } = await supabase
      .from("schedules")
      .update({
        week_start: weekStart,
        week_end: weekEnd,
      })
      .eq("id", scheduleId);
    if (error) {
      return { error: error.message };
    }
  }

  // Replace day rows
  await supabase.from("schedule_days").delete().eq("schedule_id", scheduleId);

  const dayPayload = data.days.map((day) => ({
    ...day,
    approval_status: approvalStatusOnSave,
    schedule_id: scheduleId,
  }));

  const { error: dayError } = await supabase
    .from("schedule_days")
    .insert(dayPayload);
  if (dayError) {
    return { error: dayError.message };
  }

  if (submit) {
    const { error: statusError } = await supabase
      .from("schedules")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", scheduleId);
    if (statusError) {
      return { error: statusError.message };
    }
    await notifyManagers({
      title: `${employeeName} submitted schedule`,
      message: `${employeeName} submitted the schedule for the week starting ${weekStart}.`,
      type: "schedule_submitted",
      link: `/schedule/${scheduleId}`,
    });
    await logAudit({
      action: "schedule_submitted",
      target_type: "schedule",
      target_id: scheduleId,
      metadata: { week_start: weekStart },
    });
    revalidatePath("/schedule");
    revalidatePath(`/schedule/${scheduleId}`);
    revalidatePath("/dashboard");
    return { success: "Schedule submitted", scheduleId };
  }

  await createNotification({
    user_id: session.user.id,
    title: "Schedule draft saved",
    message: `Week starting ${weekStart} saved as draft.`,
    type: "schedule_draft",
    link: `/schedule/${scheduleId}`,
  });
  await logAudit({
    action: "schedule_saved",
    target_type: "schedule",
    target_id: scheduleId,
    metadata: { week_start: weekStart },
  });
  revalidatePath("/schedule");
  revalidatePath("/dashboard");
  return { success: "Schedule saved as draft", scheduleId };
}

export async function updateScheduleApprovalAction(
  scheduleId: string,
  approvals: { day_of_week: number; approval_status: ScheduleApprovalStatus }[],
  finalize = true,
): Promise<ScheduleActionResponse> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: "Unauthenticated" };
  }

  const { data: managerProfile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", session.user.id)
    .single();

  if (managerProfile?.role !== "manager") {
    return { error: "Only managers can review submitted schedules." };
  }

  const { data: schedule, error: scheduleError } = await supabase
    .from("schedules")
    .select("id, employee_id, week_start, status")
    .eq("id", scheduleId)
    .single();

  if (scheduleError || !schedule) {
    return { error: scheduleError?.message ?? "Schedule not found" };
  }

  if (schedule.status !== "submitted") {
    return { error: "Only submitted schedules can be reviewed." };
  }

  for (const approval of approvals) {
    const { error } = await supabase
      .from("schedule_days")
      .update({ approval_status: approval.approval_status })
      .eq("schedule_id", scheduleId)
      .eq("day_of_week", approval.day_of_week);

    if (error) {
      return { error: error.message };
    }
  }

  const approvedCount = approvals.filter((item) => item.approval_status === "approved").length;
  const notApprovedCount = approvals.filter((item) => item.approval_status === "not_approved").length;
  const pendingCount = approvals.filter((item) => item.approval_status === "for_approval").length;

  if (finalize && pendingCount > 0) {
    return { error: "Review all days before saving the final review." };
  }

  if (finalize) {
    await createNotification({
      user_id: schedule.employee_id,
      title: "Schedule reviewed",
      message:
        approvedCount || notApprovedCount
          ? `Your submitted schedule was reviewed. Approved: ${approvedCount}, Not Approved: ${notApprovedCount}.`
          : "Your submitted schedule is still marked for approval.",
      type: "schedule_reviewed",
      link: `/schedule/${scheduleId}`,
    });
  }

  await logAudit({
    action: finalize ? "schedule_reviewed" : "schedule_review_progress_saved",
    target_type: "schedule",
    target_id: scheduleId,
    metadata: {
      week_start: schedule.week_start,
      approved_count: approvedCount,
      not_approved_count: notApprovedCount,
      pending_count: pendingCount,
      finalized: finalize,
      reviewer: managerProfile.full_name ?? session.user.id,
    },
  });

  revalidatePath("/schedule");
  revalidatePath(`/schedule/${scheduleId}`);
  revalidatePath("/dashboard");

  return { success: finalize ? "Schedule review saved" : "Schedule review draft saved", scheduleId };
}
