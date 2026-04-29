"use server";

import { revalidatePath } from "next/cache";
import { format, parseISO, subDays } from "date-fns";
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

type ScheduleRelation = { employee_id?: string | null } | Array<{ employee_id?: string | null }> | null;

function getScheduledEmployeeId(schedule: ScheduleRelation) {
  return Array.isArray(schedule) ? schedule[0]?.employee_id ?? null : schedule?.employee_id ?? null;
}

export type TimeClockStatus = {
  today: string;
  hasScheduleForWeek: boolean;
  hasScheduleForToday: boolean;
  todayWorkStatus: "working" | "day_off" | "leave" | "holiday" | "requested" | null;
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
  attendance: AttendanceStatus;
  first_time_in: string | null;
  last_time_out: string | null;
  open_time_in: string | null;
  sessions: number;
  worked_minutes_completed: number;
  dtr_text: string | null;
};

type AttendanceStatus =
  | "working"
  | "on_break"
  | "timed_out"
  | "absent"
  | "no_record"
  | "not_working"
  | "no_schedule";

export type TimeRecordHistoryRow = {
  work_date: string;
  attendance: AttendanceStatus;
  first_time_in: string | null;
  last_time_out: string | null;
  open_time_in: string | null;
  sessions: number;
  worked_minutes_completed: number;
  dtr_id: string | null;
  dtr_text: string | null;
};

export type TeamTimeRecordHistoryRow = TimeRecordHistoryRow & {
  employee_id: string;
  employee_name: string;
  schedule_status: string;
};

export async function getTimeRecordHistoryAction(options?: {
  employeeId?: string;
  limitDays?: number;
}): Promise<ActionResult<TimeRecordHistoryRow[]>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "Unauthenticated" };

  const targetEmployeeId = options?.employeeId ?? session.user.id;
  if (targetEmployeeId !== session.user.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();
    if (profile?.role !== "manager") return { ok: false, error: "Forbidden" };
  }

  const manilaToday = manilaDateParts();
  const limitDays = Math.min(Math.max(7, options?.limitDays ?? 90), 365);
  const cutoff = format(subDays(parseISO(manilaToday), limitDays), "yyyy-MM-dd");

  const { data: sessions, error } = await supabase
    .from("time_log_sessions")
    .select("work_date, time_in, time_out, end_reason")
    .eq("employee_id", targetEmployeeId)
    .gte("work_date", cutoff)
    .order("work_date", { ascending: false })
    .order("time_in", { ascending: true });
  if (error) return { ok: false, error: error.message };

  const sessionsByDate = (sessions ?? []).reduce<
    Record<string, Array<{ time_in: string; time_out: string | null; end_reason: string | null }>>
  >((acc, row) => {
    const date = row.work_date;
    if (!date) return acc;
    acc[date] ??= [];
    acc[date]!.push({
      time_in: row.time_in,
      time_out: row.time_out ?? null,
      end_reason: row.end_reason ?? null,
    });
    return acc;
  }, {});

  const workDates = Object.keys(sessionsByDate);
  if (!workDates.length) return { ok: true, data: [] };

  const { data: dtrs } = await supabase
    .from("dtr_entries")
    .select("id, work_date, notes")
    .eq("employee_id", targetEmployeeId)
    .in("work_date", workDates);

  const dtrByDate = (dtrs ?? []).reduce<Record<string, { id: string; text: string }>>((acc, row) => {
    if (!row.work_date) return acc;
    acc[row.work_date] = { id: row.id, text: (row.notes ?? "").trim() };
    return acc;
  }, {});

  const rows: TimeRecordHistoryRow[] = workDates
    .sort((a, b) => b.localeCompare(a))
    .map((work_date) => {
      const list = sessionsByDate[work_date] ?? [];
      const first = list[0] ?? null;
      const last = list.length ? list[list.length - 1] : null;
      const open = list.find((s) => !s.time_out) ?? null;
      const dayEnded = list.some((s) => s.end_reason === "day_end");

      const workedMinutesCompleted = list.reduce((acc, s) => {
        if (!s.time_out) return acc;
        const start = new Date(s.time_in).getTime();
        const end = new Date(s.time_out).getTime();
        return acc + Math.max(0, Math.round((end - start) / 60000));
      }, 0);

      const attendance: TimeRecordHistoryRow["attendance"] = open
        ? "working"
        : dayEnded
          ? "timed_out"
          : last?.end_reason === "break"
            ? "on_break"
            : "timed_out";

      return {
        work_date,
        attendance,
        first_time_in: first?.time_in ?? null,
        last_time_out: last?.time_out ?? null,
        open_time_in: open?.time_in ?? null,
        sessions: list.length,
        worked_minutes_completed: workedMinutesCompleted,
        dtr_id: dtrByDate[work_date]?.id ?? null,
        dtr_text: dtrByDate[work_date]?.text ?? null,
      };
    });

  return { ok: true, data: rows };
}

