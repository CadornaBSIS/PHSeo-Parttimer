"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { ChevronDown, ChevronRight } from "lucide-react";
import { format, parseISO, startOfWeek } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import { cn } from "@/lib/utils";
import { formatMinutes, formatWeekRange } from "@/utils/date";
import {
  getTeamTimeRecordHistoryAction,
  type TeamTimeRecordHistoryRow,
} from "@/features/timeclock/actions";

function formatManilaTime(value: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleTimeString("en-US", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

type ComputedRow = TeamTimeRecordHistoryRow & { worked_total_minutes: number };

type WeekGroup = {
  key: string;
  label: string;
  rows: ComputedRow[];
  totalMinutes: number;
};

type DayGroup = {
  key: string; // work_date
  label: string;
  rows: ComputedRow[];
  totalMinutes: number;
};

function buildWeekGroups(rows: ComputedRow[]): WeekGroup[] {
  const grouped = rows.reduce<Record<string, WeekGroup>>((acc, row) => {
    if (!row.work_date) return acc;
    const weekStart = startOfWeek(parseISO(row.work_date), { weekStartsOn: 1 });
    const key = format(weekStart, "yyyy-MM-dd");
    if (!acc[key]) {
      acc[key] = {
        key,
        label: formatWeekRange(weekStart),
        rows: [],
        totalMinutes: 0,
      };
    }
    acc[key].rows.push(row);
    acc[key].totalMinutes += row.worked_total_minutes ?? 0;
    return acc;
  }, {});

  return Object.values(grouped).sort((a, b) => b.key.localeCompare(a.key));
}

function buildDayGroups(rows: ComputedRow[]): DayGroup[] {
  const grouped = rows.reduce<Record<string, DayGroup>>((acc, row) => {
    if (!row.work_date) return acc;
    if (!acc[row.work_date]) {
      acc[row.work_date] = {
        key: row.work_date,
        label: format(parseISO(row.work_date), "EEE, MMM d, yyyy"),
        rows: [],
        totalMinutes: 0,
      };
    }
    acc[row.work_date]!.rows.push(row);
    acc[row.work_date]!.totalMinutes += row.worked_total_minutes ?? 0;
    return acc;
  }, {});

  return Object.values(grouped).sort((a, b) => b.key.localeCompare(a.key));
}

export function TeamTimeRecordHistory({
  className,
  limitDays = 90,
}: {
  className?: string;
  limitDays?: number;
}) {
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TeamTimeRecordHistoryRow[]>([]);
  const [now, setNow] = useState<number | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(id);
  }, []);

  const load = useMemo(() => {
    return (mode: "foreground" | "background" = "foreground") => {
      if (mode === "foreground") setLoading(true);
      startTransition(async () => {
        try {
          const result = await getTeamTimeRecordHistoryAction({ limitDays });
          if (!result.ok) {
            toast.error(result.error);
            setRows([]);
            return;
          }
          setRows(result.data ?? []);
        } catch {
          toast.error("Failed to load team time record history.");
          setRows([]);
        } finally {
          if (mode === "foreground") setLoading(false);
        }
      });
    };
  }, [limitDays, startTransition]);

  useEffect(() => {
    load("foreground");
  }, [load]);

  useEffect(() => {
    const onChanged = () => load("background");
    window.addEventListener("timeclock:changed", onChanged);
    return () => window.removeEventListener("timeclock:changed", onChanged);
  }, [load]);

  const computedRows: ComputedRow[] = useMemo(() => {
    return rows.map((row) => {
      const extraActiveMinutes = row.open_time_in && now !== null
        ? Math.max(0, Math.floor((now - new Date(row.open_time_in).getTime()) / 60000))
        : 0;
      return {
        ...row,
        worked_total_minutes: row.worked_minutes_completed + extraActiveMinutes,
      };
    });
  }, [now, rows]);

  const weekGroups = useMemo(() => buildWeekGroups(computedRows), [computedRows]);

  useEffect(() => {
    const next = new Set<string>();
    const nextDays = new Set<string>();
    const firstWeek = weekGroups[0];
    if (firstWeek) {
      next.add(firstWeek.key);
      const firstDay = buildDayGroups(firstWeek.rows)[0];
      if (firstDay) nextDays.add(`${firstWeek.key}::${firstDay.key}`);
    }
    setExpandedWeeks(next);
    setExpandedDays(nextDays);
  }, [weekGroups]);

  const toggleWeek = (key: string) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleDay = (key: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const columns: ColumnDef<ComputedRow>[] = useMemo(
    () => [
      {
        header: "Employee",
        accessorKey: "employee_name",
        cell: ({ row }) => <span className="font-semibold text-slate-900">{row.original.employee_name}</span>,
      },
      {
        header: "Status",
        accessorKey: "attendance",
        cell: ({ row }) => {
          const status = row.original.attendance;
          const variant =
            status === "working"
              ? "success"
              : status === "timed_out"
                ? "secondary"
                : "warning";
          const label =
            status === "working"
              ? "Working"
              : status === "timed_out"
                ? "Timed out"
                : "On break";
          return <Badge className="whitespace-nowrap" variant={variant}>{label}</Badge>;
        },
      },
      {
        header: "Time in",
        accessorKey: "first_time_in",
        cell: ({ row }) => formatManilaTime(row.original.first_time_in),
      },
      {
        header: "Time out",
        accessorKey: "last_time_out",
        cell: ({ row }) => formatManilaTime(row.original.last_time_out),
      },
      {
        header: "Sessions",
        accessorKey: "sessions",
        meta: { align: "center" },
        cell: ({ row }) => <span className="tabular-nums">{row.original.sessions}</span>,
      },
      {
        header: "Total",
        accessorKey: "worked_total_minutes",
        cell: ({ row }) => (
          <span className="tabular-nums font-semibold text-slate-900">
            {formatMinutes(row.original.worked_total_minutes)}
          </span>
        ),
      },
      {
        header: "DTR",
        accessorKey: "dtr_text",
        cell: ({ row }) => {
          if (!row.original.dtr_id) return <span className="text-slate-500">--</span>;
          const text = (row.original.dtr_text ?? "").trim();
          const compact = text.replace(/\s+/g, " ");
          return (
            <Link
              href={`/dtr/${row.original.dtr_id}`}
              prefetch={false}
              className="block max-w-[420px] truncate text-slate-700 hover:underline"
              title={text ? compact : "Open DTR"}
            >
              {text ? compact : "Open DTR"}
            </Link>
          );
        },
      },
    ],
    [],
  );

  if (!loading && !weekGroups.length) {
    return (
      <div className={cn("rounded-xl border border-border bg-card p-4 text-sm text-slate-500", className)}>
        No team time records yet.
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", loading ? "opacity-90" : "", className)}>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-900">Team time record history</p>
        <p className="text-xs text-slate-500">
          Weekly breakdown of time records for employees (including managers).
        </p>
      </div>

      <div className="space-y-4">
        {weekGroups.map((week) => {
          const isWeekOpen = expandedWeeks.has(week.key);
          const dayGroups = buildDayGroups(week.rows);

          return (
            <div
              key={week.key}
              className="overflow-hidden rounded-xl border border-border bg-white shadow-card"
            >
              <button
                type="button"
                onClick={() => toggleWeek(week.key)}
                className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                    {isWeekOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </span>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">Week of {week.label}</p>
                    <p className="text-xs text-slate-500">
                      {week.rows.length} {week.rows.length === 1 ? "entry" : "entries"} |{" "}
                      {formatMinutes(week.totalMinutes)} total
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700 border border-slate-200">
                  {isWeekOpen ? "Hide" : "Show"}
                </span>
              </button>

              {isWeekOpen ? (
                <div className="border-t border-slate-200 px-3 py-3 space-y-3">
                  {dayGroups.map((day) => {
                    const dayKey = `${week.key}::${day.key}`;
                    const isDayOpen = expandedDays.has(dayKey);
                    const sortedRows = day.rows
                      .slice()
                      .sort((a, b) => (a.employee_name ?? "").localeCompare(b.employee_name ?? ""));

                    return (
                      <div
                        key={day.key}
                        className="overflow-hidden rounded-lg border border-border bg-white shadow-card"
                      >
                        <button
                          type="button"
                          onClick={() => toggleDay(dayKey)}
                          className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                              {isDayOpen ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </span>
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-slate-900">{day.label}</p>
                              <p className="text-xs text-slate-500">
                                {day.rows.length} {day.rows.length === 1 ? "entry" : "entries"} |{" "}
                                {formatMinutes(day.totalMinutes)} total
                              </p>
                            </div>
                          </div>
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700 border border-slate-200">
                            {isDayOpen ? "Hide" : "Show"}
                          </span>
                        </button>

                        {isDayOpen ? (
                          <div className="border-t border-slate-200 px-3 py-3">
                            <DataTable columns={columns} data={sortedRows} useTableOnMobile />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
