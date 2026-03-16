import { notFound } from "next/navigation";
import { FileText, Filter, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";

export default async function ReportsPage() {
  const profile = await requireProfile();
  if (profile.role !== "manager") notFound();

  const supabase = await createServerSupabaseClient();
  const [{ count: submittedSchedules }, { count: submittedDtr }] =
    await Promise.all([
      supabase
        .from("schedules")
        .select("*", { count: "exact", head: true })
        .eq("status", "submitted"),
      supabase
        .from("dtr_entries")
        .select("*", { count: "exact", head: true })
        .eq("status", "submitted"),
    ]);

  const { data: auditLogs } = await supabase
    .from("audit_logs")
    .select("id, action, target_type, target_id, created_at, actor_id")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Manager-only exports and monitoring."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-accent" />
            <CardTitle>PDF exports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>
              Export individual schedules and DTRs from their detail pages.
              Weekly schedule PDFs include all 7 days; DTR PDFs include project,
              notes, and duration.
            </p>
            <p className="text-xs text-slate-500">
              Only managers can access /api/export routes. Employees never see
              export buttons.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex items-center gap-3">
            <Filter className="h-5 w-5 text-accent" />
            <CardTitle>Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>Submitted schedules: {submittedSchedules ?? 0}</p>
            <p>Submitted DTR entries: {submittedDtr ?? 0}</p>
            <p className="text-xs text-slate-500">
              Use filters on the Schedule and DTR lists to export subsets or to
              monitor drafts.
            </p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-accent" />
            How to generate monthly DTR
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600 space-y-2">
          <p>
            1) Filter DTR list by employee and date range. 2) Open entries and
            export PDFs as needed. 3) Combine PDFs if required using your
            preferred tool. Server-side monthly aggregate exports can be added
            by extending <code>src/app/api/export/dtr</code>.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Audit logs (latest 20)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(auditLogs ?? []).map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{log.action}</TableCell>
                  <TableCell>
                    {log.target_type} {log.target_id ?? ""}
                  </TableCell>
                  <TableCell>{log.actor_id ?? "System"}</TableCell>
                  <TableCell>
                    {new Date(log.created_at).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
              {!auditLogs?.length ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-slate-500">
                    No audit logs yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
