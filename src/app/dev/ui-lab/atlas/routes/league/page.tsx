import { TouchlinePageHeader, TouchlineButton, ScorebookMatchRow, ScorebookRoundSection, WorkbenchToolbar } from "@/components/touchline";
import { UiLabShell } from "../../../ui-lab-shells";
import { atlasNav, leagueViewModel, leagueScorebookRounds } from "../../fixtures";

/**
 * League / Fixtures — `05_ROUTE_COMPOSITION_TODAY_LEAGUE_HISTORY.md §B`.
 * Golden: touchline-v1-league-desktop.png / touchline-v1-league-mobile.png (still authoritative —
 * `01_GOLDEN_REFERENCE_ATLAS.md §1`). No standings unless canonical (§0.5).
 */
export default function AtlasLeaguePage() {
  const vm = leagueViewModel;

  return (
    <UiLabShell activeKey="league" contentWidthClass="max-w-[900px]" navBuilder={atlasNav}>
      <TouchlinePageHeader title="League" context={vm.activePeriod?.title} />

      {vm.featureRound ? (
        <div className="mt-5">
          <WorkbenchToolbar
            context={
              <span>
                <span className="font-[650] text-[var(--foreground)]">{vm.featureRound.title}</span>
                <span className="ml-2 text-[var(--text-muted)]">Current round</span>
              </span>
            }
            actions={<TouchlineButton variant="primary">Open Round Board →</TouchlineButton>}
          />
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-6">
        {Object.entries(leagueScorebookRounds).map(([roundLabel, rows]) => (
          <ScorebookRoundSection key={roundLabel} marker={roundLabel} summary="Final">
            {rows.map((m) => (
              <ScorebookMatchRow key={m.id} presentation={m} />
            ))}
          </ScorebookRoundSection>
        ))}
      </div>
    </UiLabShell>
  );
}
