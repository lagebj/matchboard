"use client";

import Link from "next/link";
import { useState } from "react";
import { SortableHeader } from "@/components/sortable-header";
import { formatDate, formatIsoWeekLabel } from "@/lib/date-utils";
import { formatMatchVenue } from "@/lib/match-utils";
import {
  applySortDirection,
  compareDate,
  compareNumber,
  compareText,
  getNextSortDirection,
  type SortDirection,
} from "@/lib/table-sort";

type MatchRow = {
  availableForDevelopmentSlot: boolean;
  createdAt: Date;
  deleteAction: () => Promise<void>;
  homeOrAway: "HOME" | "AWAY";
  id: string;
  latestSelectionStatus: "DRAFT" | "FINALIZED" | null;
  matchType: string | null;
  notes: string | null;
  opponent: string;
  squadSize: number;
  startsAt: Date;
  targetTeam: {
    id: string;
    name: string;
  };
  updateDevelopmentAvailabilityAction: (formData: FormData) => Promise<void>;
};

type MatchTableProps = {
  matches: MatchRow[];
  recalculateMatchesAction: (formData: FormData) => Promise<void>;
};

function formatSelectionStatus(status: MatchRow["latestSelectionStatus"]) {
  if (status === "FINALIZED") {
    return "Finalized";
  }

  if (status === "DRAFT") {
    return "Draft";
  }

  return "None";
}

function getSelectionPillClassName(status: MatchRow["latestSelectionStatus"]) {
  if (status === "FINALIZED") {
    return "border-[rgba(140,167,146,0.28)] bg-[rgba(140,167,146,0.12)] text-[var(--accent-strong)]";
  }

  if (status === "DRAFT") {
    return "border-[rgba(208,176,127,0.26)] bg-[rgba(208,176,127,0.12)] text-[var(--warning)]";
  }

  return "border-[rgba(202,209,219,0.14)] bg-[rgba(255,255,255,0.04)] text-[var(--text-soft)]";
}

