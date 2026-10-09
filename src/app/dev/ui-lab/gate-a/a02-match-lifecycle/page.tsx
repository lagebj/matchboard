"use client";

import Link from "next/link";
import { AppearanceControl, OperationalMatchCard, MatchScoreHeader } from "@/components/touchline";
import { plannedMatchIdentity, liveMatchIdentity, completedMatchIdentity } from "./fixtures";

/**
 * `/dev/ui-lab/gate-a/a02-match-lifecycle` — A02 candidate (`20_UI_LAB_CANDIDATE_WAVES.md`): the
 * same match object (`gate-a-match-1`, Rød vs Sætre Lions) rendered through the real
 * `OperationalMatchCard` + `MatchScoreHeader` at three lifecycle states. Proves one football
 * identity persists across planned → live → completed (D1, XR-S01) — no separate "before" /
 * "after" visual system, and no fabricated score before kickoff.
 */
const STATES = [
  { key: "planned", label: "Planned", presentation: plannedMatchIdentity },
  { key: "live", label: "Live", presentation: liveMatchIdentity },
  { key: "completed", label: "Completed", presentation: completedMatchIdentity },
];

export default function A02MatchLifecyclePage() {
  return (
    <div className="touchline mx-auto flex max-w-[480px] flex-col gap-6 px-4 py-8">
      <div>
        <Link href="/dev/ui-lab/gate-a" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; Gate A candidates
        </Link>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A02 — Match identity across lifecycle</h1>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">
          Rød vs Sætre Lions, same match id, at three real lifecycle states. Team names, order and
          own-team marker never change; only lifecycle-true facts (score, clock, outcome) differ.
        </p>
      </div>

      <AppearanceControl />

      <div className="flex flex-col gap-5">
        {STATES.map((s) => (
          <div key={s.key}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{s.label}</p>
            <OperationalMatchCard presentation={s.presentation} />
          </div>
        ))}
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          Same identity, score-header treatment
        </p>
        <MatchScoreHeader presentation={liveMatchIdentity} framed />
      </div>
    </div>
  );
}
