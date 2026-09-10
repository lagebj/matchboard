import {
  TouchlinePageHeader,
  TouchlineButton,
  ScorebookRoundSection,
  ScorebookMatchRow,
} from "@/components/touchline";
import { UiLabShell } from "../ui-lab-shells";
import { leagueRounds, UI_LAB_SEASON } from "../fixtures";

/**
 * Golden: league-desktop (1440×900) + league-mobile (390×844).
 * Sports scorebook grammar — dense divider rows, Barlow Condensed scores,
 * bounded content width, no round cards, no per-match cards, neutral results.
 */
export default function UiLabLeaguePage() {
  return (
    <UiLabShell activeKey="league" contentWidthClass="max-w-[1120px]">
      <TouchlinePageHeader
        title="League"
        context={UI_LAB_SEASON}
        actions={
          <>
            <span className="hidden text-[13px] font-medium text-[var(--text-soft)] medium:inline">
              League teams <span aria-hidden="true">›</span>
            </span>
            <TouchlineButton variant="primary">
              <span className="medium:hidden">+ Match</span>
              <span className="hidden medium:inline">Create match</span>
            </TouchlineButton>
          </>
        }
      />

      <div className="mt-5">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-[var(--tl-c-radius-control)] border border-[var(--border-soft)] bg-[var(--tl-c-surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--foreground)]"
        >
          Autumn 2026 <span aria-hidden="true" className="text-[var(--text-muted)]">▾</span>
        </button>
      </div>

      <div className="mt-2">
        {leagueRounds.map((round) => (
          <ScorebookRoundSection
            key={round.marker}
            marker={round.marker}
            dateLabel={round.dateLabel}
            summary={round.summary}
            boardHref={`/dev/ui-lab/round-board`}
          >
            {round.rows.map((row) => (
              <ScorebookMatchRow key={row.id} presentation={row} />
            ))}
          </ScorebookRoundSection>
        ))}
      </div>
    </UiLabShell>
  );
}
