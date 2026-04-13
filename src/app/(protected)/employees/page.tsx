import Link from "next/link";
import { notFound } from "next/navigation";
import { UsersRound, Eye } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateEmployeeForm } from "@/features/employees/components/create-employee-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import { StatusBadge } from "@/components/common/status-badge";

export default async function EmployeesPage() {
  const profile = await requireProfile();
  if (profile.role !== "manager") notFound();

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, department, employee_code, status, created_at")
    .order("created_at", { ascending: false });
  if (error) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        description="Manager-only employee management and provisioning."
        userId={profile.id}
        actions={
          <div className="hidden md:flex items-center gap-2 text-slate-500 text-sm">
            <UsersRound className="h-4 w-4" />
            Manager access only
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Create employee account</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateEmployeeForm />
        </CardContent>
      </Card>

      <div className="card space-y-4 p-4 sm:p-6">
        <div className="w-full max-w-full overflow-x-auto overscroll-x-contain">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell>
                    <div className="font-semibold text-slate-900">
                      {emp.full_name}
                    </div>
                    <div className="text-xs text-slate-500">{emp.email}</div>
                  </TableCell>
                  <TableCell>{emp.department ?? "--"}</TableCell>
                  <TableCell className="capitalize">{emp.role}</TableCell>
                  <TableCell>
                    <StatusBadge status={(emp.status as string) ?? "inactive"} />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/employees/${emp.id}`} prefetch={false}>
                        <Eye className="h-4 w-4" />
                        View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!data?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-slate-500">
                    No employees found.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
