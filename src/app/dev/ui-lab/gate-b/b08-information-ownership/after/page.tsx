"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppearanceControl, TouchlineButton, TouchlinePlanningPitch } from "@/components/touchline";
import { TabRail } from "@/components/ui/tab-rail";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { MatchIdentityCard } from "@/components/matches/match-detail/match-identity-card";
import { MatchTimelineList } from "@/components/matches/match-detail/match-timeline-list";
import { MatchFlowPanel } from "@/components/matches/match-detail/match-flow-panel";
import { WhatThisMatchAddedPanel } from "@/components/matches/match-detail/what-this-match-added-panel";
import { MatchEventsPanel } from "@/components/matches/match-detail/match-events-panel";
import { MatchStatsPanel } from "@/components/matches/match-detail/match-stats-panel";
import { MatchAfterMatchPanel } from "@/components/matches/match-detail/match-after-match-panel";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { MetricStrip, type MetricStripItem } from "@/components/touchline/widget/metric-strip";
import { StatusPill } from "@/components/ui/status-pill";
import { CompletedMatchAdvisorPanel } from "@/components/ai/completed-match-advisor-panel";
import { AdvisorPanelUnavailable } from "@/components/ai/advisor-panel";
import { OrgSlugProvider } from "@/components/shell/org-slug-context";
import { getMatchDetailTabs, resolveMatchDetailTab, type MatchDetailTabKey } from "@/lib/matches/match-detail-tabs";
import type { CompletedMatchAdvisorViewModel } from "@/lib/ai/presentation/completed-match-advisor";
import { COACHING_INTENT_LABELS } from "@/lib/coaching/types";
import { matchBPlanningPitchSlots, matchBPlanningPitchAssignments } from "../../shared/match-b-fixture";
import { B08TransitionNav } from "../shared/transition-nav";
import {
  b08AfterIdentity,
  b08Squad,
  B08_OPPONENT_NAME,
  B08_MATCH_ID,
  B08_COACHING_INTENT_CATEGORY,
  B08_COACHING_INTENT_NOTE,
} from "../shared/fixture";
import { b08AfterData, b08InitialReport, b08TimingReview } from "../shared/fixture-history";
import { loadFinishedB08JourneyEvents, loadB08JourneyReport, type B08PersistedReportState } from "../shared/b08-journey";
import { computeEffectiveLiveEvents, deriveGoalsAndAssists, deriveEffectiveScore, deriveB08AfterDataFromReport, deriveB08IdentityFromReport } from "../shared/b08-projection";

