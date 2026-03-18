import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DtrForm } from "@/features/dtr/components/dtr-form";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import { formatMinutes, formatWeekRange } from "@/utils/date";
import { DtrStatus } from "@/types/db";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ week_start?: string }>;
};

type EmployeeRecord = {
  id: string;
  full_name: string;
  email: string;
};

type DtrRow = {
  id: string;
  work_date: string;
  week_start: string;
  week_end: string;
  start_time: string | null;
  end_time: string | null;
  project_account: string | null;
  project_id: string | null;
  notes: string | null;
  image_link: string | null;
  duration_minutes: number;
  status: DtrStatus;
};

export default async function EmployeeWeeklyDtrPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { week_start } = await searchParams;
  const profile = await requireProfile();

  if (profile.role !== "manager") notFound();
  if (!week_start) notFound();

  const supabase = await createServiceSupabaseClient();

  const [{ data: employee }, { data: projects }, { data: dtrs, error }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", id)
      .maybeSingle<EmployeeRecord>(),
    supabase.from("projects").select("id, name").eq("is_active", true),
    supabase
      .from("dtr_entries")
      .select(
        "id, work_date, week_start, week_end, start_time, end_time, project_account, project_id, notes, image_link, duration_minutes, status",
      )
      .eq("employee_id", id)
      .eq("week_start", week_start)
      .order("work_date", { ascending: true })
      .returns<DtrRow[]>(),
  ]);

  if (!employee) notFound();

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load weekly DTR entries: {error.message}
        </div>
      </div>
    );
  }

  const weekEnd = dtrs?.[0]?.week_end;
  const totalMinutes = (dtrs ?? []).reduce(
    (sum, entry) => sum + (entry.duration_minutes ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${employee.full_name} weekly DTR`}
        description={
          weekEnd
            ? `${formatWeekRange(week_start)} - ${employee.email}`
            : employee.email
        }
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link
                href={`/api/export/dtr/weekly?employee_id=${employee.id}&week_start=${week_start}`}
              >
                <FileText className="h-4 w-4" />
                Export weekly PDF
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/employees/${employee.id}`}>
                <ChevronLeft className="h-4 w-4" />
                Back to employee
              </Link>
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>Weekly DTR overview</CardTitle>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-border bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Week
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {weekEnd ? formatWeekRange(week_start) : week_start}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Entries
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {dtrs?.length ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Total duration
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {formatMinutes(totalMinutes)}
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {!dtrs?.length ? (
        <Card>
          <CardContent className="py-8 text-sm text-slate-500">
            No DTR entries for this week.
          </CardContent>
        </Card>
      ) : (
        <div className="max-h-[calc(100vh-15rem)] space-y-6 overflow-y-auto pr-1">
          {dtrs.map((entry, index) => (
            <Card key={entry.id}>
              <CardHeader className="flex flex-col gap-1">
                <CardTitle className="flex items-center gap-2">
                  DTR {index + 1} <StatusBadge status={entry.status} />
                </CardTitle>
                <p className="text-sm text-slate-500">
                  Duration: {formatMinutes(entry.duration_minutes)}
                </p>
                <p className="text-xs text-slate-500">Work date {entry.work_date}</p>
              </CardHeader>
              <CardContent>
                <DtrForm
                  initialData={{
                    id: entry.id,
                    week_start: entry.week_start,
                    week_end: entry.week_end,
                    work_date: entry.work_date,
                    start_time: entry.start_time ?? undefined,
                    end_time: entry.end_time ?? undefined,
                    project_account: entry.project_account ?? undefined,
                    project_id: entry.project_id ?? undefined,
                    notes: entry.notes ?? undefined,
                    image_link: entry.image_link ?? undefined,
                    status: entry.status,
                  }}
                  projects={projects ?? []}
                  readOnly
                  hideActions
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
