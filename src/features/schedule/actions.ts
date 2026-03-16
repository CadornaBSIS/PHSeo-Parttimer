"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { scheduleFormSchema, ScheduleFormValues } from "./schema";
import { createNotification } from "@/features/notifications/service";
import { logAudit } from "@/features/audit/log";

export type ScheduleActionResponse = {
  error?: string;
  success?: string;
  scheduleId?: string;
};

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

  const parsed = scheduleFormSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: "Validation failed" };
  }

  const data = parsed.data;
  const weekStart = data.week_start;
  const weekEnd = data.week_end;

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
    await createNotification({
      user_id: session.user.id,
      title: "Schedule submitted",
      message: `Week starting ${weekStart} submitted.`,
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
  return { success: "Schedule saved as draft", scheduleId };
}
