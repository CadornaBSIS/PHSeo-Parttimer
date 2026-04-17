"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

function manilaDateParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  const yyyy = parts.year;
  const mm = parts.month;
  const dd = parts.day;
  return `${yyyy}-${mm}-${dd}`;
}

function manilaTimeHHmm(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
  return `${parts.hour}:${parts.minute}`;
}

export type TimeClockStatus = {
  today: string;
  hasScheduleForToday: boolean;
  scheduleMessage?: string;
  hasDtrForToday: boolean;
  breakUsed: boolean;
  dayEnded: boolean;
  openSessionId: string | null;
  openTimeIn: string | null;
  latestTimeOut: string | null;
  totalWorkedMinutes: number;
  sessions: Array<{ id: string; time_in: string; time_out: string | null; end_reason: string | null }>;
};

export type ManagerTimeRecordRow = {
  employee_id: string;
  employee_name: string;
  schedule_status: string;
  attendance: "working" | "on_break" | "timed_out" | "absent" | "no_record" | "not_working" | "no_schedule";
  first_time_in: string | null;
  last_time_out: string | null;
  open_time_in: string | null;
  sessions: number;
  worked_minutes_completed: number;
  dtr_text: string | null;
};

export async function getManagerTimeRecordsAction(
  workDate?: string,
  options?: { includeManagers?: boolean },
): Promise<ActionResult<{
  work_date: string;
  rows: ManagerTimeRecordRow[];
}>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "Unauthenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();
  if (profile?.role !== "manager") return { ok: false, error: "Forbidden" };

  const date = (workDate && /^\d{4}-\d{2}-\d{2}$/.test(workDate) ? workDate : manilaDateParts());

  const includeManagers = options?.includeManagers ?? false;
  const roles = includeManagers ? (["employee", "manager"] as const) : (["employee"] as const);

  const { data: employees, error: empError } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("role", roles as unknown as string[])
    .eq("status", "active")
    .order("full_name", { ascending: true });
  if (empError) return { ok: false, error: empError.message };

  const employeeIds = (employees ?? []).map((e) => e.id);
  if (!employeeIds.length) return { ok: true, data: { work_date: date, rows: [] } };

  const { data: scheduleDays } = await supabase
    .from("schedule_days")
    .select("work_status, schedules(employee_id)")
    .eq("work_date", date);

  const scheduleStatusByEmployee = (scheduleDays ?? []).reduce<Record<string, string>>((acc, row) => {
    const schedule = (row as any).schedules;
    const employeeId =
      schedule && Array.isArray(schedule) ? schedule[0]?.employee_id : schedule?.employee_id;
    if (!employeeId) return acc;
    acc[employeeId] = row.work_status ?? "working";
    return acc;
  }, {});

  const { data: sessions, error: sessionError } = await supabase
    .from("time_log_sessions")
    .select("employee_id, time_in, time_out, end_reason")
    .eq("work_date", date)
    .in("employee_id", employeeIds)
    .order("time_in", { ascending: true });
  if (sessionError) return { ok: false, error: sessionError.message };

  const { data: dtrs } = await supabase
    .from("dtr_entries")
    .select("employee_id, notes")
    .eq("work_date", date)
    .in("employee_id", employeeIds);

  const dtrTextByEmployee = (dtrs ?? []).reduce<Record<string, string>>((acc, row) => {
    if (!row.employee_id) return acc;
    acc[row.employee_id] = (row.notes ?? "").trim();
    return acc;
  }, {});

  const byEmployee = (sessions ?? []).reduce<
    Record<
      string,
      Array<{ time_in: string; time_out: string | null; end_reason: string | null }>
    >
  >((acc, row) => {
    const list = acc[row.employee_id] ?? [];
    list.push({ time_in: row.time_in, time_out: row.time_out ?? null, end_reason: row.end_reason ?? null });
    acc[row.employee_id] = list;
    return acc;
  }, {});

  const rows: ManagerTimeRecordRow[] = (employees ?? []).map((employee) => {
    const list = byEmployee[employee.id] ?? [];
    const first = list[0] ?? null;
    const last = list.length ? list[list.length - 1] : null;
    const open = list.find((s) => !s.time_out) ?? null;
    const breakUsed = list.some((s) => s.end_reason === "break");
    const dayEnded = list.some((s) => s.end_reason === "day_end");
    const scheduleStatus = scheduleStatusByEmployee[employee.id] ?? "no_schedule";

    const workedMinutesCompleted = list.reduce((acc, s) => {
      if (!s.time_out) return acc;
      const start = new Date(s.time_in).getTime();
      const end = new Date(s.time_out).getTime();
      return acc + Math.max(0, Math.round((end - start) / 60000));
    }, 0);

    let attendance: ManagerTimeRecordRow["attendance"] = "no_record";
    if (scheduleStatus === "no_schedule") attendance = "no_schedule";
    else if (scheduleStatus !== "working") attendance = "not_working";
    else if (open) attendance = "working";
    else if (dayEnded) attendance = "timed_out";
    else if (breakUsed) attendance = "on_break";
    else if (!list.length && (scheduleStatus === "working")) attendance = "absent";

    return {
      employee_id: employee.id,
      employee_name: employee.full_name ?? "Employee",
      schedule_status: scheduleStatus,
      attendance,
      first_time_in: first?.time_in ?? null,
      last_time_out: last?.time_out ?? null,
      open_time_in: open?.time_in ?? null,
      sessions: list.length,
      worked_minutes_completed: workedMinutesCompleted,
      dtr_text: dtrTextByEmployee[employee.id] ?? null,
    };
  });

  return { ok: true, data: { work_date: date, rows } };
}

