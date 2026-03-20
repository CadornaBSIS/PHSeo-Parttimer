"use client";

import {
  Activity,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  PieChart as PieChartIcon,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Snapshot = {
  submittedSchedules: number;
  draftSchedules: number;
  submittedDtr: number;
  draftDtr: number;
  activeEmployees: number;
};

type TrendPoint = {
  label: string;
  schedules: number;
  dtrEntries: number;
  hours: number;
};

type StatusSlice = {
  name: string;
  value: number;
  tone: string;
};

type EmployeeHours = {
  name: string;
  hours: number;
};

type AuditFeedItem = {
  id: string;
  action: string;
  target: string;
  actor: string;
  when: string;
};

type Props = {
  snapshot: Snapshot;
  trendData: TrendPoint[];
  scheduleStatusData: StatusSlice[];
  reviewStatusData: StatusSlice[];
  topEmployeeHours: EmployeeHours[];
  auditFeed: AuditFeedItem[];
};

const COLORS = {
  schedules: "#EF4444",
  dtrEntries: "#0F172A",
  hours: "#14B8A6",
  submitted: "#10B981",
  draft: "#F59E0B",
  for_approval: "#F59E0B",
  approved: "#10B981",
  not_approved: "#F97316",
  surface: "#F8FAFC",
  stroke: "#E2E8F0",
};

function getToneColor(tone: string) {
  if (tone in COLORS) {
    return COLORS[tone as keyof typeof COLORS];
  }
  return "#94A3B8";
}

function ReportsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number | string; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur">
      {label ? <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p> : null}
      <div className="space-y-1.5">
        {payload.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-4 text-sm">
            <span className="flex items-center gap-2 text-slate-600">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color ?? "#94A3B8" }}
              />
              {item.name}
            </span>
            <span className="font-semibold text-slate-900">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] transition duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_24px_48px_rgba(15,23,42,0.12)]">
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: accent }}
      />
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 transition group-hover:scale-105 group-hover:bg-white">
          <Icon className="h-5 w-5 text-slate-700" />
        </div>
      </div>
      <div className="text-xs text-slate-500">Live manager snapshot</div>
    </div>
  );
}

function EmptyState({ title }: { title: string }) {
  return <div className="flex h-72 items-center justify-center text-sm text-slate-500">{title}</div>;
}

function SectionHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-6 py-5">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
        <h3 className="mt-2 text-xl font-semibold text-slate-950">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <Icon className="h-5 w-5 text-slate-700" />
      </div>
    </div>
  );
}

