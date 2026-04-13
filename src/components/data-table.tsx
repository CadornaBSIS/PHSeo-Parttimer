"use client";

import { ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  ColumnDef,
  useReactTable,
} from "@tanstack/react-table";

type DataTableProps<T> = {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  useTableOnMobile?: boolean;
};

export function DataTable<T>({ columns, data, useTableOnMobile = false }: DataTableProps<T>) {
  // The TanStack table hook returns non-memoizable helpers; React Compiler warns but this is expected usage.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const rows = table.getRowModel().rows;
  const leafHeaders = table.getHeaderGroups().at(-1)?.headers ?? [];

  const renderHeaderLabel = (columnId: string): ReactNode => {
    const header = leafHeaders.find((h) => h.column.id === columnId);
    if (!header || header.isPlaceholder) return null;
    const content = flexRender(header.column.columnDef.header, header.getContext());
    if (content === "" || content === null) return null;
    return content;
  };

  // When `useTableOnMobile` is true, render only the table (horizontally scrollable) at all breakpoints.
  if (useTableOnMobile) {
    return (
      <div className="space-y-3">
        <div className="w-full max-w-full overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-border">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className={`px-4 py-3 ${header.column.columnDef.meta?.align === "center" ? "text-center" : "text-left"} text-xs font-semibold text-slate-500`}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border hover:bg-slate-50/70"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={`px-4 py-3 ${cell.column.columnDef.meta?.align === "center" ? "text-center" : "text-left"}`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td
                    className="px-4 py-3 text-sm text-slate-500"
                    colSpan={Math.max(table.getVisibleFlatColumns().length, 1)}
                  >
                    No data
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Default: cards on mobile, table on desktop.
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:hidden">
        {rows.length ? (
          rows.map((row) => (
            <div
              key={row.id}
              className="rounded-xl border border-border bg-card shadow-card p-4 space-y-3"
            >
              {row.getVisibleCells().map((cell) => {
                const label = renderHeaderLabel(cell.column.id);
                return (
                  <div
                    key={cell.id}
                    className="flex items-start justify-between gap-3 text-sm"
                  >
                    {label ? (
                      <span className="min-w-[96px] shrink-0 text-xs font-semibold text-slate-500">
                        {label}
                      </span>
                    ) : null}
                    <div className="flex-1 text-right text-slate-800">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-border bg-card p-4 text-sm text-slate-500">
            No data
          </div>
        )}
      </div>

      <div className="hidden sm:block">
        <div className="w-full max-w-full overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-border">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-semibold text-slate-500"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border hover:bg-slate-50/70"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td
                    className="px-4 py-3 text-sm text-slate-500"
                    colSpan={Math.max(table.getVisibleFlatColumns().length, 1)}
                  >
                    No data
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
