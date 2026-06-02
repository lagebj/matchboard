import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes, HTMLAttributes } from "react";

/**
 * DataTable — consistent table wrapper.
 *
 * Per ADR 0007: compact but readable; first column strong; numeric columns
 * right-aligned; soft row separators (no heavy nested borders).
 *
 * Usage:
 *   <DataTable>
 *     <DataTable.Head>
 *       <DataTable.Row>
 *         <DataTable.HeaderCell>Player</DataTable.HeaderCell>
 *         <DataTable.HeaderCell align="right">Played</DataTable.HeaderCell>
 *       </DataTable.Row>
 *     </DataTable.Head>
 *     <DataTable.Body>
 *       <DataTable.Row>...</DataTable.Row>
 *     </DataTable.Body>
 *   </DataTable>
 */
type DataTableProps = {
  className?: string;
  children: ReactNode;
  /** Add overflow-x-auto wrapper for wide tables. Defaults to true. */
  scrollable?: boolean;
  /** Min width applied to the inner <table>. Useful when scrollable. */
  minWidth?: string;
};

export function DataTable({
  className = "",
  children,
  scrollable = true,
  minWidth,
}: DataTableProps) {
  const table = (
    <table
      className={`w-full text-sm ${minWidth ? "" : ""}`}
      style={minWidth ? { minWidth } : undefined}
    >
      {children}
    </table>
  );
  return (
    <div
      className={[
        "rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] overflow-hidden",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {scrollable ? (
        <div className="overflow-x-auto">{table}</div>
      ) : (
        table
      )}
    </div>
  );
}

function Head({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <thead className={`bg-[var(--surface-muted)]/60 ${className}`.trim()}>
      {children}
    </thead>
  );
}
Head.displayName = "DataTable.Head";

function Body({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <tbody
      className={`divide-y divide-[var(--border-soft)] ${className}`.trim()}
    >
      {children}
    </tbody>
  );
}
Body.displayName = "DataTable.Body";

type RowProps = HTMLAttributes<HTMLTableRowElement> & {
  hoverable?: boolean;
  muted?: boolean;
};

function Row({
  hoverable = true,
  muted = false,
  className = "",
  children,
  ...rest
}: RowProps) {
  return (
    <tr
      className={[
        hoverable ? "hover:bg-[var(--surface-muted)]/30 transition-colors" : "",
        muted ? "text-[var(--text-muted)]" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </tr>
  );
}
Row.displayName = "DataTable.Row";

type Alignment = "left" | "right" | "center";

type HeaderCellProps = Omit<ThHTMLAttributes<HTMLTableCellElement>, "align"> & {
  align?: Alignment;
};

const alignClass: Record<Alignment, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

function HeaderCell({
  align = "left",
  className = "",
  children,
  ...rest
}: HeaderCellProps) {
  return (
    <th
      scope="col"
      className={[
        "px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]",
        alignClass[align],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </th>
  );
}
HeaderCell.displayName = "DataTable.HeaderCell";

type CellProps = Omit<TdHTMLAttributes<HTMLTableCellElement>, "align"> & {
  align?: Alignment;
  numeric?: boolean;
  muted?: boolean;
  primary?: boolean;
};

function Cell({
  align,
  numeric,
  muted,
  primary,
  className = "",
  children,
  ...rest
}: CellProps) {
  const finalAlign: Alignment = align ?? (numeric ? "right" : "left");
  return (
    <td
      className={[
        "px-3 py-2",
        alignClass[finalAlign],
        numeric ? "tabular-nums" : "",
        muted
          ? "text-[var(--text-muted)]"
          : primary
            ? "text-zinc-50 font-medium"
            : "text-[var(--text-soft)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </td>
  );
}
Cell.displayName = "DataTable.Cell";

DataTable.Head = Head;
DataTable.Body = Body;
DataTable.Row = Row;
DataTable.HeaderCell = HeaderCell;
DataTable.Cell = Cell;
