"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { formatMinutes } from "@/utils/date";

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
  if (isManager) {
    const grouped = data.reduce<Record<string, Row[]>>((acc, row) => {
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
        {sortedGroups.map(([name, rows]) => (
          <div
            key={name}
            className="overflow-hidden rounded-xl border border-rose-100 bg-white shadow-sm"
          >
            <div className="flex items-center justify-between bg-rose-50 px-4 py-3">
              <p className="text-sm font-semibold text-rose-900 tracking-wide">{name}</p>
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-rose-700 border border-rose-200 shadow-sm">
                {rows.length} entries
              </span>
            </div>
            <div className="relative w-full max-w-full overflow-x-auto overscroll-x-contain bg-white rounded-b-xl">
              <table className="w-full min-w-[640px] table-fixed text-sm bg-white">
                <colgroup>
                  <col className="w-32" />
                  <col className="w-[28rem]" />
                  <col className="w-24" />
                  <col className="w-24" />
                  <col className="w-24" />
                </colgroup>
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-500 text-[11px] uppercase tracking-[0.12em]">
                    <th className="p-3">Date</th>
                    <th className="p-3">Project / Account</th>
                    <th className="p-3">Duration</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows
                    .slice()
                    .sort((a, b) => (b.work_date ?? "").localeCompare(a.work_date ?? ""))
                    .map((row) => (
                      <tr key={row.id} className="border-t border-slate-200 hover:bg-slate-50/70">
                        <td className="p-3 text-slate-800 whitespace-nowrap">{row.work_date}</td>
                        <td className="p-3 truncate text-slate-700">{row.project_account ?? "--"}</td>
                        <td className="p-3 text-slate-800 whitespace-nowrap">
                          {formatMinutes(row.duration_minutes)}
                        </td>
                        <td className="p-3">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="p-3 text-center">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/dtr/${row.id}`} prefetch={false}>
                              <Eye className="h-4 w-4" />
                              View
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <div className="sm:hidden px-3 py-2 text-[11px] text-slate-500 italic">
                Swipe left/right to see all columns.
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

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
  ];

  return <DataTable columns={columns} data={data} useTableOnMobile />;
}
