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
  UserCog,
  UsersRound,
  FileText,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
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
    { count: activeEmployees = 0 },
    { data: latestNotificationRows },
  ] = await Promise.all([
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("is_read", false),
    isManager
      ? supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "employee")
          .eq("status", "active")
      : Promise.resolve({ count: 0 }),
    supabase
      .from("notifications")
      .select("created_at")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const lastNotificationAt = latestNotificationRows?.[0]?.created_at;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security & Settings"
        description="Manage authentication, access, and account protection."
        userId={profile.id}
      />

      <Card className="overflow-hidden border-slate-200">
        <CardContent className="bg-gradient-to-r from-white via-slate-50 to-blue-50 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Security Posture
              </p>
              <h2 className="text-2xl font-semibold text-slate-950">{profile.full_name}</h2>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="capitalize">
                  {profile.role}
                </Badge>
                <StatusBadge status={profile.status ?? "inactive"} />
                <Badge variant="outline">Supabase Auth Protected</Badge>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link href="/profile">Account Profile</Link>
              </Button>
              <Button asChild>
                <Link href="/forgot-password">Reset Password</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SecurityStat
          label="Account Status"
          value={profile.status}
          hint="Current access state"
          icon={<ShieldCheck className="h-4 w-4" />}
          valueClassName="capitalize"
        />
        <SecurityStat
          label="Role"
          value={profile.role}
          hint="Permission scope"
          icon={<UserCog className="h-4 w-4" />}
          valueClassName="capitalize"
        />
        <SecurityStat
          label="Unread Alerts"
          value={String(unreadNotifications)}
          hint="Notification queue"
          icon={<Bell className="h-4 w-4" />}
        />
        <SecurityStat
          label={isManager ? "Active Team Accounts" : "Auth Provider"}
          value={isManager ? String(activeEmployees) : "Supabase"}
          hint={isManager ? "Managed employee users" : "Session + token based"}
          icon={isManager ? <UsersRound className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
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
              title="Password Recovery"
              detail="Enabled"
              sub="You can request reset from the forgot-password page"
            />
            <div className="flex gap-2 pt-1">
              <Button size="sm" asChild>
                <Link href="/forgot-password">Send Reset Link</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/login">Go To Login</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
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
              title="Role"
              detail={profile.role}
              sub={isManager ? "Can provision and manage users" : "Can access personal workflow pages"}
              valueClassName="capitalize"
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
            {isManager ? (
              <PanelLine
                title="Manager Scope"
                detail="Employee administration enabled"
                sub="Can manage employee records and monitor compliance"
                icon={<CheckCircle2 className="h-4 w-4" />}
              />
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
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

        <Card>
          <CardHeader>
            <CardTitle>{isManager ? "Manager Security Controls" : "Personal Security Checklist"}</CardTitle>
            <CardDescription>
              {isManager
                ? "Administrative controls tied to account and data security."
                : "Best-practice checks to keep your account safe."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {isManager ? (
              <>
                <ActionTile
                  href="/employees"
                  title="User Provisioning"
                  description="Create and manage employee access"
                  icon={<UsersRound className="h-4 w-4" />}
                />
                <ActionTile
                  href="/reports"
                  title="Compliance Review"
                  description="Review submission and operational reports"
                  icon={<FileText className="h-4 w-4" />}
                />
                <ActionTile
                  href="/schedule"
                  title="Schedule Oversight"
                  description="Inspect submitted schedule records"
                  icon={<ShieldCheck className="h-4 w-4" />}
                />
                <ActionTile
                  href="/dtr"
                  title="DTR Oversight"
                  description="Monitor logged work records"
                  icon={<Shield className="h-4 w-4" />}
                />
              </>
            ) : (
              <>
                <ChecklistTile title="Use a strong password" description="At least 8 chars with mixed character types" />
                <ChecklistTile title="Review alerts regularly" description="Open notifications and review account updates" />
                <ChecklistTile title="Keep profile details current" description="Ensure your account email is accurate" />
                <ChecklistTile title="Reset immediately if suspicious" description="Use forgot-password when you suspect compromise" />
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
    <Card>
      <CardContent className="space-y-2 p-5">
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

function ActionTile({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 hover:bg-slate-50"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        {icon}
        {title}
      </div>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </Link>
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
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        {title}
      </div>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  );
}
