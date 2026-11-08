"use client";

/**
 * B08 — LIVE (active live session).
 *
 * Production fidelity disclosure (`docs/ui-lab/gate-b-w5-candidates/BLOCKERS.md` item #3,
 * RESOLVED): the real `LiveMatchClient` (`@/components/live-match/live-match-client`) is mounted
 * UNMODIFIED below — it has zero server-only imports and zero hardcoded network calls; every
 * production side effect is reached only through its injected `actions` prop. This page supplies
 * `useB08LiveFixtureActions`, a fixture-local, synchronous, in-memory `LiveMatchActions`
 * implementation (`../shared/safe-transition-controller.ts`) in place of both production adapters
 * (`league-live-match-client.tsx`/`event-live-match-client.tsx`), so recording an event here can
 * never reach a real persistence endpoint or realtime coordinator. A clearly synthetic
 * `matchId` is used (distinct from `B08_MATCH_ID`) so this fixture's harmless-but-real browser
 * side effects (`registerLiveServiceWorker()`, the local IndexedDB outbox) never collide with any
 * real match's local rows on this device.
 *
 * NOT mounted: the real `FollowLiveClient` (`@/components/live-match/follow-live-client.tsx`) —
 * it performs its own real realtime-ticket fetch and Durable Object connection on mount, which is
 * not safely fixture-injectable without a second stubbing layer this wave doesn't need. The
 * reporter-vs-follower distinction below is instead demonstrated with a small read-only summary
 * panel built from the same real presentational primitives (`MatchScoreHeader`).
 *
 * B08 W5 remediation (independent review, P2-9): this follower summary is now derived from the
 * SAME event ledger the reporter's own `LiveMatchClient` reads/writes (`useB08LiveFixtureActions`'
 * own `events`), via the real `buildMatchPresentation()` — not a second, static, independently
 * frozen score. Recording a goal in the reporter panel below updates this follower panel's own
 * score on the very next render; it can no longer silently disagree with what the reporter
 * actually recorded (the "Preferred: Shared fixture projection" option the review itself names).
 *
 * W5 second remediation (lifecycle data consistency, 2026-11-08): the score is now computed via
 * `shared/b08-projection.ts`'s `computeEffectiveLiveEvents()` + `deriveEffectiveScore()`, the same
 * reversal-aware derivation every other B08 workspace uses — a reversed goal (the real LIVE
 * reporter's own "Undo" control, which emits an `EVENT_REVERSED` event) now correctly stops
 * counting here too, matching the reporter's own real `goalsFor`/`goalsAgainst` React state
 * exactly instead of silently disagreeing with it.
 */

import Link from "next/link";
import { AppearanceControl, MatchScoreHeader } from "@/components/touchline";
import { LiveMatchClient } from "@/components/live-match/live-match-client";
import { buildPeriodConfigFromFormat } from "@/lib/live-match/period-config";
import { buildMatchPresentation } from "@/lib/matches/match-presentation";
import { B08TransitionNav } from "../shared/transition-nav";
import { B08_MATCH_FORMAT, B08_OPPONENT_NAME, B08_MATCH_ID, B08_KICKOFF_AT } from "../shared/fixture";
import { MATCH_B_TEAM_NAME } from "../../shared/match-b-fixture";
import { useB08LiveFixtureActions } from "../shared/safe-transition-controller";
import { computeEffectiveLiveEvents, deriveEffectiveScore } from "../shared/b08-projection";

const B08_LIVE_FIXTURE_MATCH_ID = "b08-fixture-live-match";

export default function B08LivePage() {
  const { actions, events } = useB08LiveFixtureActions(B08_LIVE_FIXTURE_MATCH_ID);
  const periodConfig = buildPeriodConfigFromFormat(B08_MATCH_FORMAT);
  const effectiveScore = deriveEffectiveScore(computeEffectiveLiveEvents(events));

  const followerPresentation = buildMatchPresentation({
    id: B08_MATCH_ID,
    href: null,
    teamName: MATCH_B_TEAM_NAME,
    opponentName: B08_OPPONENT_NAME,
    isHome: true,
    kickoffAt: B08_KICKOFF_AT,
    lifecycleStatus: "live",
    ownGoals: effectiveScore.ourGoals,
    opponentGoals: effectiveScore.opponentGoals,
    liveClockLabel: "Live",
  });

  return (
    <div className="touchline mx-auto flex max-w-[720px] flex-col gap-4 px-4 py-8" data-ui-lab-ready="true">
      <div>
        <div className="flex items-center gap-3">
          <Link href="/dev/ui-lab/gate-b" className="text-[12px] text-[var(--text-muted)] hover:underline">
            &larr; Gate B
          </Link>
          <Link href="/dev/ui-lab/gate-b/b08-information-ownership/before" className="text-[12px] text-[var(--text-muted)] hover:underline">
            &larr; Back to this match (Before)
          </Link>
        </div>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">B08 — Live (active live session)</h1>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">
          Same match identity as Before/After. Reporter workspace — not Match Details, not the Report.
        </p>
      </div>

      <B08TransitionNav current="live" />
      <AppearanceControl />

      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 px-3 py-2.5">
        <p className="text-[12px] text-[var(--text-muted)]">
          <span className="font-[650] text-[var(--foreground)]">Live recorded events feed the AFTER Events tab later</span> — they
          are not themselves a second copy of post-match reconciliation. The reporter records facts here; the coach
          reconciles and reflects afterwards in the Report.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/20 px-3 py-2.5">
        <p className="text-[11px] font-[650] uppercase tracking-[0.1em] text-[var(--text-muted)]">Read-only follower view (summary)</p>
        <div className="mt-2">
          <MatchScoreHeader presentation={followerPresentation} framed />
        </div>
        <p className="mt-2 text-[12px] text-[var(--text-muted)]">
          A follower sees the same score/clock as the reporter, with no recording controls. The real{" "}
          <code className="rounded bg-[var(--surface-muted)] px-1 py-0.5 text-[11px]">FollowLiveClient</code> is not mounted here (it
          performs a real realtime-ticket fetch on mount) — see this file&rsquo;s own top comment.
        </p>
      </div>

      <LiveMatchClient
        matchId={B08_LIVE_FIXTURE_MATCH_ID}
        teamName={MATCH_B_TEAM_NAME}
        opponentName={B08_OPPONENT_NAME}
        contextLabel="Gate B W5 — B08 fixture"
        periodConfig={periodConfig}
        actions={actions}
        isHome
        markOwnTeam
        subjectType="LEAGUE"
      />
    </div>
  );
}