export function MatchTable({
  matches,
  recalculateMatchesAction,
}: MatchTableProps) {
  const [sortKey, setSortKey] = useState("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  function updateSort(nextSortKey: string) {
    setSortDirection((currentDirection) =>
      getNextSortDirection(sortKey, nextSortKey, currentDirection),
    );
    setSortKey(nextSortKey);
  }

  const sortedMatches = [...matches].sort((left, right) => {
    if (sortKey === "team") {
      return applySortDirection(compareText(left.targetTeam.name, right.targetTeam.name), sortDirection);
    }

    if (sortKey === "opponent") {
      return applySortDirection(compareText(left.opponent, right.opponent), sortDirection);
    }

    if (sortKey === "size") {
      return applySortDirection(compareNumber(left.squadSize, right.squadSize), sortDirection);
    }

    if (sortKey === "type") {
      return applySortDirection(compareText(left.matchType, right.matchType), sortDirection);
    }

    if (sortKey === "venue") {
      return applySortDirection(
        compareText(formatMatchVenue(left.homeOrAway), formatMatchVenue(right.homeOrAway)),
        sortDirection,
      );
    }

    if (sortKey === "selection") {
      return applySortDirection(
        compareText(formatSelectionStatus(left.latestSelectionStatus), formatSelectionStatus(right.latestSelectionStatus)),
        sortDirection,
      );
    }

    return applySortDirection(compareDate(left.startsAt, right.startsAt), sortDirection);
  });
  const draftCount = matches.filter((match) => match.latestSelectionStatus === "DRAFT").length;
  const unstartedCount = matches.filter((match) => match.latestSelectionStatus === null).length;
  const finalizedCount = matches.filter((match) => match.latestSelectionStatus === "FINALIZED").length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Full Ledger
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-zinc-50">
            Deeper table for sorting and cleanup
          </h2>
          <p className="mt-3 max-w-3xl text-sm app-copy-soft">
            Use this after the weekly cards.
          </p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
            Drafts Ready
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-50">{draftCount}</p>
          <p className="mt-2 text-sm app-copy-soft">Resume these first.</p>
        </div>
        <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
            First Draft Needed
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-50">{unstartedCount}</p>
          <p className="mt-2 text-sm app-copy-soft">No saved draft yet.</p>
        </div>
        <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
            Locked History
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-50">{finalizedCount}</p>
          <p className="mt-2 text-sm app-copy-soft">Locked for context.</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-100">Draft recalculation</p>
          <p className="mt-1 text-sm app-copy-soft">
            Every recalculation checks the rest of the saved draft and finalized board before it writes new draft work.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={recalculateMatchesAction}>
            <input name="scope" type="hidden" value="all" />
            <button
              className="h-10 rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-4 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
              type="submit"
            >
              Recalculate all draft matches
            </button>
          </form>
          <button
            className="h-10 rounded-full border app-hairline bg-[rgba(255,255,255,0.04)] px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.08)] hover:text-zinc-50"
            form="recalculate-matches"
            name="scope"
            type="submit"
            value="selected"
          >
            Recalculate selected drafts
          </button>
        </div>
      </div>

      <form action={recalculateMatchesAction} id="recalculate-matches" />

      <div className="overflow-hidden rounded-[1.4rem] border app-hairline bg-[rgba(12,15,20,0.45)]">
        <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
          <thead className="border-b app-hairline bg-[rgba(255,255,255,0.04)] text-xs uppercase tracking-wide app-copy-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Pick</th>
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="Date"
                onSort={updateSort}
                sortKey="date"
              />
              <th className="px-4 py-3 font-semibold">Week</th>
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="Target Team"
                onSort={updateSort}
                sortKey="team"
              />
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="Home/Away"
                onSort={updateSort}
                sortKey="venue"
              />
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="Opponent"
                onSort={updateSort}
                sortKey="opponent"
              />
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="Squad Size"
                onSort={updateSort}
                sortKey="size"
              />
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="Match Type"
                onSort={updateSort}
                sortKey="type"
              />
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="Selection"
                onSort={updateSort}
                sortKey="selection"
              />
              <th className="px-4 py-3 font-semibold">Development</th>
              <th className="px-4 py-3 font-semibold">Notes</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y app-hairline">
            {sortedMatches.map((match) => {
              const canRecalculate = match.latestSelectionStatus !== "FINALIZED";
              const rowToneClassName =
                match.latestSelectionStatus === "FINALIZED"
                  ? "bg-[rgba(140,167,146,0.04)]"
                  : match.latestSelectionStatus === "DRAFT"
                    ? "bg-[rgba(208,176,127,0.035)]"
                    : "bg-transparent";

              return (
                <tr
                  key={match.id}
                  className={`align-top ${rowToneClassName} hover:bg-[rgba(255,255,255,0.035)]`}
                >
                  <td className="px-4 py-3">
                    <input
                      className="h-4 w-4 rounded border-[var(--border-strong)] bg-transparent text-[var(--accent)]"
                      disabled={!canRecalculate}
                      form="recalculate-matches"
                      name="selectedMatchIds"
                      type="checkbox"
                      value={match.id}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-50">
                    <Link
                      className="block rounded-xl px-2 py-2 -mx-2 -my-2 hover:bg-[rgba(255,255,255,0.05)]"
                      href={`/selection/${match.id}`}
                    >
                      {formatDate(match.startsAt)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 app-copy-soft">{formatIsoWeekLabel(match.startsAt)}</td>
                  <td className="px-4 py-3">
                    <Link
                      className="block rounded-xl px-2 py-2 -mx-2 -my-2 text-zinc-100 hover:bg-[rgba(255,255,255,0.05)]"
                      href={`/selection/${match.id}`}
                    >
                      {match.targetTeam.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 app-copy-soft">{formatMatchVenue(match.homeOrAway)}</td>
                  <td className="px-4 py-3 text-zinc-100">{match.opponent}</td>
                  <td className="px-4 py-3 app-copy-soft">{match.squadSize}</td>
                  <td className="px-4 py-3 app-copy-soft">{match.matchType ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] ${getSelectionPillClassName(match.latestSelectionStatus)}`}
                    >
                      {formatSelectionStatus(match.latestSelectionStatus)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <form action={match.updateDevelopmentAvailabilityAction} className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 text-xs text-zinc-100">
                        <input
                          defaultChecked={match.availableForDevelopmentSlot}
                          name="availableForDevelopmentSlot"
                          type="checkbox"
                        />
                        Development open
                      </label>
                      <button
                        className="h-8 rounded-full border app-hairline px-3 text-xs font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
                        type="submit"
                      >
                        Save
                      </button>
                    </form>
                  </td>
                  <td className="max-w-sm px-4 py-3 app-copy-soft">
                    {match.notes ? (
                      <span className="line-clamp-3 whitespace-pre-wrap">{match.notes}</span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        className="inline-flex h-9 items-center rounded-full border app-hairline px-3 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
                        href={`/selection/${match.id}`}
                      >
                        Open workspace
                      </Link>
                      <form action={match.deleteAction}>
                        <button
                          className="h-9 rounded-full border border-[rgba(185,128,119,0.3)] px-3 text-sm font-medium text-[var(--danger)] hover:bg-[rgba(185,128,119,0.08)]"
                          type="submit"
                        >
                          Remove match
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}

            {sortedMatches.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center app-copy-muted" colSpan={12}>
                  No matches created yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