/**
 * B08 — AFTER (played, report incomplete).
 *
 * Reproduces the real Match Details AFTER composition from its real sub-components — the same
 * discipline B06/B07 already established for UI Lab candidates (not mounting `AfterMatchOverview`
 * itself, since it embeds two self-fetching production components, `PlanVsRealityPanel` and
 * `MatchTacticsPanel`, neither of which is safely fixture-injectable — disclosed below, not
 * silently dropped).
 *
 * Real tab rail via `getMatchDetailTabs("AFTER")`/`resolveMatchDetailTab` — Overview, Events,
 * Stats and After-match are fully reproduced; Tactics/Opponent context/History are disclosed as
 * not reproduced in this candidate (same disclosed-scope-reduction discipline B05's own "review"
 * tab uses), not faked.
 *
 * Ownership correction (`docs/ui-lab/gate-b-w5-candidates/INFORMATION_OWNERSHIP_MATRIX.md` §3,
 * BLOCKERS.md open item #1/#2): Overview's bottom "Post-match report" widget is deliberately
 * LIGHTER than today's live production `AfterMatchOverview` — a status pill + single link only.
 * The full status/integrity detail (reflection complete, observations, timing, out-of-range, the
 * two banners) stays owned exclusively by the real `MatchAfterMatchPanel` on the "After match" tab
 * below. This is a candidate-level correction, not a claim that production itself changed.
 *
 * B08 W5 remediation (independent review, P1-5): AFTER is not only the "report incomplete" state —
 * it is the same Match Details composition for BOTH "played, report incomplete" and "played,
 * report completed" (ADR-0147: one composition, not a third lifecycle surface). An explicit
 * `?report=completed` query param — set only by REPORT-COMPLETED's own "back to match" link —
 * switches the fixture variant this page reads, in REFERENCE mode only (see below).
 *
 * W5 second remediation (independent review, 2026-11-08, "lifecycle data consistency") — THREE
 * data sources, in priority order, mirroring REPORT-DRAFT's/REPORT-COMPLETED's own identical
 * cascade (`shared/b08-projection.ts`) so all three pages can never disagree about the same match:
 *
 * 1. A PERSISTED, reconciled report (`loadB08JourneyReport()`) — the real, authoritative stored
 *    lifecycle. The `?report=` URL param is deliberately IGNORED here: "the URL may select a
 *    presentation state, but it cannot override the authoritative stored lifecycle" — a journey
 *    that hasn't been locked yet must not be shown as completed just because the URL says so.
 * 2. A finished LIVE journey with no report reconciliation yet — the same reversal-aware seed
 *    REPORT-DRAFT itself derives, so AFTER agrees with what REPORT-DRAFT would show if opened.
 * 3. No journey at all (every direct visit, including every CI/Playwright capture) — the
 *    `?report=` URL switch behaves exactly as before this pass (reference snapshot only).
 *
 * Narrative/evidence content authored for the fixed 2-1 reference match (reflection, football
 * observations, opponent observation, combination evidence, the Assistant Coach insight) is never
 * reproduced for an interactive journey/report (source 1 or 2) — `deriveB08AfterDataFromReport()`
 * already returns those fields empty/null, and the Assistant Coach panel below switches to its
 * own real `{status: "unavailable"}` state instead of fabricating a conclusion. Purely factual/
 * computed content (result, timeline, goals, assists, attendance) remains fully populated — see
 * `INFORMATION_OWNERSHIP_MATRIX.md`'s own provenance rule.
 */
