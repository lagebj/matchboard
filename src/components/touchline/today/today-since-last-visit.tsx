"use client";

/**
 * Today "Since your last visit" section (ADR-0141, `04_BROWSER_LOCAL_STATE.md`). Reads the
 * previous browser-local snapshot on mount, diffs it against the current server-rendered facts,
 * renders the diff for this mounted visit only, then persists the current snapshot as the next
 * baseline. First visit (no previous snapshot) renders nothing — never an empty card.
 */

import { useEffect, useState } from "react";
import {
  buildTodayVisitSnapshot,
  diffTodayVisitSnapshots,
  type TodayVisitCurrentFacts,
  type TodayVisitChangeRow,
  type TodayVisitSnapshotV1,
} from "@/lib/touchline/presentation/today-visit-snapshot";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";

const MAX_SHOWN = 5;

export function TodaySinceLastVisit({ scope, facts }: { scope: string; facts: TodayVisitCurrentFacts }) {
  const storageKey = `matchboard:today:visit:v1:${scope}`;
  const [rows, setRows] = useState<TodayVisitChangeRow[] | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let previous: TodayVisitSnapshotV1 | null = null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      previous = raw ? (JSON.parse(raw) as TodayVisitSnapshotV1) : null;
    } catch {
      previous = null;
    }

    const diff = diffTodayVisitSnapshots(previous, facts);
    setRows(diff.rows);

    try {
      const next = buildTodayVisitSnapshot(facts, Date.now());
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Fail open — the section simply won't have a baseline for the next visit.
    }
    // Intentionally runs once per mount only — an RSC refresh during the same visit must not
    // turn this into a noisy self-audit feed (04_BROWSER_LOCAL_STATE.md "Mount semantics").
  }, []);

  if (!rows || rows.length === 0) return null;

  const shown = showAll ? rows : rows.slice(0, MAX_SHOWN);
  const remaining = rows.length - shown.length;

  return (
    <Surface padding="md" className="flex flex-col gap-2">
      <SectionHeader title="Since your last visit" />
      <ul className="flex flex-col gap-1">
        {shown.map((row, i) => (
          <li key={i} className="text-xs text-[var(--text-muted)]">
            {row.text}
          </li>
        ))}
      </ul>
      {!showAll && remaining > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="self-start text-xs text-[var(--text-muted)] underline underline-offset-2 hover:text-[var(--foreground)]"
        >
          Show {remaining} more
        </button>
      )}
    </Surface>
  );
}
