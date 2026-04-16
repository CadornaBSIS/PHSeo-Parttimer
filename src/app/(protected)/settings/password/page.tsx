import Link from "next/link";
import { ArrowLeft, KeyRound, ShieldAlert } from "lucide-react";
import { NotificationBell } from "@/components/layout/notification-bell";
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
    <div className="space-y-6 md:space-y-8 w-full overflow-x-hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="-ml-2 mt-0.5"
            aria-label="Back to settings"
          >
            <Link href="/settings">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="page-title">
              {isManager ? "Password Management" : "Password Help"}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {isManager
                ? "Change your password and manage employee passwords."
                : "Employees can't reset passwords in the app. Contact your manager for help."}
            </p>
          </div>
        </div>
        <div className="hidden md:block">
          <NotificationBell userId={profile.id} />
        </div>
      </div>

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
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-rose-50 p-5 sm:p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-200">
              <ShieldAlert className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Password reset is manager-controlled
              </p>
              <p className="mt-1 text-xs text-slate-600">
                For security, employees cannot reset passwords from the app. Your manager will provide a new
                temporary password.
              </p>
            </div>
          </div>
        </div>
      )}

      {isManager ? (
        <PasswordManagement isManager={isManager} employees={employees ?? []} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-accent" />
                Contact Your Manager
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-700">
              <p className="text-slate-600">
                Ask your manager to reset your password or help with account recovery.
              </p>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  What happens next
                </p>
                <ol className="mt-2 space-y-1 text-sm text-slate-700 list-decimal pl-5">
                  <li>Your manager sets a new temporary password.</li>
                  <li>You sign in using the temporary password.</li>
                  <li>Contact the manager again if you need another reset.</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Message Template</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <p className="text-slate-600">Send this to your manager:</p>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 font-mono text-xs leading-relaxed text-slate-700 whitespace-pre-line">
                {`Hi Manager, I need a password reset for my account.\nEmail: ${profile.email}\nPlease send me a temporary password. Thanks.`}
              </div>
              <p className="text-xs text-slate-500">
                Tip: Share passwords only through a secure channel (not public chat).
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
