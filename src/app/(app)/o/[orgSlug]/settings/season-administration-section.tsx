import Link from "next/link";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { TouchlineButton } from "@/components/touchline";
import { SeasonFinalizeControls } from "@/app/(app)/season/season-finalize-controls";
import { SeasonMatchFormatControls } from "@/app/(app)/season/season-match-format-controls";

/**
 * League season create/finalize/default-format administration (ADR-0157 slice C7,
 * `09_SEASON_REVIEW.md` "Administration removal": "Current `/season` also contains create/
 * finalize/default-format controls. Move these to League season administration/settings, not
 * into the story-first Review hero."). Settings is already the org's administration entry point
 * (role-gated to OWNER/ADMIN on its page) and already hosts other org-level configuration, so it
 * is the natural "League season administration/settings" destination the spec names -- these
 * controls are relocated here verbatim (`SeasonFinalizeControls`/`SeasonMatchFormatControls`
 * themselves are unchanged), not rebuilt.
 */

export type SeasonAdministrationLeagueSeasonOption = {
  id: string;
  name: string;
  startDate: Date;
  status: string;
};

export type SeasonAdministrationActiveLeagueSeason = {
  id: string;
  name: string;
  status: string;
  finalizedAt: Date | null;
  finalizedBy: string | null;
  defaultNumberOfPeriods: number | null;
  defaultPeriodDurationMinutes: number | null;
  defaultBreakDurationMinutes: number | null;
};

export function SeasonAdministrationSection({
  orgSlug,
  leagueSeasons,
  selected,
}: {
  orgSlug: string;
  leagueSeasons: SeasonAdministrationLeagueSeasonOption[];
  selected: SeasonAdministrationActiveLeagueSeason | null;
}) {
  return (
    <Surface variant="default" padding="lg">
      <SectionHeader title="Season administration" description="Create, finalise, and set default match format for a league season." />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <TouchlineButton as="a" href={`/o/${orgSlug}/season/new`} variant="primary" size="sm">
          Create league season
        </TouchlineButton>

        {leagueSeasons.length > 1 && (
          <form method="get" className="flex items-center gap-2">
            <label htmlFor="season-admin-select" className="text-xs font-medium text-[var(--text-soft)]">
              Administer season
            </label>
            <select
              id="season-admin-select"
              name="seasonAdminId"
              defaultValue={selected?.id ?? ""}
              className="h-8 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2 text-xs text-[var(--foreground)]"
            >
              {leagueSeasons.map((ls) => (
                <option key={ls.id} value={ls.id}>
                  {ls.name}
                  {ls.status === "FINALIZED" ? " · Finalised" : ""}
                </option>
              ))}
            </select>
            <button type="submit" className="h-8 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]">
              Switch
            </button>
          </form>
        )}

        {selected && (
          <Link
            href={`/o/${orgSlug}/season?leagueSeasonId=${encodeURIComponent(selected.id)}`}
            className="text-[13px] font-medium text-[var(--text-soft)] no-underline hover:text-[var(--foreground)]"
          >
            Open Season Review for {selected.name} <span aria-hidden="true">›</span>
          </Link>
        )}
      </div>

      {selected && (
        <div className="mt-4 flex flex-col gap-4">
          <SeasonFinalizeControls
            leagueSeasonId={selected.id}
            leagueSeasonName={selected.name}
            status={selected.status}
            finalizedAt={selected.finalizedAt}
            finalizedBy={selected.finalizedBy}
          />
          <SeasonMatchFormatControls
            leagueSeasonId={selected.id}
            numberOfPeriods={selected.defaultNumberOfPeriods}
            periodDurationMinutes={selected.defaultPeriodDurationMinutes}
            breakDurationMinutes={selected.defaultBreakDurationMinutes}
          />
        </div>
      )}

      {!selected && leagueSeasons.length === 0 && (
        <p className="mt-4 text-sm text-[var(--text-muted)]">No league seasons yet. Create one to configure finalisation and match format.</p>
      )}
    </Surface>
  );
}