async function getTodayStatusInternal(): Promise<ActionResult<TimeClockStatus>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "Unauthenticated" };

  const today = manilaDateParts();

  const { data: schedule } = await supabase
    .from("schedules")
    .select("id, week_start, week_end")
    .eq("employee_id", session.user.id)
    .lte("week_start", today)
    .gte("week_end", today)
    .maybeSingle();

  let hasScheduleForToday = false;
  let scheduleMessage: string | undefined;
  if (!schedule) {
    hasScheduleForToday = false;
    scheduleMessage = "No schedule found for this week.";
  } else {
    const { data: scheduleDay } = await supabase
      .from("schedule_days")
      .select("work_status")
      .eq("schedule_id", schedule.id)
      .eq("work_date", today)
      .maybeSingle();

    if (!scheduleDay) {
      hasScheduleForToday = false;
      scheduleMessage = "No schedule day found for today.";
    } else if (scheduleDay.work_status !== "working") {
      hasScheduleForToday = false;
      scheduleMessage = "You are not scheduled as working today.";
    } else {
      hasScheduleForToday = true;
    }
  }

  const { data: dtr } = await supabase
    .from("dtr_entries")
    .select("id")
    .eq("employee_id", session.user.id)
    .eq("work_date", today)
    .maybeSingle();

  const { data: sessions } = await supabase
    .from("time_log_sessions")
    .select("id, time_in, time_out, end_reason")
    .eq("employee_id", session.user.id)
    .eq("work_date", today)
    .order("time_in", { ascending: true });

  const open = (sessions ?? []).find((s) => !s.time_out) ?? null;
  const last = (sessions ?? []).length ? (sessions ?? [])[(sessions ?? []).length - 1] : null;
  const breakUsed = (sessions ?? []).some((s) => s.end_reason === "break");
  const dayEnded = (sessions ?? []).some((s) => s.end_reason === "day_end");

  const totalWorkedMinutes = (sessions ?? []).reduce((acc, sessionRow) => {
    if (!sessionRow.time_out) return acc;
    const start = new Date(sessionRow.time_in).getTime();
    const end = new Date(sessionRow.time_out).getTime();
    const minutes = Math.max(0, Math.floor((end - start) / 60000));
    return acc + minutes;
  }, 0);

  return {
    ok: true,
    data: {
      today,
      hasScheduleForToday,
      scheduleMessage,
      hasDtrForToday: Boolean(dtr),
      breakUsed,
      dayEnded,
      openSessionId: open?.id ?? null,
      openTimeIn: open?.time_in ?? null,
      latestTimeOut: last?.time_out ?? null,
      totalWorkedMinutes,
      sessions: (sessions ?? []).map((s) => ({
        id: s.id,
        time_in: s.time_in,
        time_out: s.time_out,
        end_reason: s.end_reason ?? null,
      })),
    },
  };
}

