"use client";

import type { SortDirection } from "@/lib/table-sort";

type SortableHeaderProps = {
  activeKey: string;
  className?: string;
  direction: SortDirection;
  label: string;
  sortKey: string;
  onSort: (sortKey: string) => void;
};

export function SortableHeader({
  activeKey,
  className = "px-4 py-3 font-semibold",
  direction,
  label,
  sortKey,
  onSort,
}: SortableHeaderProps) {
  const isActive = activeKey === sortKey;

  return (
    <th className={className}>
      <button
        className="inline-flex items-center gap-2 text-left"
        onClick={() => onSort(sortKey)}
        type="button"
      >
        <span>{label}</span>
        <span aria-hidden="true" className="text-[10px] text-zinc-400">
          {isActive ? (direction === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}
