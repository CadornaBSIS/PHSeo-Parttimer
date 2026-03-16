"use client";

import {
  flexRender,
  getCoreRowModel,
  ColumnDef,
  useReactTable,
} from "@tanstack/react-table";

type DataTableProps<T> = {
  columns: ColumnDef<T, unknown>[];
  data: T[];
};

export function DataTable<T>({ columns, data }: DataTableProps<T>) {
  // The TanStack table hook returns non-memoizable helpers; React Compiler warns but this is expected usage.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <table className="w-full text-sm">
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
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id} className="border-b border-border hover:bg-slate-50/70">
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id} className="px-4 py-3">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
        {!table.getRowModel().rows.length ? (
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
  );
}
