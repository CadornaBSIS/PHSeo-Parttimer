"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";
import { dtrFormSchema, DtrFormValues } from "./schema";
import { calculateDurationMinutes } from "@/utils/date";
import { createNotification } from "@/features/notifications/service";
import { logAudit } from "@/features/audit/log";
import { normalizeImageLinkInput } from "./image-links";
import { splitTaskBlocks } from "./task-blocks";

export type DtrActionResponse = {
  error?: string;
  success?: string;
  id?: string;
  field?: string;
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

export async function saveDtrAction(
  payload: DtrFormValues,
  submit = false,
): Promise<DtrActionResponse> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return { error: "Unauthenticated" };

  const parsed = dtrFormSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: "Validation failed" };
  }
  const data = parsed.data;

  if (submit) {
    const taskBlocks = splitTaskBlocks(data.notes);
    if (!taskBlocks.length) {
      return { error: "Add at least one accomplished task before submitting.", field: "notes" };
    }
  }

  // Ensure a schedule exists for this week before allowing DTR creation
  const { data: scheduleForWeek } = await supabase
    .from("schedules")
    .select("id, status")
    .eq("employee_id", session.user.id)
    .eq("week_start", data.week_start)
    .maybeSingle();

  if (!scheduleForWeek) {
    return {
      error: "Schedule required for that week.",
    };
  }

  const { data: employeeProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", session.user.id)
    .maybeSingle();
  const employeeName = employeeProfile?.full_name ?? "Employee";

  // Enforce 1 DTR per employee per work date
  const existingDateQuery = supabase
    .from("dtr_entries")
    .select("id, status")
    .eq("employee_id", session.user.id)
    .eq("work_date", data.work_date);
  if (data.id) existingDateQuery.neq("id", data.id);

  const { data: conflicting, error: conflictingError } = await existingDateQuery.maybeSingle();
  if (conflictingError) return { error: conflictingError.message };
  if (conflicting) {
    return {
      error: `Duplicate DTR blocked: an entry already exists for ${data.work_date}. Open the existing record instead of creating another.`,
      id: conflicting.id,
      field: "work_date",
    };
  }

  const duration = calculateDurationMinutes(
    data.start_time ?? undefined,
    data.end_time ?? undefined,
  );
  const normalizedImageLink = normalizeImageLinkInput(data.image_link);

  let entryId = data.id;

  if (entryId) {
    const { data: existing } = await supabase
      .from("dtr_entries")
      .select("*")
      .eq("id", entryId)
      .maybeSingle();

    if (existing?.status === "submitted") {
      return { error: "Submitted DTR records cannot be edited." };
    }

    const { error } = await supabase
      .from("dtr_entries")
      .update({
        week_start: data.week_start,
        week_end: data.week_end,
        work_date: data.work_date,
        start_time: data.start_time,
        end_time: data.end_time,
        project_account: data.project_account,
        project_id: data.project_id,
        notes: data.notes,
        image_link: normalizedImageLink,
        duration_minutes: duration,
      })
      .eq("id", entryId);
    if (error) {
      const code = (error as any).code as string | undefined;
      if (code === "23505") {
        const { data: existing } = await supabase
          .from("dtr_entries")
          .select("id")
          .eq("employee_id", session.user.id)
          .eq("work_date", data.work_date)
          .maybeSingle();
        return {
          error: `Duplicate DTR blocked: an entry already exists for ${data.work_date}. Open the existing record instead of creating another.`,
          id: existing?.id,
          field: "work_date",
        };
      }
      return { error: error.message };
    }
  } else {
    const { data: inserted, error } = await supabase
      .from("dtr_entries")
      .insert({
        employee_id: session.user.id,
        week_start: data.week_start,
        week_end: data.week_end,
        work_date: data.work_date,
        start_time: data.start_time,
        end_time: data.end_time,
        project_account: data.project_account,
        project_id: data.project_id,
        notes: data.notes,
        image_link: normalizedImageLink,
        duration_minutes: duration,
        status: "draft",
      })
      .select("id")
      .single();
    if (error) {
      const code = (error as any).code as string | undefined;
      if (code === "23505") {
        const { data: existing } = await supabase
          .from("dtr_entries")
          .select("id")
          .eq("employee_id", session.user.id)
          .eq("work_date", data.work_date)
          .maybeSingle();
        return {
          error: `Duplicate DTR blocked: an entry already exists for ${data.work_date}. Open the existing record instead of creating another.`,
          id: existing?.id,
          field: "work_date",
        };
      }
      return { error: error.message };
    }
    if (!inserted) return { error: "Insert failed" };
    entryId = inserted.id;
  }

  if (submit && entryId) {
    const { error } = await supabase
      .from("dtr_entries")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", entryId);
    if (error) return { error: error.message };

    await createNotification({
      user_id: session.user.id,
      title: "DTR submitted",
      message: `DTR for ${data.work_date} submitted.`,
      type: "dtr_submitted",
      link: `/dtr/${entryId}`,
    });
    await notifyManagers({
      title: `${employeeName} submitted DTR`,
      message: `${employeeName} submitted a DTR for ${data.work_date}.`,
      type: "dtr_submitted",
      link: `/dtr/${entryId}`,
    });
    await logAudit({
      action: "dtr_submitted",
      target_type: "dtr_entry",
      target_id: entryId,
      metadata: { work_date: data.work_date },
    });
  } else {
    await createNotification({
      user_id: session.user.id,
      title: "DTR draft saved",
      message: `Draft for ${data.work_date} saved.`,
      type: "dtr_draft",
      link: `/dtr/${entryId}`,
    });
    await logAudit({
      action: "dtr_saved",
      target_type: "dtr_entry",
      target_id: entryId ?? undefined,
      metadata: { work_date: data.work_date },
    });
  }

  revalidatePath("/dtr");
  if (entryId) revalidatePath(`/dtr/${entryId}`);
  revalidatePath("/dashboard");
  return { success: submit ? "DTR submitted" : "DTR saved", id: entryId };
}
