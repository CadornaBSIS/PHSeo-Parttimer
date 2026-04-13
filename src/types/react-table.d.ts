import "@tanstack/react-table";

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData, TValue> {
    /**
     * Optional horizontal alignment for header and cell content.
     */
    align?: "left" | "center" | "right";
  }
}
