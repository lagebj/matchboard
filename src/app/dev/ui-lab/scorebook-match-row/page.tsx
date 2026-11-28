import { AppearanceControl, ScorebookMatchRow } from "@/components/touchline";
import { buildMatchPresentation } from "@/lib/matches/match-presentation";

/**
 * Shared `ScorebookMatchRow` regression fixture — issues #852 (scheduled kickoff-time overflow /
 * mobile opponent truncation) and #853 (unqualified "FT" for an unconfirmed match). Not a UI Lab
 * design candidate (no `candidate_manifest.json`/`capture-attestation.json`, no Gate wave): a
 * small, static, deterministic set of rows so `e2e/scorebook-match-row-regression.spec.ts` can
 * assert real browser geometry and text truthfulness against the actual production component at
 * 1440/390/320px, in both themes. Fixed UTC clocks only — never `Date.now()`.
 */
const KICKOFF = new Date("2027-03-13T12:40:00.000Z");

const rows: { testId: string; presentation: ReturnType<typeof buildMatchPresentation> }[] = [
  {
    testId: "row-scheduled-long-opponent-home",
    presentation: buildMatchPresentation({
      id: "row-scheduled-long-opponent-home",
      teamName: "Rød",
      opponentName: "Nordbyen FK",
      isHome: true,
      kickoffAt: KICKOFF,
      lifecycleStatus: "planning_open",
    }),
  },
  {
    testId: "row-scheduled-away",
    presentation: buildMatchPresentation({
      id: "row-scheduled-away",
      teamName: "Rød",
      opponentName: "Slemmestad Hvit",
      isHome: false,
      kickoffAt: KICKOFF,
      lifecycleStatus: "planning_closed",
    }),
  },
  {
    testId: "row-live",
    presentation: buildMatchPresentation({
      id: "row-live",
      teamName: "Rød",
      opponentName: "Graabein United",
      isHome: true,
      kickoffAt: KICKOFF,
      lifecycleStatus: "live",
      ownGoals: 1,
      opponentGoals: 1,
      liveClockLabel: "37′",
    }),
  },
  {
    testId: "row-played-no-report",
    presentation: buildMatchPresentation({
      id: "row-played-no-report",
      teamName: "Rød",
      opponentName: "Graabein United",
      isHome: true,
      kickoffAt: KICKOFF,
      lifecycleStatus: "played",
    }),
  },
  {
    testId: "row-report-draft",
    presentation: buildMatchPresentation({
      id: "row-report-draft",
      teamName: "Rød",
      opponentName: "Graabein United",
      isHome: true,
      kickoffAt: KICKOFF,
      lifecycleStatus: "report_incomplete",
      // A coach has started typing a draft score in — must never render as a final result.
      ownGoals: 3,
      opponentGoals: 1,
      outcome: "WON",
    }),
  },
  {
    testId: "row-done-win",
    presentation: buildMatchPresentation({
      id: "row-done-win",
      teamName: "Rød",
      opponentName: "Graabein United",
      isHome: true,
      kickoffAt: KICKOFF,
      lifecycleStatus: "done",
      ownGoals: 2,
      opponentGoals: 1,
      outcome: "WON",
    }),
  },
  {
    testId: "row-done-loss",
    presentation: buildMatchPresentation({
      id: "row-done-loss",
      teamName: "Rød",
      opponentName: "Graabein United",
      isHome: false,
      kickoffAt: KICKOFF,
      lifecycleStatus: "done",
      ownGoals: 0,
      opponentGoals: 2,
      outcome: "LOST",
    }),
  },
  {
    testId: "row-cancelled",
    presentation: buildMatchPresentation({
      id: "row-cancelled",
      teamName: "Rød",
      opponentName: "Graabein United",
      isHome: true,
      kickoffAt: KICKOFF,
      lifecycleStatus: "cancelled",
      cancelledReason: "Opponent withdrew",
    }),
  },
];

export default function ScorebookMatchRowFixturePage() {
  return (
    <div className="touchline touchline-canvas mx-auto flex max-w-[480px] flex-col gap-4 px-4 py-8" data-ui-lab-ready="true">
      <div>
        <h1 className="text-[20px] font-[650] text-[var(--foreground)]">ScorebookMatchRow regression fixture</h1>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">Issues #852 / #853 — not a design candidate.</p>
      </div>
      <AppearanceControl />
      <div className="divide-y divide-[var(--border-soft)] border-y border-[var(--border-soft)]">
        {rows.map((row) => (
          <div key={row.testId} data-testid={row.testId}>
            <ScorebookMatchRow presentation={row.presentation} href={`/dev/ui-lab/scorebook-match-row#${row.testId}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
