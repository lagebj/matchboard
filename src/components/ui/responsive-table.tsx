import type { ReactNode } from "react";
import Link from "next/link";

/**
 * ResponsiveTable — structural wrapper enforcing PROGRAMME.md §30's rule that
 * horizontal scrolling must never be the *default* way a table is presented
 * on a narrow viewport. Renders the caller's existing `<table>` markup
 * unchanged at the `expanded` tier and above (desktop), and a caller-supplied
 * card/list view below it (compact/medium — phone and tablet-portrait).
 *
 * Deliberately does NOT invent a universal column-definition system: each
 * consuming table already has its own sorting/columns/cell logic (often with
 * interactive controls, not just text), so re-deriving a card view from a
 * generic column model would either lose functionality or force an
 * over-abstracted API. Instead, each caller writes its own small card
 * renderer for its own row shape, and this component only owns the
 * structural switch + empty-state handling — the actual repeated value is
 * "table only at expanded+, one consistent card pattern below it," not a
 * from-scratch redesign of every table.
 */
type ResponsiveTableProps<T> = {
  items: T[];
  /** The existing full `<table>` JSX — rendered as-is at the expanded+ tier. */
  renderTable: () => ReactNode;
  /** One card per item — rendered below the expanded tier. */
  renderCard: (item: T, index: number) => ReactNode;
  getKey: (item: T, index: number) => string | number;
  emptyState?: ReactNode;
  /** Extra classes for the card-list wrapper — e.g. padding when the parent
   * container (a padding-none Surface) doesn't provide its own. */
  cardListClassName?: string;
};

export function ResponsiveTable<T>({
  items,
  renderTable,
  renderCard,
  getKey,
  emptyState,
  cardListClassName,
}: ResponsiveTableProps<T>) {
  return (
    <>
      <div className="hidden expanded:block">{renderTable()}</div>
      <div className={["flex flex-col gap-2 expanded:hidden", cardListClassName].filter(Boolean).join(" ")}>
        {items.length === 0
          ? emptyState
          : items.map((item, index) => (
              <div key={getKey(item, index)}>{renderCard(item, index)}</div>
            ))}
      </div>
    </>
  );
}

/**
 * Shared card shell for ResponsiveTable consumers — a Surface-like container
 * with a primary line and a wrapping row of secondary field/value pairs, so
 * cards across Players/Opponents/Insights share one visual language instead
 * of each inventing its own.
 */
export function ResponsiveTableCard({
  title,
  titleHref,
  fields,
  actions,
}: {
  title: ReactNode;
  titleHref?: string;
  fields: Array<{ label: string; value: ReactNode }>;
  actions?: ReactNode;
}) {
  return (
    <div className="rounded-xl border app-hairline bg-[rgba(12,15,20,0.45)] p-3">
      <div className="font-medium text-zinc-50">
        {titleHref ? (
          <Link href={titleHref} className="hover:underline">
            {title}
          </Link>
        ) : (
          title
        )}
      </div>
      <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {fields.map((field) => (
          <div key={field.label} className="flex flex-col">
            <dt className="app-copy-muted uppercase tracking-[0.12em] text-[10px]">{field.label}</dt>
            <dd className="app-copy-soft">{field.value}</dd>
          </div>
        ))}
      </dl>
      {actions && <div className="mt-2.5 flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
