import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/common/status-badge";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import { formatMinutes, formatWeekRange } from "@/utils/date";
import { DtrStatus, ScheduleStatus } from "@/types/db";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  if (profile.role !== "manager") notFound();

  let employeeError: string | null = null;
  let scheduleError: string | null = null;
  let dtrError: string | null = null;

  const supabase = await createServiceSupabaseClient();
  const { data: employee, error: empErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();
  if (empErr) employeeError = empErr.message;
  if (!employee) notFound();

  const { data: schedules, error: schedErr } = await supabase
    .from("schedules")
    .select("id, week_start, week_end, status, submitted_at")
    .eq("employee_id", employee?.id)
    .order("week_start", { ascending: false })
    .limit(10);
  if (schedErr) scheduleError = schedErr.message;

  const { data: dtrs, error: dtrErr } = await supabase
    .from("dtr_entries")
    .select("id, week_start, week_end, work_date, status, duration_minutes")
    .eq("employee_id", employee?.id)
    .order("work_date", { ascending: false })
    .limit(20);
  if (dtrErr) dtrError = dtrErr.message;

  type ScheduleRow = {
    id: string;
    week_start: string;
    week_end?: string | null;
    status: ScheduleStatus;
    submitted_at: string | null;
  };

  type DtrRow = {
    id: string;
    week_start?: string | null;
    week_end?: string | null;
    work_date: string;
    status: DtrStatus;
    duration_minutes: number;
  };

  type WeekBucket = {
    week_start: string;
    week_end?: string | null;
    schedule?: ScheduleRow;
    dtrCount: number;
    dtrMinutes: number;
  };

  const weekMap = new Map<string, WeekBucket>();

  ((schedules as ScheduleRow[] | null) ?? []).forEach((s) => {
    weekMap.set(s.week_start, {
      week_start: s.week_start,
      week_end: s.week_end,
      schedule: s,
      dtrCount: 0,
      dtrMinutes: 0,
    });
  });

  ((dtrs as DtrRow[] | null) ?? []).forEach((d) => {
    const key = d.week_start ?? d.work_date ?? "unknown";
    const bucket = weekMap.get(key) ?? {
      week_start: d.week_start ?? key,
      week_end: d.week_end,
      dtrCount: 0,
      dtrMinutes: 0,
    };
    bucket.dtrCount += 1;
    bucket.dtrMinutes += d.duration_minutes ?? 0;
    weekMap.set(key, bucket);
  });

  const weekSummaries = Array.from(weekMap.values()).sort((a, b) =>
    a.week_start < b.week_start ? 1 : -1,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={employee.full_name}
        description={`${employee.role} - ${employee.email}`}
        userId={profile.id}
      />

      {employeeError || scheduleError || dtrError ? (
        <Card>
          <CardHeader>
            <CardTitle>Data load issues</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-red-600">
            {employeeError ? <p>Employee: {employeeError}</p> : null}
            {scheduleError ? <p>Schedules: {scheduleError}</p> : null}
            {dtrError ? <p>DTR: {dtrError}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Weekly summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="hidden sm:block overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Week</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>DTR entries</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {weekSummaries.map((w) => (
                  <TableRow key={w.week_start}>
                    <TableCell>{formatWeekRange(w.week_start)}</TableCell>
                    <TableCell>
                      {w.schedule ? (
                        <StatusBadge status={w.schedule.status} />
                      ) : (
                        <span className="text-xs text-slate-500">No schedule</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {w.dtrCount ? (
                        <span className="text-sm font-medium">
                          {w.dtrCount} entries - {formatMinutes(w.dtrMinutes)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">No DTR</span>
                      )}
                    </TableCell>
                    <TableCell className="space-x-3 whitespace-nowrap">
                      {w.schedule ? (
                        <Link
                          className="text-sm font-semibold text-accent hover:underline"
                          href={`/schedule/${w.schedule.id}`}
                        >
                          View schedule
                        </Link>
                      ) : null}
                      {w.dtrCount ? (
                        <Link
                          className="text-sm font-semibold text-blue-600 hover:underline"
                          href={`/employees/${employee.id}/dtr?week_start=${w.week_start}`}
                        >
                          View DTR
                        </Link>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
                {!weekSummaries.length ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-sm text-slate-500">
                      No weekly data yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 sm:hidden">
            {weekSummaries.map((w) => (
              <div
                key={w.week_start}
                className="rounded-xl border border-border bg-card p-4 shadow-card space-y-3"
              >
                <div className="text-sm font-semibold text-slate-900">
                  {formatWeekRange(w.week_start)}
                </div>
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Schedule</span>
                  {w.schedule ? (
                    <StatusBadge status={w.schedule.status} />
                  ) : (
                    <span className="text-xs text-slate-500">No schedule</span>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>DTR entries</span>
                  {w.dtrCount ? (
                    <span className="text-sm font-medium text-slate-900">
                      {w.dtrCount} • {formatMinutes(w.dtrMinutes)}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">No DTR</span>
                  )}
                </div>
                <div className="flex items-center justify-end gap-3">
                  {w.schedule ? (
                    <Link
                      className="text-sm font-semibold text-accent hover:underline"
                      href={`/schedule/${w.schedule.id}`}
                    >
                      View schedule
                    </Link>
                  ) : null}
                  {w.dtrCount ? (
                    <Link
                      className="text-sm font-semibold text-blue-600 hover:underline"
                      href={`/employees/${employee.id}/dtr?week_start=${w.week_start}`}
                    >
                      View DTR
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
            {!weekSummaries.length ? (
              <div className="rounded-xl border border-border bg-card p-4 text-sm text-slate-500">
                No weekly data yet.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent schedules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="hidden sm:block overflow-x-auto">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Week</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(schedules ?? []).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{formatWeekRange(s.week_start)}</TableCell>
                      <TableCell>
                        <StatusBadge status={s.status} />
                      </TableCell>
                      <TableCell>
                        {s.submitted_at
                          ? new Date(s.submitted_at).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Link
                          className="text-sm font-semibold text-accent hover:underline"
                          href={`/schedule/${s.id}`}
                        >
                          View
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!schedules?.length ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-sm text-slate-500">
                        No schedules yet.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-3 sm:hidden">
              {(schedules ?? []).map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-card space-y-2"
                >
                  <div className="text-sm font-semibold text-slate-900">
                    {formatWeekRange(s.week_start)}
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>Status</span>
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>Submitted</span>
                    <span className="text-sm font-medium text-slate-900">
                      {s.submitted_at
                        ? new Date(s.submitted_at).toLocaleDateString()
                        : "-"}
                    </span>
                  </div>
                  <div className="flex justify-end">
                    <Link
                      className="text-sm font-semibold text-accent hover:underline"
                      href={`/schedule/${s.id}`}
                    >
                      View
                    </Link>
                  </div>
                </div>
              ))}
              {!schedules?.length ? (
                <div className="rounded-xl border border-border bg-card p-4 text-sm text-slate-500">
                  No schedules yet.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent DTR</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="hidden sm:block overflow-x-auto">
              <Table className="min-w-[560px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(dtrs ?? []).map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{d.work_date}</TableCell>
                      <TableCell>
                        <StatusBadge status={d.status} />
                      </TableCell>
                      <TableCell>{formatMinutes(d.duration_minutes)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Link
                          className="text-sm font-semibold text-blue-600 hover:underline"
                          href={`/dtr/${d.id}`}
                        >
                          View
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!dtrs?.length ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-sm text-slate-500">
                        No DTR entries.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-3 sm:hidden">
              {(dtrs ?? []).map((d) => (
                <div
                  key={d.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-card space-y-2"
                >
                  <div className="text-sm font-semibold text-slate-900">
                    {d.work_date}
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>Status</span>
                    <StatusBadge status={d.status} />
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>Duration</span>
                    <span className="text-sm font-medium text-slate-900">
                      {formatMinutes(d.duration_minutes)}
                    </span>
                  </div>
                  <div className="flex justify-end">
                    <Link
                      className="text-sm font-semibold text-blue-600 hover:underline"
                      href={`/dtr/${d.id}`}
                    >
                      View
                    </Link>
                  </div>
                </div>
              ))}
              {!dtrs?.length ? (
                <div className="rounded-xl border border-border bg-card p-4 text-sm text-slate-500">
                  No DTR entries.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
