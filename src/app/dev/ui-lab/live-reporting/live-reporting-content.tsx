"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { StatusText, LiveScoreStrip, LiveActionGrid, TouchlineBottomSheet } from "@/components/touchline";
import { liveReportingMatch, liveReportingActions, liveReportingEvents, liveReportingRoster } from "../fixtures";

/**
 * Golden: live-reporting-mobile (390×844). Touchline Finish & Visual
 * Convergence follow-up (`07_LIVE_MATCHDAY_AND_OVERLAYS.md §1`).
 *
 * Deviation from the golden reference (recorded per `10_REFERENCE_
 * CONFORMANCE.md` / the conformance report): the golden's action grid shows
 * Goal / Shot / Yellow / Red / Substitution / Foul / Corner / Free kick — 8
 * action types. Matchboard's canonical `LiveMatchEventType` supports only
 * Goal (for/against), Rotation (substitution), Fair play (positive/concern)
 * and Moment marked. Shot/Yellow/Red/Foul/Corner/Free kick are NOT modelled
 * by the domain and are deliberately not reproduced — the closest
 * representation using existing data is shown instead.
 */
export function LiveReportingContent() {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      <div className="flex items-start justify-between gap-3 pt-1">
        <div>
          <h1 className="text-[22px] font-[650] leading-tight text-[var(--foreground)]">Live reporting</h1>
          <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">G2015 · Autumn 2026</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusText tone="live" dot strong>LIVE</StatusText>
          <button type="button" aria-label="More actions" className="text-[var(--text-muted)]">
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)]">
        <LiveScoreStrip presentation={liveReportingMatch} />
      </div>

      <div className="mt-5">
        <LiveActionGrid
          actions={liveReportingActions.map((a) => ({ ...a, onClick: () => setPickerOpen(true) }))}
        />
      </div>

      <section className="mt-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[18px] font-[620] text-[var(--foreground)]">Match events</h2>
          <span className="text-[13px] text-[var(--text-muted)]">All events</span>
        </div>
        <ul className="mt-2 divide-y divide-[var(--border-soft)] border-t border-[var(--border-soft)]">
          {liveReportingEvents.map((e, i) => (
            <li key={i} className="flex items-center gap-3 py-2.5 text-[14px]">
              <span className="w-12 shrink-0 tabular-nums text-[12px] text-[var(--text-muted)]">{e.time}</span>
              <span className="w-20 shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
                {e.tag}
              </span>
              <span className="min-w-0 flex-1 truncate text-[var(--text-soft)]">{e.text}</span>
              {e.score ? (
                <span className="tl-sport shrink-0 text-[15px] font-[700] text-[var(--foreground)]">{e.score}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <TouchlineBottomSheet
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Select player"
        description="Rød"
        ariaLabel="Select player"
        footer={
          <button
            type="button"
            onClick={() => setPickerOpen(false)}
            className="flex h-11 w-full items-center justify-center rounded-[var(--tl-c-radius-control)] bg-[var(--accent)] text-[15px] font-semibold text-[var(--tl-c-accent-on-fill)]"
          >
            Add event
          </button>
        }
      >
        <ul className="flex flex-col gap-1">
          {liveReportingRoster.map((p) => (
            <li key={p.name}>
              <button
                type="button"
                className="flex min-h-[48px] w-full items-center gap-3 rounded-[var(--tl-c-radius-control)] px-2 text-left transition-colors hover:bg-[var(--tl-c-surface-hover)]"
              >
                <span className="w-8 shrink-0 text-[13px] tabular-nums text-[var(--text-muted)]">{p.number}</span>
                <span className="min-w-0 flex-1 text-[15px] font-[600] text-[var(--foreground)]">{p.name}</span>
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  {p.code}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </TouchlineBottomSheet>
    </>
  );
}
