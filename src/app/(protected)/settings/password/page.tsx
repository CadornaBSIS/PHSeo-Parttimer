import Link from "next/link";
import { ArrowLeft, KeyRound, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PasswordManagement } from "@/features/auth/components/password-management";

export default async function PasswordSettingsPage() {
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();
  const isManager = profile.role === "manager";

  const { data: employees } = isManager
    ? await supabase
        .from("profiles")
        .select("id, full_name, email, status")
        .eq("role", "employee")
        .order("full_name", { ascending: true })
    : { data: [] as Array<{ id: string; full_name: string; email: string; status: string }> };

  return (
    <div className="space-y-6 md:space-y-8 max-w-6xl mx-auto px-3 sm:px-4 w-full overflow-x-hidden">
      <PageHeader
        title={isManager ? "Password Management" : "Password Help"}
        description={
          isManager
            ? "Change your password and manage employee passwords."
            : "Employees can’t reset passwords in the app. Contact your manager for help."
        }
        userId={profile.id}
        actions={
          <Button variant="outline" asChild>
            <Link href="/settings" className="gap-2 inline-flex items-center">
              <ArrowLeft className="h-4 w-4" />
              Back to settings
            </Link>
          </Button>
        }
      />

      {isManager ? (
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-blue-50 p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm border border-slate-200">
              <KeyRound className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Password changes take effect immediately.
              </p>
              <p className="text-xs text-slate-600">
                Use at least 8 characters. Share temporary passwords securely.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {isManager ? (
        <PasswordManagement isManager={isManager} employees={employees ?? []} />
      ) : (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-accent" />
              Contact Your Manager
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            <p className="text-slate-600">
              Please contact your manager to request a password reset or account recovery.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
