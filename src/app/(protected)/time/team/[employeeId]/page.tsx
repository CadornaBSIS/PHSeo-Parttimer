import { redirect, notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { TimeRecordHistory } from "@/features/timeclock/components/time-record-history";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatManilaTime(value: string) {
  return new Date(value).toLocaleTimeString("en-US", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatMinutes(totalMinutes: number) {
  const minutes = Math.max(0, totalMinutes);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  if (!m) return `${h}h`;
  return `${h}h ${m}m`;
}

export default async function ManagerEmployeeTimeLogsPage({
  params,
  searchParams,
}: {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const profile = await requireProfile();
  if (profile.role !== "manager") redirect("/time");

  const { employeeId } = await params;
  const { date } = await searchParams;
  const workDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;

  const supabase = await createServerSupabaseClient();
  const { data: employee } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", employeeId)
    .maybeSingle();
  if (!employee) notFound();

  const effectiveDate =
    workDate ??
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

  const { data: sessions } = await supabase
    .from("time_log_sessions")
    .select("id, time_in, time_out, end_reason")
    .eq("employee_id", employeeId)
    .eq("work_date", effectiveDate)
    .order("time_in", { ascending: true });

  const workedMinutesCompleted = (sessions ?? []).reduce((acc, s) => {
    if (!s.time_out) return acc;
    const start = new Date(s.time_in).getTime();
    const end = new Date(s.time_out).getTime();
    return acc + Math.max(0, Math.floor((end - start) / 60000));
  }, 0);

  const { data: dtr } = await supabase
    .from("dtr_entries")
    .select("id, status, notes, project_account")
    .eq("employee_id", employeeId)
    .eq("work_date", effectiveDate)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${employee.full_name ?? "Employee"} - Time Record`}
        description={`Work date: ${effectiveDate}`}
        userId={profile.id}
      />

      <div className="card">
        <TimeRecordHistory
          employeeId={employeeId}
          detailHrefBase={`/time/team/${employeeId}`}
          title="Time record history"
          description="Browse weekly time records, then open a specific day for details."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sessions</CardTitle>
            <p className="text-sm text-slate-500">
              Total (completed): {formatMinutes(workedMinutesCompleted)}
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {(sessions ?? []).length ? (
              (sessions ?? []).map((s, idx) => (
                <div
                  key={s.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">Session {idx + 1}</p>
                    {s.end_reason ? (
                      <Badge variant={s.end_reason === "break" ? "warning" : "secondary"}>
                        {s.end_reason === "break" ? "Break" : "Day end"}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatManilaTime(s.time_in)} → {s.time_out ? formatManilaTime(s.time_out) : "(ongoing)"}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No time logs for this date.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>DTR text</CardTitle>
            <p className="text-sm text-slate-500">
              {dtr ? `Status: ${dtr.status}` : "No DTR entry for this date."}
            </p>
          </CardHeader>
          <CardContent>
            {dtr?.notes?.trim() ? (
              <pre className="whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
                {dtr.notes.trim()}
              </pre>
            ) : (
              <p className="text-sm text-slate-500">No notes provided.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
