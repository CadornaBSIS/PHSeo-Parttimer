"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { formatWeekRange } from "@/utils/date";

type Row = {
  id: string;
  week_start: string;
  week_end: string;
  status: import("@/types/db").ScheduleStatus;
  submitted_at?: string | null;
  profiles?: { full_name?: string | null };
  schedule_days?: { approval_status?: "for_approval" | "approved" | "not_approved" | null }[];
};

export function ScheduleTable({
  data,
  isManager,
}: {
  data: Row[];
  isManager: boolean;
}) {
  const getReviewStatus = (row: Row) => {
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
      header: "",
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/schedule/${row.original.id}`}>
            <Eye className="h-4 w-4" />
            View
          </Link>
        </Button>
      ),
    },
  ];

  return <DataTable columns={columns} data={data} />;
}