export default function B08AfterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [persistedReport] = useState(() => loadB08JourneyReport());
  const [journeyEvents] = useState(() => loadFinishedB08JourneyEvents());
  const hasJourney = persistedReport !== null || journeyEvents !== null;
  const effectiveEvents = journeyEvents ? computeEffectiveLiveEvents(journeyEvents) : [];

  let isCompleted: boolean;
  let data: ReturnType<typeof b08AfterData>;
  let presentation: ReturnType<typeof b08AfterIdentity>;

  if (persistedReport) {
    isCompleted = persistedReport.status === "LOCKED";
    data = deriveB08AfterDataFromReport(persistedReport, effectiveEvents);
    presentation = deriveB08IdentityFromReport(persistedReport, isCompleted ? "done" : "report_incomplete");
  } else if (journeyEvents) {
    const { goals, assists } = deriveGoalsAndAssists(effectiveEvents);
    const { ourGoals, opponentGoals } = deriveEffectiveScore(effectiveEvents);
    const referenceInitialReport = b08InitialReport("draft");
    const seeded: B08PersistedReportState = {
      status: "REPORTED",
      ourScore: ourGoals,
      opponentScore: opponentGoals,
      goals: goals.map((g) => ({ id: g.id, playerId: g.participantKey, playerName: g.playerName, minute: g.minute })),
      assists: assists.map((a) => ({ id: a.id, playerId: a.participantKey!, playerName: a.playerName })),
      players: referenceInitialReport.playerActuals.map((p) => ({ id: p.id, playerId: p.playerId, playerName: p.playerName, attendanceStatus: p.attendanceStatus, meta: p.coreTeamName })),
      timingReview: b08TimingReview("draft"),
      outOfRangeEventCount: b08AfterData("draft").outOfRangeEventCount,
      completedBy: null,
      completedAt: null,
      nextLocalId: 0,
    };
    isCompleted = false;
    data = deriveB08AfterDataFromReport(seeded, effectiveEvents);
    presentation = deriveB08IdentityFromReport(seeded, "report_incomplete");
  } else {
    const reportVariant = searchParams.get("report") === "completed" ? "completed" : "draft";
    isCompleted = reportVariant === "completed";
    data = b08AfterData(reportVariant);
    presentation = b08AfterIdentity(reportVariant);
  }

  const tabs = getMatchDetailTabs("AFTER");
  const requestedTab = searchParams.get("tab");
  const activeTab = resolveMatchDetailTab("AFTER", requestedTab);

  useEffect(() => {
    if (requestedTab) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", activeTab);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [requestedTab]);

  function selectTab(tab: MatchDetailTabKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  const substitutionCount = data.timeline.filter((i) => i.kind === "ROTATION").length;
  const positionChangeCount = data.shapeChangeRows.reduce((sum, row) => sum + row.changes.length, 0);
  const factsItems: MetricStripItem[] = [
    { id: "goals", label: "Goals", value: presentation.score ? `${presentation.score.home}-${presentation.score.away}` : "—" },
    { id: "players-used", label: "Players used", value: `${data.attendanceSummary.presentCount}/${data.attendanceSummary.totalCount}` },
    { id: "assists", label: "Assists", value: String(data.assistProviders.scorers.reduce((n, s) => n + s.count, 0)) },
    { id: "substitutions", label: "Substitutions", value: String(substitutionCount) },
    { id: "position-changes", label: "Position changes", value: String(positionChangeCount) },
    { id: "observations", label: "Observations", value: String(data.footballObservations.length) },
  ];

  const intentLabel = COACHING_INTENT_LABELS[B08_COACHING_INTENT_CATEGORY] ?? B08_COACHING_INTENT_CATEGORY;
  // Class 4 Assistant Coach hypothesis — bounded, cites this match's own real recorded evidence
  // (a football observation + the team reflection note), never a repackaging of the final score
  // as a "discovery." `clarification: null`/`suggestions: []` keeps every mutation-wired control
  // on the real `CompletedMatchAdvisorPanel` structurally unreachable, matching B07's precedent.
  //
  // W5 second remediation: this specific insight text ("Vollen's equalizer... the coach's own
  // post-match reflection names the same pattern") is authored for the fixed 2-1 REFERENCE match
  // and would misrepresent an interactive journey that ended differently. In interactive mode
  // (`hasJourney`), use the real, already-production-modeled `{status: "unavailable"}` state
  // instead of fabricating a conclusion — never a second, invented "no insight" UI.
  const advisorViewModel: CompletedMatchAdvisorViewModel | null = hasJourney
    ? { status: "unavailable" }
    : {
        status: "fresh",
        summary: "Defensive transition after losing the ball high is the one repeated theme from this match.",
        insights: [
          {
            sectionLabel: "Next focus",
            title: "Tighten defensive transition",
            body: "Vollen's equalizer at 22' followed directly from a lost high turnover — the coach's own post-match reflection names the same pattern.",
            evidenceSources: ["Match data", "Coach observation"],
          },
        ],
        clarification: null,
        suggestions: [],
      };

  return (
    <OrgSlugProvider orgSlug="uilab-demo-org">
      <div className="touchline mx-auto flex max-w-[760px] flex-col gap-4 px-4 py-8" data-ui-lab-ready="true">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/dev/ui-lab/gate-b" className="text-[12px] text-[var(--text-muted)] hover:underline">
              &larr; Gate B
            </Link>
            <Link
              href="/dev/ui-lab/gate-b/b06-league-event-parity/league/match-details"
              className="text-[12px] text-[var(--text-muted)] hover:underline"
            >
              &larr; League matches (navigation origin)
            </Link>
          </div>
          <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">
            {isCompleted ? "B08 — After, report completed" : "B08 — After, report incomplete"}
          </h1>
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">
            {isCompleted ? "Final result recorded. Report completed and locked." : "Final result recorded. Report still needs timing review."}
          </p>
        </div>

        <B08TransitionNav current="after" />
        <AppearanceControl />

        {hasJourney && (
          <div className="rounded-lg border border-dashed border-[var(--accent)]/50 bg-[var(--accent)]/5 px-3 py-2 text-[12px] text-[var(--text-muted)]">
            <span className="font-[650] text-[var(--foreground)]">Reflecting your interactive journey:</span> result, events, goals
            and report status below come from what you actually recorded/reconciled in this browser session. Reflection, football
            observations, opponent observation, combination evidence and the Assistant Coach insight were authored specifically
            for the fixed reference match and are not reproduced here — genuinely unavailable for this interactive journey, not
            hidden by mistake.
          </div>
        )}

        <TabRail items={tabs} activeKey={activeTab} variant="pill" ariaLabel="Match Details sections" onSelect={selectTab} />

        {activeTab === "overview" && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
              <div className="flex items-center justify-center rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-6">
                <MatchIdentityCard presentation={presentation} ownKitColor="#C8102E" />
              </div>
              <TouchlineWidget>
                <WidgetHeader eyebrow="Match summary" title="Team note" />
                <p className="mt-2 text-[13px] text-[var(--text-soft)]">{data.teamNote}</p>
              </TouchlineWidget>
            </div>

            <TouchlineWidget>
              <WidgetHeader eyebrow="Match story" title={`${data.timeline.length} recorded events`} />
              <div className="mt-2">
                <MatchTimelineList items={data.timeline} ownTeamName={presentation.homeTeam} opponentName={B08_OPPONENT_NAME} limit={10} />
              </div>
              {data.timeline.length > 10 && (
                <TouchlineButton variant="ghost" size="sm" className="mt-2" onClick={() => selectTab("events")}>
                  Show all {data.timeline.length} events →
                </TouchlineButton>
              )}
            </TouchlineWidget>

            <MetricStrip items={factsItems} className="rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-4" />

            <TouchlineWidget>
              <WidgetHeader eyebrow="Player involvement" title={`${data.playerInvolvement.length} players`} />
              <ul className="mt-2 flex flex-col divide-y divide-[var(--border-soft)]">
                {data.playerInvolvement.map((row) => (
                  <li key={row.participantKey} className="flex items-center justify-between gap-2 py-1.5 text-[13px]">
                    <span className="min-w-0 truncate text-[var(--foreground)]">{row.playerName}</span>
                    <span className="shrink-0 text-[12px] text-[var(--text-muted)]">
                      {row.minutes != null ? `${row.minutes}′` : "—"}
                      {row.goals > 0 ? ` · ${row.goals}G` : ""}
                      {row.assists > 0 ? ` · ${row.assists}A` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </TouchlineWidget>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Final lineup (as planned)
              </p>
              {/* Real MatchTacticsPanel self-fetches lineup/insights data for a real matchId and
                  carries its own mutation surface (AddPlayerDialog, formation library) — not
                  fixture-injectable, same disclosed gap B08-BEFORE already documents. The real,
                  unmodified TouchlinePlanningPitch (read-only) is reused instead. */}
              <TouchlinePlanningPitch
                slots={matchBPlanningPitchSlots()}
                assignments={matchBPlanningPitchAssignments(b08Squad)}
                readOnly
                compact
                className="max-w-[320px]"
              />
            </div>

            {/* PlanVsRealityPanel omitted here: it self-fetches via a real server action
                (getRotationVsActualAction) keyed on matchId/teamId — not safely mountable against
                a synthetic fixture id. Disclosed omission, matching B06's AFTER page precedent. */}
            <Surface padding="md">
              <SectionHeader title="Plan vs reality" description="Not reproduced in this candidate — the real panel self-fetches against a live server action keyed on this match's real id." />
            </Surface>

            <MatchFlowPanel timeline={data.timeline} ownTeamName={presentation.homeTeam} opponentName={B08_OPPONENT_NAME} />

            <TouchlineWidget>
              <WidgetHeader eyebrow="Coaching intent review" title={intentLabel} />
              <p className="mt-1 text-[13px] text-[var(--text-soft)]">{B08_COACHING_INTENT_NOTE}</p>
              <div className="mt-3">
                {advisorViewModel?.status === "fresh" || advisorViewModel?.status === "stale" ? (
                  <CompletedMatchAdvisorPanel viewModel={advisorViewModel} />
                ) : (
                  <AdvisorPanelUnavailable />
                )}
              </div>
            </TouchlineWidget>

            <WhatThisMatchAddedPanel
              input={{
                hasNewObservations: data.footballObservations.length > 0,
                observationCount: data.footballObservations.length,
                hasNewOpponentEncounter: data.opponentObservation !== null,
                opponentName: B08_OPPONENT_NAME,
                firstTimeCanonicalPositions: data.firstTimeCanonicalPositions,
              }}
            />

            <div className="grid gap-4 lg:grid-cols-3">
              <TouchlineWidget>
                <WidgetHeader eyebrow="Team reflection" title={data.reflection ? "Recorded" : "Not recorded"} />
                {data.reflection && (
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {[
                      { label: "Effort", value: data.reflection.effort },
                      { label: "Team cohesion", value: data.reflection.teamCohesion },
                      { label: "Positional shape", value: data.reflection.positionalShape },
                      { label: "Recovery behaviour", value: data.reflection.recoveryBehavior },
                    ].map((r) => (
                      <li key={r.label} className="flex items-center justify-between gap-2 text-[13px]">
                        <span className="text-[var(--text-muted)]">{r.label}</span>
                        <StatusPill size="sm" variant={r.value === "STRONG" ? "success" : r.value === "NEEDS_ATTENTION" ? "warning" : "neutral"}>
                          {r.value}
                        </StatusPill>
                      </li>
                    ))}
                  </ul>
                )}
              </TouchlineWidget>

              <TouchlineWidget>
                <WidgetHeader eyebrow="Notes" title={data.teamNote ? "Recorded" : "None"} />
                <p className="mt-2 text-[13px] text-[var(--text-soft)]">{data.teamNote}</p>
              </TouchlineWidget>

              {/* CORRECTED (ownership matrix §3): lightened to a status pill + single link —
                  production's own AfterMatchOverview independently repeats the reflection-status
                  + CTA the "After match" tab already owns, with no added information. This widget
                  intentionally differs from today's live production AfterMatchOverview; it is
                  not a capture bug. */}
              <TouchlineWidget>
                <WidgetHeader eyebrow="Post-match report" title="" />
                <StatusPill size="sm" variant={isCompleted ? "success" : "warning"}>
                  {isCompleted ? "Completed" : "Needs work"}
                </StatusPill>
                <TouchlineButton variant="primary" size="sm" className="mt-3" onClick={() => selectTab("after-match")}>
                  See status →
                </TouchlineButton>
              </TouchlineWidget>
            </div>

            <p className="text-[11px] text-[var(--text-muted)]">
              This widget is deliberately lighter than production&rsquo;s current AfterMatchOverview (see
              INFORMATION_OWNERSHIP_MATRIX.md §3) — full integrity detail lives only on the &ldquo;After match&rdquo; tab now.
            </p>
          </div>
        )}

        {activeTab === "events" && (
          <MatchEventsPanel timeline={data.timeline} ownTeamName={presentation.homeTeam} opponentName={B08_OPPONENT_NAME} />
        )}

        {activeTab === "stats" && <MatchStatsPanel data={data} />}

        {activeTab === "after-match" && (
          <MatchAfterMatchPanel
            matchId={B08_MATCH_ID}
            data={data}
            reportHrefOverride={
              isCompleted
                ? "/dev/ui-lab/gate-b/b08-information-ownership/report-completed"
                : "/dev/ui-lab/gate-b/b08-information-ownership/report-draft"
            }
          />
        )}

        {(activeTab === "tactics" || activeTab === "opponent-context" || activeTab === "history") && (
          <Surface padding="md">
            <SectionHeader title={tabs.find((t) => t.key === activeTab)?.label ?? activeTab} description="Not reproduced in this candidate — out of B08's scope (information ownership and lifecycle transitions)." />
          </Surface>
        )}

        <div>
          <TouchlineButton
            as={Link}
            href={
              isCompleted
                ? "/dev/ui-lab/gate-b/b08-information-ownership/report-completed"
                : "/dev/ui-lab/gate-b/b08-information-ownership/report-draft"
            }
            variant="primary"
            size="sm"
          >
            {isCompleted ? "View report" : "Continue report"}
          </TouchlineButton>
        </div>
      </div>
    </OrgSlugProvider>
  );
}
