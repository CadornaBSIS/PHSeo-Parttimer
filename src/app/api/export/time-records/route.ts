import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getManagerTimeRecordsAction } from "@/features/timeclock/actions";

export const runtime = "nodejs";

function formatMinutes(totalMinutes: number) {
  const minutes = Math.max(0, totalMinutes);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  if (!m) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatManilaTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("en-US", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function isValidYmd(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();
  if (profile?.role !== "manager") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const dateParam = req.nextUrl.searchParams.get("date");
  const weekStartParam = req.nextUrl.searchParams.get("week_start");

  const mode = weekStartParam ? "week" : "day";

  if (mode === "day") {
    const date = dateParam ?? undefined;
    const result = await getManagerTimeRecordsAction(date, { includeManagers: true });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    const workDate = result.data?.work_date ?? "time-records";
    const rows = (result.data?.rows ?? []).map((row) => ({
      Date: workDate,
      Employee: row.employee_name,
      Attendance: row.attendance,
      "Schedule status": row.schedule_status,
      "Time in": formatManilaTime(row.first_time_in),
      "Time out": formatManilaTime(row.last_time_out),
      Sessions: row.sessions,
      "Worked (hh:mm)": formatMinutes(row.worked_minutes_completed),
      "Worked minutes": row.worked_minutes_completed,
      "DTR text": row.dtr_text ?? "",
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Time records");

    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
    const filename = `time-records-${workDate}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  }

  if (!weekStartParam || !isValidYmd(weekStartParam)) {
    return NextResponse.json({ error: "Missing or invalid week_start (YYYY-MM-DD)" }, { status: 400 });
  }

  const weekStartDate = startOfWeek(parseISO(weekStartParam), { weekStartsOn: 1 });
  const weekStart = format(weekStartDate, "yyyy-MM-dd");
  const dates = Array.from({ length: 7 }, (_, idx) => format(addDays(weekStartDate, idx), "yyyy-MM-dd"));

  const { data: employees, error: empError } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("role", ["employee", "manager"])
    .eq("status", "active")
    .order("full_name", { ascending: true });
  if (empError) return NextResponse.json({ error: empError.message }, { status: 500 });

  const employeeIds = (employees ?? []).map((e) => e.id);
  if (!employeeIds.length) {
    return NextResponse.json({ error: "No employees found" }, { status: 404 });
  }

  const weekEnd = dates[dates.length - 1]!;

  const { data: sessions, error: sessionError } = await supabase
    .from("time_log_sessions")
    .select("employee_id, work_date, time_in, time_out, end_reason")
    .gte("work_date", weekStart)
    .lte("work_date", weekEnd)
    .in("employee_id", employeeIds)
    .order("time_in", { ascending: true });
  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });

  const { data: dtrs } = await supabase
    .from("dtr_entries")
    .select("employee_id, work_date, notes")
    .gte("work_date", weekStart)
    .lte("work_date", weekEnd)
    .in("employee_id", employeeIds);

  const { data: scheduleDays } = await supabase
    .from("schedule_days")
    .select("work_date, work_status, schedules(employee_id)")
    .gte("work_date", weekStart)
    .lte("work_date", weekEnd);

  const scheduleByEmpDate = (scheduleDays ?? []).reduce<Record<string, Record<string, string>>>((acc, row) => {
    const schedule = (row as any).schedules;
    const employeeId =
      schedule && Array.isArray(schedule) ? schedule[0]?.employee_id : schedule?.employee_id;
    if (!employeeId) return acc;
    acc[employeeId] ??= {};
    acc[employeeId]![row.work_date] = row.work_status ?? "working";
    return acc;
  }, {});

  const dtrByEmpDate = (dtrs ?? []).reduce<Record<string, Record<string, string>>>((acc, row) => {
    if (!row.employee_id) return acc;
    acc[row.employee_id] ??= {};
    acc[row.employee_id]![row.work_date] = (row.notes ?? "").trim();
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

  const outRows = [];
  const summaryByEmployee = new Map<
    string,
    { employee: string; minutes: number; scheduledWorkingDays: number; absentDays: number; timedOutDays: number }
  >();

  const headers = [
    "Date",
    "Employee",
    "Attendance",
    "Schedule status",
    "Time in",
    "Time out",
    "Sessions",
    "Worked (hh:mm)",
    "Worked minutes",
    "DTR text",
  ];

  const weekAoa: (string | number)[][] = [];

  for (const date of dates) {
    weekAoa.push([`Date: ${date}`]);
    weekAoa.push(headers);
    for (const employee of employees ?? []) {
      const list = sessionsByEmpDate[employee.id]?.[date] ?? [];
      const first = list[0] ?? null;
      const last = list.length ? list[list.length - 1] : null;
      const open = list.find((s) => !s.time_out) ?? null;
      const breakUsed = list.some((s) => s.end_reason === "break");
      const dayEnded = list.some((s) => s.end_reason === "day_end");
      const scheduleStatus = scheduleByEmpDate[employee.id]?.[date] ?? "no_schedule";

      const workedMinutes = list.reduce((acc, s) => {
        if (!s.time_out) return acc;
        const start = new Date(s.time_in).getTime();
        const end = new Date(s.time_out).getTime();
        return acc + Math.max(0, Math.round((end - start) / 60000));
      }, 0);

      let attendance = "no_record";
      if (scheduleStatus === "no_schedule") attendance = "no_schedule";
      else if (scheduleStatus !== "working") attendance = "not_working";
      else if (open) attendance = "working";
      else if (dayEnded) attendance = "timed_out";
      else if (breakUsed) attendance = "on_break";
      else if (!list.length && scheduleStatus === "working") attendance = "absent";

      const employeeName = employee.full_name ?? "Employee";
      const dtrText = dtrByEmpDate[employee.id]?.[date] ?? "";

      outRows.push({
        Date: date,
        Employee: employeeName,
        Attendance: attendance,
        "Schedule status": scheduleStatus,
        "Time in": formatManilaTime(first?.time_in ?? null),
        "Time out": formatManilaTime(last?.time_out ?? null),
        Sessions: list.length,
        "Worked (hh:mm)": formatMinutes(workedMinutes),
        "Worked minutes": workedMinutes,
        "DTR text": dtrText,
      });

      weekAoa.push([
        date,
        employeeName,
        attendance,
        scheduleStatus,
        formatManilaTime(first?.time_in ?? null),
        formatManilaTime(last?.time_out ?? null),
        list.length,
        formatMinutes(workedMinutes),
        workedMinutes,
        dtrText,
      ]);

      const summary =
        summaryByEmployee.get(employee.id) ?? {
          employee: employeeName,
          minutes: 0,
          scheduledWorkingDays: 0,
          absentDays: 0,
          timedOutDays: 0,
        };
      summary.minutes += workedMinutes;
      if (scheduleStatus === "working") summary.scheduledWorkingDays += 1;
      if (attendance === "absent") summary.absentDays += 1;
      if (attendance === "timed_out") summary.timedOutDays += 1;
      summaryByEmployee.set(employee.id, summary);
    }
    weekAoa.push([]);
  }

  const workbook = XLSX.utils.book_new();
  const summaryRows = Array.from(summaryByEmployee.values())
    .sort((a, b) => a.employee.localeCompare(b.employee))
    .map((item) => ({
      Employee: item.employee,
      "Total worked (hh:mm)": formatMinutes(item.minutes),
      "Total minutes": item.minutes,
      "Scheduled working days": item.scheduledWorkingDays,
      "Absent days": item.absentDays,
      "Timed out days": item.timedOutDays,
    }));

  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  const weekSheet = XLSX.utils.aoa_to_sheet(weekAoa);
  XLSX.utils.book_append_sheet(workbook, weekSheet, "Week");

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
  const filename = `time-records-week-${weekStart}-to-${weekEnd}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