export async function getTeamTimeRecordHistoryAction(options?: {
  limitDays?: number;
}): Promise<ActionResult<TeamTimeRecordHistoryRow[]>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "Unauthenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .maybeSingle();
  if (profile?.role !== "manager") return { ok: false, error: "Forbidden" };

  const limitDays = Math.min(Math.max(7, options?.limitDays ?? 90), 365);
  const manilaToday = manilaDateParts();
  const cutoff = format(subDays(parseISO(manilaToday), limitDays), "yyyy-MM-dd");

  const { data: employees, error: empError } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("role", ["employee", "manager"])
    .eq("status", "active")
    .order("full_name", { ascending: true });
  if (empError) return { ok: false, error: empError.message };

  const employeeIds = (employees ?? []).map((e) => e.id);
  if (!employeeIds.length) return { ok: true, data: [] };

  const { data: sessions, error: sessionError } = await supabase
    .from("time_log_sessions")
    .select("employee_id, work_date, time_in, time_out, end_reason")
    .gte("work_date", cutoff)
    .lte("work_date", manilaToday)
    .in("employee_id", employeeIds)
    .order("work_date", { ascending: false })
    .order("time_in", { ascending: true });
  if (sessionError) return { ok: false, error: sessionError.message };

  const { data: scheduleDays, error: scheduleError } = await supabase
    .from("schedule_days")
    .select("work_date, work_status, schedules(employee_id)")
    .gte("work_date", cutoff)
    .lte("work_date", manilaToday);
  if (scheduleError) return { ok: false, error: scheduleError.message };

  const { data: dtrs } = await supabase
    .from("dtr_entries")
    .select("id, employee_id, work_date, notes")
    .gte("work_date", cutoff)
    .lte("work_date", manilaToday)
    .in("employee_id", employeeIds);

  const dtrByEmpDate = (dtrs ?? []).reduce<Record<string, Record<string, { id: string; text: string }>>>((acc, row) => {
    if (!row.employee_id || !row.work_date) return acc;
    acc[row.employee_id] ??= {};
    acc[row.employee_id]![row.work_date] = { id: row.id, text: (row.notes ?? "").trim() };
    return acc;
  }, {});

  const sessionsByEmpDate = (sessions ?? []).reduce<
    Record<string, Record<string, Array<{ time_in: string; time_out: string | null; end_reason: string | null }>>>
  >((acc, row) => {
    acc[row.employee_id] ??= {};
    acc[row.employee_id]![row.work_date] ??= [];
    acc[row.employee_id]![row.work_date]!.push({
      time_in: row.time_in,
      time_out: row.time_out ?? null,
      end_reason: row.end_reason ?? null,
    });
    return acc;
  }, {});

  const scheduleStatusByEmpDate = (scheduleDays ?? []).reduce<Record<string, Record<string, string>>>((acc, row) => {
    const employeeId = getScheduledEmployeeId(row.schedules as ScheduleRelation);
    if (!employeeId || !row.work_date || !employeeIds.includes(employeeId)) return acc;
    acc[employeeId] ??= {};
    acc[employeeId]![row.work_date] = row.work_status ?? "working";
    return acc;
  }, {});

  const nameByEmployee = (employees ?? []).reduce<Record<string, string>>((acc, row) => {
    acc[row.id] = row.full_name ?? "Employee";
    return acc;
  }, {});

  const out: TeamTimeRecordHistoryRow[] = [];

  for (const employeeId of employeeIds) {
    const byDate = sessionsByEmpDate[employeeId] ?? {};
    const scheduleByDate = scheduleStatusByEmpDate[employeeId] ?? {};
    const dtrByDate = dtrByEmpDate[employeeId] ?? {};
    const dates = Array.from(
      new Set([...Object.keys(byDate), ...Object.keys(scheduleByDate), ...Object.keys(dtrByDate)]),
    )
      .filter((workDate) => workDate <= manilaToday)
      .sort((a, b) => b.localeCompare(a));
    for (const work_date of dates) {
      const list = byDate[work_date] ?? [];
      const first = list[0] ?? null;
      const last = list.length ? list[list.length - 1] : null;
      const open = list.find((s) => !s.time_out) ?? null;
      const breakUsed = list.some((s) => s.end_reason === "break");
      const dayEnded = list.some((s) => s.end_reason === "day_end");
      const scheduleStatus = scheduleByDate[work_date] ?? "no_schedule";
      const scheduledToWork = scheduleStatus === "working" || scheduleStatus === "requested";
      const isPastDate = work_date.localeCompare(manilaToday) < 0;
      const workedMinutesCompleted = list.reduce((acc, s) => {
        if (!s.time_out) return acc;
        const start = new Date(s.time_in).getTime();
        const end = new Date(s.time_out).getTime();
        return acc + Math.max(0, Math.round((end - start) / 60000));
      }, 0);

      let attendance: AttendanceStatus = "no_record";
      if (open) attendance = "working";
      else if (scheduleStatus === "no_schedule" && !list.length) attendance = "no_schedule";
      else if (!scheduledToWork) attendance = "not_working";
      else if (dayEnded) attendance = "timed_out";
      else if (breakUsed || last?.end_reason === "break") attendance = "on_break";
      else if (!list.length && scheduledToWork) attendance = isPastDate ? "absent" : "not_working";
      else attendance = "timed_out";

      out.push({
        employee_id: employeeId,
        employee_name: nameByEmployee[employeeId] ?? "Employee",
        schedule_status: scheduleStatus,
        work_date,
        attendance,
        first_time_in: first?.time_in ?? null,
        last_time_out: last?.time_out ?? null,
        open_time_in: open?.time_in ?? null,
        sessions: list.length,
        worked_minutes_completed: workedMinutesCompleted,
        dtr_id: dtrByDate[work_date]?.id ?? null,
        dtr_text: dtrByDate[work_date]?.text ?? null,
      });
    }
  }

  out.sort((a, b) => {
    const dateCmp = (b.work_date ?? "").localeCompare(a.work_date ?? "");
    if (dateCmp !== 0) return dateCmp;
    return a.employee_name.localeCompare(b.employee_name);
  });

  return { ok: true, data: out };
}

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
    const employeeId = getScheduledEmployeeId(row.schedules as ScheduleRelation);
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

  const manilaToday = manilaDateParts();
  const shouldIncludeCrossDayOpenSessions = date === manilaToday;
  const isPastDate = date.localeCompare(manilaToday) < 0;

  const { data: crossDayOpenSessions, error: openSessionError } = shouldIncludeCrossDayOpenSessions
    ? await supabase
        .from("time_log_sessions")
        .select("employee_id, work_date, time_in, time_out, end_reason")
        .is("time_out", null)
        .in("employee_id", employeeIds)
    : { data: null, error: null };
  if (openSessionError) return { ok: false, error: openSessionError.message };

  const openSessionByEmployee = (crossDayOpenSessions ?? []).reduce<
    Record<string, { time_in: string; time_out: string | null; end_reason: string | null }>
  >((acc, row) => {
    const current = acc[row.employee_id];
    const candidate = { time_in: row.time_in, time_out: null, end_reason: row.end_reason ?? null };
    if (!current) {
      acc[row.employee_id] = candidate;
      return acc;
    }
    if (new Date(candidate.time_in).getTime() > new Date(current.time_in).getTime()) {
      acc[row.employee_id] = candidate;
    }
    return acc;
  }, {});

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
    const crossDayOpen = openSessionByEmployee[employee.id] ?? null;
    const effectiveList = list.length ? list : crossDayOpen ? [crossDayOpen] : [];
    const first = effectiveList[0] ?? null;
    const last = effectiveList.length ? effectiveList[effectiveList.length - 1] : null;
    const open = effectiveList.find((s) => !s.time_out) ?? null;
    const breakUsed = effectiveList.some((s) => s.end_reason === "break");
    const dayEnded = effectiveList.some((s) => s.end_reason === "day_end");
    const scheduleStatus = scheduleStatusByEmployee[employee.id] ?? "no_schedule";
    const scheduledToWorkToday = scheduleStatus === "working" || scheduleStatus === "requested";

    const workedMinutesCompleted = effectiveList.reduce((acc, s) => {
      if (!s.time_out) return acc;
      const start = new Date(s.time_in).getTime();
      const end = new Date(s.time_out).getTime();
      return acc + Math.max(0, Math.round((end - start) / 60000));
    }, 0);

    let attendance: ManagerTimeRecordRow["attendance"] = "no_record";
    if (open) attendance = "working";
    else if (scheduleStatus === "no_schedule") attendance = "no_schedule";
    else if (!scheduledToWorkToday) attendance = "not_working";
    else if (dayEnded) attendance = "timed_out";
    else if (breakUsed) attendance = "on_break";
    else if (!effectiveList.length && scheduledToWorkToday) attendance = isPastDate ? "absent" : "not_working";

    return {
      employee_id: employee.id,
      employee_name: employee.full_name ?? "Employee",
      schedule_status: scheduleStatus,
      attendance,
      first_time_in: first?.time_in ?? null,
      last_time_out: last?.time_out ?? null,
      open_time_in: open?.time_in ?? null,
      sessions: effectiveList.length,
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

  const manilaToday = manilaDateParts();

  // Sessions can span midnight; always resolve an open session without filtering by date
  // so the active session doesn't "disappear" at 12:00 AM.
  const { data: openAnyDate } = await supabase
    .from("time_log_sessions")
    .select("id, work_date, time_in, time_out, end_reason")
    .eq("employee_id", session.user.id)
    .is("time_out", null)
    .order("time_in", { ascending: false })
    .limit(1)
    .maybeSingle();

  const today = openAnyDate?.work_date ?? manilaToday;

  const { data: schedule } = await supabase
    .from("schedules")
    .select("id, week_start, week_end")
    .eq("employee_id", session.user.id)
    .lte("week_start", today)
    .gte("week_end", today)
    .maybeSingle();

  const hasScheduleForWeek = Boolean(schedule);
  let hasScheduleForToday = false;
  let scheduleMessage: string | undefined;
  let todayWorkStatus: TimeClockStatus["todayWorkStatus"] = null;
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
    } else {
      todayWorkStatus = (scheduleDay.work_status ?? null) as TimeClockStatus["todayWorkStatus"];
      if (scheduleDay.work_status === "working" || scheduleDay.work_status === "requested") {
        hasScheduleForToday = true;
      } else {
        hasScheduleForToday = false;
        scheduleMessage =
          scheduleDay.work_status === "day_off"
            ? "Today is marked as Day off."
            : scheduleDay.work_status === "leave"
              ? "Today is marked as Leave."
              : scheduleDay.work_status === "holiday"
                ? "Today is marked as Holiday."
                : "You are not scheduled as working today.";
      }
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
      hasScheduleForWeek,
      hasScheduleForToday,
      todayWorkStatus,
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