export function ReportsDashboard({
  snapshot,
  trendData,
  scheduleStatusData,
  reviewStatusData,
  topEmployeeHours,
  auditFeed,
}: Props) {
  const auditChartData = auditFeed
    .reduce<Array<{ action: string; total: number }>>((acc, item) => {
      const existing = acc.find((entry) => entry.action === item.action);
      if (existing) {
        existing.total += 1;
        return acc;
      }

      acc.push({ action: item.action, total: 1 });
      return acc;
    }, [])
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <section className="rounded-[34px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(20,184,166,0.14),_transparent_24%),linear-gradient(180deg,#ffffff_0%,#f8fafc_56%,#eef2ff_100%)] p-6 shadow-[0_24px_60px_rgba(15,23,42,0.10)]">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Operations pulse</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-950">Submission and review analytics</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Track weekly submissions, current review flow, and employee logging volume from one manager dashboard.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm">
            Hover the charts to inspect exact weekly counts and hours.
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            label="Submitted Schedules"
            value={String(snapshot.submittedSchedules)}
            icon={ClipboardList}
            accent="linear-gradient(90deg, #ef4444, #fb7185)"
          />
          <SummaryCard
            label="Draft Schedules"
            value={String(snapshot.draftSchedules)}
            icon={BarChart3}
            accent="linear-gradient(90deg, #f59e0b, #fbbf24)"
          />
          <SummaryCard
            label="Submitted DTR"
            value={String(snapshot.submittedDtr)}
            icon={FileCheck2}
            accent="linear-gradient(90deg, #14b8a6, #2dd4bf)"
          />
          <SummaryCard
            label="Draft DTR"
            value={String(snapshot.draftDtr)}
            icon={Activity}
            accent="linear-gradient(90deg, #334155, #64748b)"
          />
          <SummaryCard
            label="Active Employees"
            value={String(snapshot.activeEmployees)}
            icon={Users}
            accent="linear-gradient(90deg, #3b82f6, #60a5fa)"
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_0.95fr]">
        <Card className="overflow-hidden border-slate-200 bg-white text-slate-900 shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
          <SectionHeader
            eyebrow="Trend Overview"
            title="Submission Activity"
            description="Schedules and DTR movement across the last six weeks."
            icon={TrendingUp}
          />
          <CardContent className="p-6">
            {trendData.length ? (
              <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Weekly submission trend</p>
                    <p className="text-xs text-slate-500">Compare schedule submissions against logged DTR entries.</p>
                  </div>
                </div>
                <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="scheduleFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.schedules} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={COLORS.schedules} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="dtrFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.hours} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={COLORS.hours} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                    <Tooltip content={<ReportsTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="schedules"
                      name="Schedules"
                      stroke={COLORS.schedules}
                      fill="url(#scheduleFill)"
                      strokeWidth={3}
                    />
                    <Area
                      type="monotone"
                      dataKey="dtrEntries"
                      name="DTR Entries"
                      stroke={COLORS.hours}
                      fill="url(#dtrFill)"
                      strokeWidth={3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <EmptyState title="No activity data yet." />
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-slate-200 bg-white text-slate-900 shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
          <SectionHeader
            eyebrow="Status Mix"
            title="Schedule Pipeline"
            description="Current submitted versus draft schedule volume."
            icon={PieChartIcon}
          />
          <CardContent className="p-6">
            {scheduleStatusData.length ? (
              <div className="space-y-4 rounded-[28px] border border-slate-200 bg-slate-50/70 p-4">
                <div>
                  <p className="mb-1 text-sm font-semibold text-slate-900">Schedule distribution</p>
                  <p className="text-xs text-slate-500">See how much of the current workload is still in draft versus already submitted.</p>
                </div>
                <div className="space-y-5">
                  <div className="mx-auto h-[220px] w-[220px] min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={scheduleStatusData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={82}
                          paddingAngle={4}
                        >
                          {scheduleStatusData.map((entry) => (
                            <Cell key={entry.name} fill={getToneColor(entry.tone)} />
                          ))}
                        </Pie>
                        <Tooltip content={<ReportsTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mx-auto max-w-[520px]">
                    <div className="grid gap-3 sm:grid-cols-2">
                    {scheduleStatusData.map((entry) => (
                      <div
                        key={entry.name}
                        className="min-w-0 rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: getToneColor(entry.tone) }}
                          />
                          <span className="truncate text-sm font-medium text-slate-600">{entry.name}</span>
                        </div>
                        <div className="mt-3 text-2xl font-semibold leading-none text-slate-950">{entry.value}</div>
                      </div>
                    ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState title="No schedule snapshot yet." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr] xl:items-start">
        <Card className="overflow-hidden border-slate-200 bg-white text-slate-900 shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
          <SectionHeader
            eyebrow="Team Output"
            title="Employee Logged Hours"
            description="Submitted DTR time by employee for the current week."
            icon={BarChart3}
          />
          <CardContent className="p-6">
            {topEmployeeHours.length ? (
              <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-5">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Top contributors this week</p>
                    <p className="text-xs text-slate-500">Logged hours from submitted DTR records only.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-right shadow-sm">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Total Logged</p>
                    <p className="text-lg font-semibold text-slate-950">
                      {topEmployeeHours.reduce((sum, item) => sum + item.hours, 0).toFixed(1)}h
                    </p>
                  </div>
                </div>
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="h-[360px] min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topEmployeeHours} layout="vertical" margin={{ left: 24 }}>
                        <CartesianGrid stroke="#E2E8F0" horizontal={false} />
                        <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                        <YAxis
                          dataKey="name"
                          type="category"
                          tickLine={false}
                          axisLine={false}
                          width={140}
                          tick={{ fill: "#475569", fontSize: 12 }}
                        />
                        <Tooltip content={<ReportsTooltip />} />
                        <Bar dataKey="hours" name="Hours" radius={[0, 12, 12, 0]} fill={COLORS.hours} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    {topEmployeeHours.map((employee, index) => (
                      <div
                        key={employee.name}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Rank {index + 1}</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{employee.name}</p>
                          </div>
                          <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
                            {employee.hours.toFixed(1)}h
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState title="No submitted DTR hours this week." />
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-slate-200 bg-white text-slate-900 shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
          <SectionHeader
            eyebrow="Review Flow"
            title="Approval Outcome"
            description="Status of all schedule-day reviews in the current reporting window."
            icon={CheckCircle2}
          />
          <CardContent className="p-6">
            {reviewStatusData.length ? (
              <div className="space-y-5 rounded-[28px] border border-slate-200 bg-slate-50/70 p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Review decision breakdown</p>
                  <p className="text-xs text-slate-500">Monitor pending, approved, and rejected day-level schedule reviews.</p>
                </div>
                <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
                  <div className="mx-auto h-[220px] w-[220px] min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={reviewStatusData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={3}
                        >
                          {reviewStatusData.map((entry) => (
                            <Cell key={entry.name} fill={getToneColor(entry.tone)} />
                          ))}
                        </Pie>
                        <Tooltip content={<ReportsTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    {reviewStatusData.map((entry) => (
                      <div
                        key={entry.name}
                        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: getToneColor(entry.tone) }}
                          />
                          <span className="text-sm text-slate-600">{entry.name}</span>
                        </div>
                        <span className="text-lg font-semibold text-slate-950">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState title="No review data yet." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="overflow-hidden border-slate-200 bg-white text-slate-900 shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
          <SectionHeader
            eyebrow="Quick Summary"
            title="Current Pulse"
            description="Fast summary of current reviewed versus pending operational load."
            icon={Activity}
          />
          <CardContent className="grid gap-3 p-6">
            {[
              { label: "For Approval", value: reviewStatusData.find((item) => item.tone === "for_approval")?.value ?? 0, color: COLORS.for_approval },
              { label: "Approved", value: reviewStatusData.find((item) => item.tone === "approved")?.value ?? 0, color: COLORS.approved },
              { label: "Not Approved", value: reviewStatusData.find((item) => item.tone === "not_approved")?.value ?? 0, color: COLORS.not_approved },
            ].map((item) => (
              <div key={item.label} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-white">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm text-slate-600">{item.label}</span>
                  <span className="text-lg font-semibold text-slate-950">{item.value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, item.value === 0 ? 6 : item.value * 8)}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-slate-200 bg-white text-slate-900 shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
          <SectionHeader
            eyebrow="Audit Overview"
            title="Action Volume"
            description="Most frequent manager-visible actions from the recent audit stream."
            icon={ClipboardList}
          />
          <CardContent className="p-6">
            {auditChartData.length ? (
              <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-5">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Recent audit activity by action</p>
                    <p className="text-xs text-slate-500">Shows which operational events are happening most often right now.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-right shadow-sm">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Recent Logs</p>
                    <p className="text-lg font-semibold text-slate-950">{auditFeed.length}</p>
                  </div>
                </div>
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="h-[360px] min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={auditChartData}>
                        <CartesianGrid stroke="#E2E8F0" vertical={false} />
                        <XAxis dataKey="action" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} allowDecimals={false} />
                        <Tooltip content={<ReportsTooltip />} />
                        <Bar dataKey="total" name="Events" radius={[12, 12, 0, 0]} fill="#3B82F6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    {auditChartData.map((item) => (
                      <div
                        key={item.action}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium capitalize text-slate-900">{item.action}</span>
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                            {item.total}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState title="No audit activity yet." />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-slate-200 bg-white text-slate-900 shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
        <CardHeader className="border-b border-slate-200 bg-slate-50/70">
          <CardTitle className="flex items-center gap-2 text-xl text-slate-950">
            <CheckCircle2 className="h-5 w-5 text-teal-600" />
            Audit activity
          </CardTitle>
          <p className="text-sm text-slate-500">Latest manager-visible actions across schedules, DTRs, and reviews.</p>
        </CardHeader>
        <CardContent className="p-6">
          {auditFeed.length ? (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {auditFeed.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-[24px] border border-slate-200 bg-slate-50 p-4 shadow-sm transition duration-300",
                    "hover:-translate-y-1 hover:border-slate-300 hover:bg-white hover:shadow-lg",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold capitalize text-slate-950">{item.action}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">{item.target}</p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                      Log
                    </span>
                  </div>
                  <div className="mt-5 flex items-end justify-between gap-4">
                    <div className="space-y-1 text-sm text-slate-700">
                      <p>{item.actor}</p>
                      <p className="text-xs text-slate-500">{item.when}</p>
                    </div>
                    <div className="h-10 w-1 rounded-full bg-gradient-to-b from-slate-200 via-slate-300 to-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              No audit logs yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
