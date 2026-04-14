"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { ChevronDown, ChevronRight, Eye } from "lucide-react";
import { format, parseISO, startOfWeek } from "date-fns";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { formatMinutes, formatWeekRange } from "@/utils/date";

type Row = {
  id: string;
  work_date: string;
  project_account?: string | null;
  duration_minutes: number;
  status: import("@/types/db").DtrStatus;
  profiles?: { full_name?: string | null };
};

type WeekGroup = {
  key: string;
  label: string;
  rows: Row[];
  totalMinutes: number;
};

type EmployeeGroup = {
  key: string;
  label: string;
  rows: Row[];
  weeks: WeekGroup[];
};

function buildWeekGroups(rows: Row[]): WeekGroup[] {
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
    acc[key].totalMinutes += row.duration_minutes ?? 0;
    return acc;
  }, {});

  return Object.values(grouped).sort((a, b) => b.key.localeCompare(a.key));
}

export function DtrTable({
  data,
  isManager,
}: {
  data: Row[];
  isManager: boolean;
}) {
  const columns: ColumnDef<Row>[] = useMemo(
    () => [
      { header: "Date", accessorKey: "work_date" },
      {
        header: "Project/Account",
        accessorKey: "project_account",
        cell: ({ row }) => row.original.project_account ?? "--",
      },
      {
        header: "Duration",
        accessorKey: "duration_minutes",
        cell: ({ row }) => formatMinutes(row.original.duration_minutes),
      },
      {
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: "Action",
        meta: { align: "center" },
        cell: ({ row }) => (
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/dtr/${row.original.id}`} prefetch={false}>
                <Eye className="h-4 w-4" />
                View
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  const weekGroups = useMemo(() => buildWeekGroups(data), [data]);

  const employees: EmployeeGroup[] = useMemo(() => {
    if (!isManager) return [];
    const grouped = data.reduce<Record<string, EmployeeGroup>>((acc, row) => {
      const name = row.profiles?.full_name || "Unknown";
      const key = name.toLowerCase();
      if (!acc[key]) {
        acc[key] = { key, label: name, rows: [], weeks: [] };
      }
      acc[key].rows.push(row);
      return acc;
    }, {});

    return Object.values(grouped)
      .map((employee) => ({ ...employee, weeks: buildWeekGroups(employee.rows) }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [data, isManager]);

  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());

  useEffect(() => {
    const next = new Set<string>();
    if (isManager) {
      employees.forEach((employee) => {
        const firstWeek = employee.weeks[0];
        if (firstWeek) next.add(`${employee.key}::${firstWeek.key}`);
      });
    } else if (weekGroups[0]) {
      next.add(weekGroups[0].key);
    }
    setExpandedWeeks(next);
  }, [employees, isManager, weekGroups]);

  const toggleWeek = (key: string) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (!data.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-slate-500">
        No DTR entries
      </div>
    );
  }

  if (isManager) {
    return (
      <div className="space-y-5">
        {employees.map((employee) => (
          <div
            key={employee.key}
            className="overflow-hidden rounded-xl border border-rose-100 bg-white shadow-sm"
          >
            <div className="flex items-center justify-between bg-rose-50 px-4 py-3">
              <p className="text-sm font-semibold text-rose-900 tracking-wide">
                {employee.label}
              </p>
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-rose-700 border border-rose-200 shadow-sm">
                {employee.rows.length} {employee.rows.length === 1 ? "entry" : "entries"}
              </span>
            </div>

            <div className="space-y-3 px-2 py-3">
              {employee.weeks.map((week) => {
                const key = `${employee.key}::${week.key}`;
                const isOpen = expandedWeeks.has(key);
                const sortedRows = week.rows
                  .slice()
                  .sort((a, b) => (b.work_date ?? "").localeCompare(a.work_date ?? ""));

                return (
                  <div
                    key={week.key}
                    className="overflow-hidden rounded-lg border border-border bg-white shadow-card"
                  >
                    <button
                      type="button"
                      onClick={() => toggleWeek(key)}
                      className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </span>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-900">
                            Week of {week.label}
                          </p>
                          <p className="text-xs text-slate-500">
                            {week.rows.length} {week.rows.length === 1 ? "entry" : "entries"} |{" "}
                            {formatMinutes(week.totalMinutes)} total
                          </p>
                        </div>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700 border border-slate-200">
                        {isOpen ? "Hide" : "Show"}
                      </span>
                    </button>

                    {isOpen ? (
                      <div className="border-t border-slate-200 px-3 py-3">
                        <DataTable columns={columns} data={sortedRows} useTableOnMobile />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Employee view: group by week only.
  return (
    <div className="space-y-4">
      {weekGroups.map((group) => {
        const isOpen = expandedWeeks.has(group.key);
        const sortedRows = group.rows
          .slice()
          .sort((a, b) => (b.work_date ?? "").localeCompare(a.work_date ?? ""));

        return (
          <div
            key={group.key}
            className="overflow-hidden rounded-xl border border-border bg-white shadow-card"
          >
            <button
              type="button"
              onClick={() => toggleWeek(group.key)}
              className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">
                    Week of {group.label}
                  </p>
                  <p className="text-xs text-slate-500">
                    {group.rows.length} {group.rows.length === 1 ? "entry" : "entries"} |{" "}
                    {formatMinutes(group.totalMinutes)} total
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700 border border-slate-200">
                {isOpen ? "Hide" : "Show"}
              </span>
            </button>

            {isOpen ? (
              <div className="border-t border-slate-200 px-3 py-3">
                <DataTable columns={columns} data={sortedRows} useTableOnMobile />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
