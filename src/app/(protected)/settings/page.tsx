import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
  Shield,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireProfile } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const profile = await requireProfile();
  const supabase = await createServerSupabaseClient();
  const isManager = profile.role === "manager";

  const [
    { count: unreadNotifications = 0 },
    { data: latestNotificationRows },
  ] = await Promise.all([
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("is_read", false),
    supabase
      .from("notifications")
      .select("created_at")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const lastNotificationAt = latestNotificationRows?.[0]?.created_at;

  return (
    <div className="space-y-6 md:space-y-8 w-full overflow-x-hidden">
      <PageHeader
        title="Security & Settings"
        description="Manage authentication, access, and account protection."
        userId={profile.id}
      />

      <Card className="overflow-hidden border-slate-200 shadow-md">
        <CardContent className="bg-gradient-to-r from-white via-slate-50 to-blue-50 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Security Posture
              </p>
              <h2 className="text-2xl font-semibold text-slate-950">Account protection overview</h2>
              <p className="max-w-2xl text-sm text-slate-600">
                Review authentication, password recovery, alerts, and access policies for this account.
              </p>
              <div className="flex flex-wrap items-center gap-1 text-[10px] leading-tight">
                <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-100 px-2 py-[6px] font-semibold text-emerald-800 border border-emerald-200 shadow-sm capitalize">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {(profile.status ?? "inactive").replace(/_/g, " ")}
                </span>
                <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-white px-2 py-[6px] font-semibold text-slate-800 border border-slate-200 shadow-sm">
                  <ShieldCheck className="h-3 w-3 text-indigo-600" />
                  Supabase Auth
                </span>
                <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-white px-2 py-[6px] font-semibold text-slate-800 border border-slate-200 shadow-sm">
                  <KeyRound className="h-3 w-3 text-slate-500" />
                  {isManager ? "Password reset enabled" : "Password reset assisted"}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <Button asChild className="w-full sm:w-auto">
                <Link href="/settings/password">
                  {isManager ? "Open Password Controls" : "Open Password Help"}
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SecurityStat
          label="Account Status"
          value={profile.status}
          hint="Current access state"
          icon={<ShieldCheck className="h-4 w-4" />}
          valueClassName="capitalize"
        />
        <SecurityStat
          label="Password Support"
          value={isManager ? "Direct reset" : "Manager assisted"}
          hint={isManager ? "Password changes and resets available" : "Reset requests go through management"}
          icon={<KeyRound className="h-4 w-4" />}
        />
        <SecurityStat
          label="Unread Alerts"
          value={String(unreadNotifications)}
          hint="Notification queue"
          icon={<Bell className="h-4 w-4" />}
        />
        <SecurityStat
          label="Auth Provider"
          value="Supabase"
          hint="Session + token based"
          icon={<Shield className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-accent" />
              Authentication
            </CardTitle>
            <CardDescription>
              Sign-in and identity verification settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <PanelLine
              title="Provider"
              detail="Supabase Authentication"
              sub="Email/password based login"
            />
            <PanelLine
              title="Account Email"
              detail={profile.email}
              sub="Used for authentication and account recovery"
              icon={<Mail className="h-4 w-4" />}
            />
            <PanelLine
              title={isManager ? "Password Recovery" : "Password Reset Support"}
              detail={isManager ? "Enabled" : "Manager-controlled"}
              sub={
                isManager
                  ? "Change your password or reset employee passwords"
                  : "Employees must request password resets from a manager"
              }
            />
            <div className="flex gap-2 pt-1">
              <Button size="sm" asChild>
                <Link href="/settings/password">
                  {isManager ? "Open Password Page" : "View Instructions"}
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/login">Go To Login</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-accent" />
              Access Controls
            </CardTitle>
            <CardDescription>
              Role enforcement, account state, and policy boundaries.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <PanelLine
              title="Access Model"
              detail="Policy-based permissions"
              sub="Access is assigned during provisioning and enforced automatically"
            />
            <PanelLine
              title="Account State"
              detail={profile.status}
              sub="Inactive or archived users lose normal app access"
              valueClassName="capitalize"
            />
            <PanelLine
              title="Provisioning Policy"
              detail="Public sign-up disabled"
              sub="Accounts are controlled by manager provisioning"
            />
            <PanelLine
              title="Reset Authority"
              detail={isManager ? "Employee resets enabled" : "Manager approval required"}
              sub={
                isManager
                  ? "Managers can issue secure password resets for employee accounts"
                  : "Employees must request password resets through management"
              }
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Security Notifications</CardTitle>
            <CardDescription>
              Security-relevant updates and alert visibility.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">Unread alerts</p>
              <p className="mt-1 text-sm text-slate-600">
                You currently have <span className="font-semibold text-slate-900">{unreadNotifications}</span> unread notification(s).
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">Latest notification</p>
              <p className="mt-1 text-sm text-slate-600">
                {lastNotificationAt
                  ? `${formatDistanceToNow(new Date(lastNotificationAt), { addSuffix: true })}`
                  : "No notifications yet."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Security Checklist</CardTitle>
            <CardDescription>
              {isManager
                ? "Security practices for account administration and password handling."
                : "Best-practice checks to keep your account safe."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {isManager ? (
              <>
                <ChecklistTile title="Use strong temporary passwords" description="Share resets privately and avoid predictable credentials" />
                <ChecklistTile title="Review alerts regularly" description="Monitor notifications for unusual sign-in or account activity" />
                <ChecklistTile title="Keep recovery email accurate" description="Authentication and recovery depend on the current email address" />
                <ChecklistTile title="Reset immediately if suspicious" description="Rotate passwords at once when compromise is suspected" />
              </>
            ) : (
              <>
                <ChecklistTile title="Use a strong password" description="At least 8 chars with mixed character types" />
                <ChecklistTile title="Review alerts regularly" description="Open notifications and review account updates" />
                <ChecklistTile title="Keep account email current" description="Ensure your authentication and recovery email stays accurate" />
                <ChecklistTile title="Reset immediately if suspicious" description="Use the password page when you suspect compromise" />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SecurityStat({
  label,
  value,
  hint,
  icon,
  valueClassName,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="space-y-2 p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className={`text-2xl font-semibold text-slate-900 ${valueClassName ?? ""}`}>{value}</p>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {icon}
          {hint}
        </div>
      </CardContent>
    </Card>
  );
}

function PanelLine({
  title,
  detail,
  sub,
  icon,
  valueClassName,
}: {
  title: string;
  detail: string;
  sub: string;
  icon?: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="mt-1 flex items-center gap-2">
        {icon}
        <p className={`text-sm font-semibold text-slate-900 ${valueClassName ?? ""}`}>{detail}</p>
      </div>
      <p className="mt-1 text-xs text-slate-600">{sub}</p>
    </div>
  );
}

function ChecklistTile({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        {title}
      </div>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  );
}