export async function getTimeClockStatusAction(): Promise<ActionResult<TimeClockStatus>> {
  return getTodayStatusInternal();
}

export async function timeInAction(): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "Unauthenticated" };

  const status = await getTodayStatusInternal();
  if (!status.ok) return status;
  const today = status.data!.today;

  if (status.data!.dayEnded) {
    return { ok: false, error: "You already timed out for today." };
  }

  if (!status.data!.hasScheduleForToday) {
    return {
      ok: false,
      error: `Cannot time in. ${status.data!.scheduleMessage ?? "Create a schedule first."}`,
    };
  }

  if (status.data!.openSessionId) {
    return { ok: false, error: "You are already timed in." };
  }

  const now = new Date();
  const { error: insertError } = await supabase.from("time_log_sessions").insert({
    employee_id: session.user.id,
    work_date: today,
    time_in: now.toISOString(),
  });
  if (insertError) return { ok: false, error: insertError.message };

  // If a DTR draft already exists, help-fill its start_time.
  const { data: dtr } = await supabase
    .from("dtr_entries")
    .select("id, start_time")
    .eq("employee_id", session.user.id)
    .eq("work_date", today)
    .maybeSingle();
  if (dtr?.id && !dtr.start_time) {
    await supabase
      .from("dtr_entries")
      .update({ start_time: manilaTimeHHmm(now) })
      .eq("id", dtr.id);
  }

  revalidatePath("/time");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function startBreakAction(): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "Unauthenticated" };

  const status = await getTodayStatusInternal();
  if (!status.ok) return status;
  const today = status.data!.today;

  if (status.data!.dayEnded) {
    return { ok: false, error: "You already timed out for today." };
  }
  if (status.data!.breakUsed) {
    return { ok: false, error: "Break already used for today." };
  }
  if (!status.data!.openSessionId || !status.data!.openTimeIn) {
    return { ok: false, error: "You are not currently timed in." };
  }

  const now = new Date();
  const { error: updateError } = await supabase
    .from("time_log_sessions")
    .update({ time_out: now.toISOString(), end_reason: "break" })
    .eq("id", status.data!.openSessionId);
  if (updateError) return { ok: false, error: updateError.message };

  revalidatePath("/time");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function endDayAction(): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "Unauthenticated" };

  const status = await getTodayStatusInternal();
  if (!status.ok) return status;
  const today = status.data!.today;

  if (status.data!.dayEnded) {
    return { ok: false, error: "You already timed out for today." };
  }
  if (!status.data!.openSessionId || !status.data!.openTimeIn) {
    return { ok: false, error: "You are not currently timed in." };
  }

  const { data: dtr } = await supabase
    .from("dtr_entries")
    .select("id, start_time, end_time")
    .eq("employee_id", session.user.id)
    .eq("work_date", today)
    .maybeSingle();

  if (!dtr) {
    return { ok: false, error: "Cannot time out. Create a DTR entry for today first." };
  }

  const now = new Date();
  const { error: updateError } = await supabase
    .from("time_log_sessions")
    .update({ time_out: now.toISOString(), end_reason: "day_end" })
    .eq("id", status.data!.openSessionId);
  if (updateError) return { ok: false, error: updateError.message };

  // Help-fill DTR times.
  const updates: { start_time?: string; end_time?: string } = {};
  if (!dtr.start_time) updates.start_time = manilaTimeHHmm(new Date(status.data!.openTimeIn));
  if (!dtr.end_time) updates.end_time = manilaTimeHHmm(now);
  if (Object.keys(updates).length) {
    await supabase.from("dtr_entries").update(updates).eq("id", dtr.id);
  }

  revalidatePath("/time");
  revalidatePath("/dashboard");
  return { ok: true };
}
