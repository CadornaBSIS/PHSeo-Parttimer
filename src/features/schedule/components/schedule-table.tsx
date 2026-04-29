"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { formatWeekRange } from "@/utils/date";

type Row = {
  id: string;
  employee_id?: string;
  week_start: string;
  week_end: string;
  status: import("@/types/db").ScheduleStatus;
  submitted_at?: string | null;
  profiles?: { full_name?: string | null };
  schedule_days?: { approval_status?: "for_approval" | "approved" | "not_approved" | null }[];
};

type ReviewStatus = "for_approval" | "approved" | "not_approved" | "partially_reviewed" | "reviewed";

export function ScheduleTable({
  data,
  isManager,
  statusFilter,
  employeeId,
  realtime = true,
  detailHrefBase = "/schedule",
}: {
  data: Row[];
  isManager: boolean;
  statusFilter?: string;
  employeeId?: string;
  realtime?: boolean;
  detailHrefBase?: string;
}) {
  const [rows, setRows] = useState<Row[]>(data);

  useEffect(() => {
    setRows(data);
  }, [data]);

  useEffect(() => {
    if (!realtime) return;
    const supabase = createBrowserSupabaseClient();

    const fetchRow = async (id: string) => {
      const { data: row } = await supabase
        .from("schedules")
        .select(
          "id, employee_id, week_start, week_end, status, submitted_at, profiles(full_name), schedule_days(approval_status)",
        )
        .eq("id", id)
        .maybeSingle();

      if (!row) {
        setRows((prev) => prev.filter((item) => item.id !== id));
        return;
      }

      // Respect filters
      if (employeeId && row.employee_id !== employeeId) return;
      if (statusFilter && row.status !== statusFilter) {
        setRows((prev) => prev.filter((item) => item.id !== id));
        return;
      }

      const normalized = {
        ...row,
        profiles: Array.isArray(row.profiles) ? row.profiles[0] ?? undefined : row.profiles,
      } as Row;

      setRows((prev) => {
        const existingIdx = prev.findIndex((item) => item.id === id);
        if (existingIdx >= 0) {
          const next = [...prev];
          next[existingIdx] = normalized;
          return next;
        }
        return [normalized, ...prev];
      });
    };

    const channel = supabase
      .channel(`schedules:${employeeId ?? "all"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "schedules",
          filter: employeeId ? `employee_id=eq.${employeeId}` : undefined,
        },
        (payload) => {
          const id = (payload.new as Row | null)?.id ?? (payload.old as Row | null)?.id;
          if (!id) return;
          void fetchRow(id);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [employeeId, realtime, statusFilter]);

  const getReviewStatus = (row: Row): ReviewStatus | null => {
    const approvals = row.schedule_days ?? [];
    if (!approvals.length) return null;
    const values = approvals.map((day) => day.approval_status ?? "for_approval");
    if (values.every((value) => value === "approved")) return "approved";
    if (values.every((value) => value === "not_approved")) return "not_approved";
    if (values.every((value) => value === "for_approval")) return "for_approval";
    if (values.some((value) => value === "for_approval")) return "partially_reviewed";
    return "reviewed";
  };

  const columns: ColumnDef<Row>[] = [
    ...(isManager
      ? [
          {
            accessorKey: "profiles.full_name",
            header: "Employee",
            cell: ({ row }) => row.original.profiles?.full_name ?? "--",
          } as ColumnDef<Row>,
        ]
      : []),
    {
      accessorKey: "week_start",
      header: "Week",
      cell: ({ row }) => formatWeekRange(row.original.week_start),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "review_status",
      header: "Review",
      cell: ({ row }) => {
        const reviewStatus = getReviewStatus(row.original);
        if (!reviewStatus) return "--";
        return (
          <StatusBadge
            status={
              reviewStatus
            }
          />
        );
      },
    },
    {
      accessorKey: "submitted_at",
      header: "Submitted",
      cell: ({ row }) =>
        row.original.submitted_at
          ? new Date(row.original.submitted_at).toLocaleString()
          : "--",
    },
    {
      id: "actions",
      header: "Action",
      meta: { align: "center" },
        cell: ({ row }) => (
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`${detailHrefBase}/${row.original.id}`} prefetch={false}>
                <Eye className="h-4 w-4" />
                View
              </Link>
            </Button>
          </div>
      ),
    },
  ];

  if (isManager) {
    const grouped = rows.reduce<Record<string, Row[]>>((acc, row) => {
      const key = row.profiles?.full_name ?? "Unknown";
      if (!acc[key]) acc[key] = [];
      acc[key].push(row);
      return acc;
    }, {});

    const sortedGroups = Object.entries(grouped).sort(([a], [b]) =>
      a.toLowerCase().localeCompare(b.toLowerCase()),
    );

    return (
      <div className="space-y-5">
        {sortedGroups.map(([name, groupRows]) => (
          <div
            key={name}
            className="overflow-hidden rounded-xl border border-rose-100 bg-white shadow-sm"
          >
            <div className="flex items-center justify-between bg-rose-50 px-4 py-3">
              <p className="text-sm font-semibold text-rose-900 tracking-wide">{name}</p>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-rose-700 border border-rose-200 shadow-sm">
                {groupRows.length} schedules
              </span>
            </div>
            <div className="w-full max-w-full bg-white overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[640px] table-fixed text-sm bg-white">
                <colgroup>
                  <col className="w-36" />
                  <col className="w-28" />
                  <col className="w-28" />
                  <col className="w-40" />
                  <col className="w-24" />
                </colgroup>
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-500 text-[11px] uppercase tracking-[0.12em]">
                    <th className="p-3">Week</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Review</th>
                    <th className="p-3">Submitted</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {groupRows
                    .slice()
                    .sort((a, b) => (b.week_start ?? "").localeCompare(a.week_start ?? ""))
                    .map((row) => {
                      const reviewStatus = getReviewStatus(row);
                      return (
                        <tr key={row.id} className="border-t border-slate-200 hover:bg-slate-50/70">
                          <td className="p-3 text-slate-800 whitespace-nowrap">
                            {formatWeekRange(row.week_start)}
                          </td>
                          <td className="p-3">
                            <StatusBadge status={row.status} />
                          </td>
                          <td className="p-3">
                            {reviewStatus ? <StatusBadge status={reviewStatus} /> : "--"}
                          </td>
                          <td className="p-3 text-slate-800 whitespace-nowrap">
                            {row.submitted_at
                              ? new Date(row.submitted_at).toLocaleString()
                          : "--"}
                          </td>
                          <td className="p-3 text-center">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/schedule/${row.id}`} prefetch={false}>
                                <Eye className="h-4 w-4" />
                                View
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <DataTable columns={columns} data={rows} useTableOnMobile />;
}
