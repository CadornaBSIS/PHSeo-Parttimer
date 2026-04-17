"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/data-table";
import { cn } from "@/lib/utils";
import {
  getManagerTimeRecordsAction,
  type ManagerTimeRecordRow,
} from "@/features/timeclock/actions";
import { Download } from "lucide-react";
import { format, parseISO, startOfWeek } from "date-fns";

function formatManilaTime(value: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleTimeString("en-US", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatMinutes(totalMinutes: number) {
  const minutes = Math.max(0, totalMinutes);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  if (!m) return `${h}h`;
  return `${h}h ${m}m`;
}

export function ManagerTimeRecords() {
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [workDate, setWorkDate] = useState("");
  const [rows, setRows] = useState<ManagerTimeRecordRow[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const inFlightRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback((date?: string, mode: "foreground" | "background" = "foreground") => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (mode === "foreground") setLoading(true);
    startTransition(async () => {
      try {
        const result = await getManagerTimeRecordsAction(date);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        if (!date) setWorkDate(result.data?.work_date ?? "");
        setRows(result.data?.rows ?? []);
      } catch {
        toast.error("Failed to load team time record.");
      } finally {
        if (mode === "foreground") setLoading(false);
        inFlightRef.current = false;
      }
    });
  }, [startTransition]);

  useEffect(() => {
    load(undefined, "foreground");
  }, [load]);

  useEffect(() => {
    const getManilaToday = () =>
      new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

    const maybeReload = () => {
      const today = getManilaToday();
      if (!workDate || workDate !== today) return;
      load(workDate, "background");
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") maybeReload();
    };

    window.addEventListener("focus", maybeReload);
    document.addEventListener("visibilitychange", onVisibility);
    const intervalId = window.setInterval(maybeReload, 60000);

    return () => {
      window.removeEventListener("focus", maybeReload);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(intervalId);
    };
  }, [load, workDate]);

  const computedRows = useMemo(() => {
    return rows.map((row) => {
      const extraActiveMinutes = row.open_time_in
        ? Math.max(0, Math.floor((now - new Date(row.open_time_in).getTime()) / 60000))
        : 0;
      const workedTotal = row.worked_minutes_completed + extraActiveMinutes;
      return { ...row, worked_total_minutes: workedTotal } as ManagerTimeRecordRow & {
        worked_total_minutes: number;
      };
    });
  }, [rows, now]);

  const columns: ColumnDef<(typeof computedRows)[number]>[] = useMemo(
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
          const variant = status === "working"
            ? "success"
            : status === "timed_out"
              ? "secondary"
              : status === "on_break"
                ? "warning"
                : status === "absent"
                  ? "danger"
                  : status === "not_working"
                    ? "muted"
                    : status === "no_schedule"
                      ? "muted"
                      : "muted";
          const label = status === "working"
            ? "Working"
            : status === "timed_out"
              ? "Timed out"
              : status === "on_break"
                ? "On break"
                : status === "absent"
                  ? "Absent"
                  : status === "not_working"
                    ? "Not working"
                    : status === "no_schedule"
                      ? "No schedule"
                      : "No record";
          return <Badge variant={variant}>{label}</Badge>;
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
            {formatMinutes((row.original as any).worked_total_minutes ?? row.original.worked_minutes_completed)}
          </span>
        ),
      },
      {
        header: "DTR",
        accessorKey: "dtr_text",
        cell: ({ row }) => {
          const text = (row.original.dtr_text ?? "").trim();
          if (!text) return <span className="text-slate-500">--</span>;
          const compact = text.replace(/\s+/g, " ");
          return (
            <span className="block max-w-[420px] truncate text-slate-700" title={compact}>
              {compact}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/time/team/${row.original.employee_id}?date=${workDate}`} prefetch={false}>
              View logs
            </Link>
          </Button>
        ),
      },
    ],
    [workDate],
  );

  return (
    <div className={cn("space-y-4", loading ? "opacity-90" : "")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">Team time record</p>
          <p className="text-xs text-slate-500">
            Shows time in/out status and total hours for the selected day.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
              Work date
            </p>
            <Input
              type="date"
              value={workDate}
              onChange={(e) => {
                const next = e.target.value;
                setWorkDate(next);
                load(next, "foreground");
              }}
              className="w-[180px]"
            />
          </div>
          <Button asChild type="button" variant="outline" className="h-10">
            <a href={`/api/export/time-records?date=${workDate}`}>
              <Download className="h-4 w-4" />
              Export day
            </a>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={() => {
              const base = workDate && /^\d{4}-\d{2}-\d{2}$/.test(workDate) ? parseISO(workDate) : new Date();
              const monday = startOfWeek(base, { weekStartsOn: 1 });
              const weekStart = format(monday, "yyyy-MM-dd");
              window.location.href = `/api/export/time-records?week_start=${weekStart}`;
            }}
          >
            <Download className="h-4 w-4" />
            Export week
          </Button>
        </div>
      </div>

      <div className="card">
        <DataTable columns={columns} data={computedRows} useTableOnMobile />
      </div>
    </div>
  );
}
