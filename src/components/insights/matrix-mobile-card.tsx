import type { ReactNode } from "react";

/**
 * MatrixMobileCard — the phone/tablet-tier view for a player×round Insights
 * matrix row (Opportunity Matrix, Load Timeline, Player Pathways). These are
 * genuine 2D matrices, not simple field/value rows, so `ResponsiveTableCard`
 * doesn't fit — a matrix row's real content is a variable-length list of
 * per-round cells, not a fixed field set.
 *
 * Per-round cells wrap as a flex-wrap chip list (each chip carries its own
 * round label) instead of either horizontal scroll (the exact anti-pattern
 * PROGRAMME.md §30 forbids) or a long vertical per-round list (unnecessarily
 * tall for a full-season round count). Wrapping keeps every round visible
 * without introducing scroll of any kind.
 */
export type MatrixMobileCell = {
  key: string;
  /** Short round label shown inside the chip, e.g. "R3". */
  roundLabel: string;
  /** The status text/count shown next to the round label. */
  value: ReactNode;
  /** Status color classes — reuse the same style map the table view uses. */
  className: string;
  title?: string;
};

export function MatrixMobileCard({
  title,
  subtitle,
  note,
  cells,
  totals,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  note?: ReactNode;
  cells: MatrixMobileCell[];
  totals?: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-zinc-200">{title}</span>
        {subtitle && <span className="text-xs text-zinc-400">{subtitle}</span>}
      </div>
      {note && <p className="mt-0.5 text-[10px] text-amber-400">{note}</p>}
      <div className="mt-2 flex flex-wrap gap-1">
        {cells.map((cell) => (
          <span
            key={cell.key}
            title={cell.title}
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${cell.className}`}
          >
            <span className="opacity-70">{cell.roundLabel}</span>
            {cell.value}
          </span>
        ))}
      </div>
      {totals && totals.length > 0 && (
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-zinc-800 pt-2 text-[11px]">
          {totals.map((t) => (
            <div key={t.label} className="flex items-center gap-1">
              <dt className="text-zinc-500">{t.label}</dt>
              <dd className="font-medium text-zinc-200">{t.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
