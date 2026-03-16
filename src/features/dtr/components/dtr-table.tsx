"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";

type Row = {
  id: string;
  work_date: string;
  project_account?: string | null;
  duration_minutes: number;
  status: import("@/types/db").DtrStatus;
  profiles?: { full_name?: string | null };
};

export function DtrTable({
  data,
  isManager,
}: {
  data: Row[];
  isManager: boolean;
}) {
  const columns: ColumnDef<Row>[] = [
    ...(isManager
      ? [
          {
            header: "Employee",
            cell: ({ row }) => row.original.profiles?.full_name ?? "--",
          } as ColumnDef<Row>,
        ]
      : []),
    { header: "Date", accessorKey: "work_date" },
    {
      header: "Project/Account",
      accessorKey: "project_account",
      cell: ({ row }) => row.original.project_account ?? "--",
    },
    {
      header: "Duration",
      accessorKey: "duration_minutes",
      cell: ({ row }) => `${row.original.duration_minutes} mins`,
    },
    {
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dtr/${row.original.id}`}>
            <Eye className="h-4 w-4" />
            View
          </Link>
        </Button>
      ),
    },
  ];

  return <DataTable columns={columns} data={data} />;
}
