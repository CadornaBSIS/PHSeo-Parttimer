import "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<_TData, _TValue> {
    /**
     * Optional horizontal alignment for header and cell content.
     */
    align?: "left" | "center" | "right";
  }
}
