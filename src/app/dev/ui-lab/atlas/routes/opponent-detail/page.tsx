import { TouchlinePageHeader, TouchlineButton } from "@/components/touchline";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { atlasNav, opponentDetailViewModel } from "../../fixtures";
import { UiLabShell } from "../../../ui-lab-shells";

const LEVEL_LABEL: Record<string, string> = { unknown: "Not assessed", low: "Low", medium: "Medium", high: "High" };
const OUTCOME_LABEL: Record<string, string> = { won: "Won", lost: "Lost", drawn: "Drawn" };

/**
 * Opponent detail — `09_ROUTE_COMPOSITION_OPPONENTS_TEAMS_SEASON.md §B`.
 * No inferred win probability — tendency outcomes stay factual goalsFor/goalsAgainst counts only.
 */
export default function AtlasOpponentDetailPage() {
  const vm = opponentDetailViewModel;

  return (
    <UiLabShell activeKey="more" contentWidthClass="max-w-[720px]" navBuilder={atlasNav}>
      <TouchlinePageHeader
        title={vm.displayName}
        context={`Sporting level: ${LEVEL_LABEL[vm.sportingLevel]} (${vm.sportingLevelSampleCount} sample${vm.sportingLevelSampleCount === 1 ? "" : "s"})`}
        actions={<TouchlineButton variant="secondary">Add observation</TouchlineButton>}
      />

      <div className="mt-5 grid grid-cols-3 gap-3 max-w-[420px]">
        {[
          { label: "Won", value: vm.record.wins },
          { label: "Drawn", value: vm.record.draws },
          { label: "Lost", value: vm.record.losses },
        ].map((r) => (
          <div key={r.label} className="rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-3 text-center">
            <p className="tl-sport text-[20px] font-[650] text-[var(--foreground)]">{r.value}</p>
            <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{r.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <TouchlineWidget>
          <WidgetHeader eyebrow="Encounter history" title="Recent encounters" />
          <ul className="mt-2 divide-y divide-[var(--border-soft)] border-t border-[var(--border-soft)]">
            {vm.recentEncounters.map((e) => (
              <li key={e.matchId} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                <span className="text-[var(--text-muted)]">{e.matchDate}</span>
                <span className="text-[var(--foreground)]">{e.ownGoals ?? "—"} – {e.opponentGoals ?? "—"}</span>
                <span className="text-[var(--text-muted)]">{e.outcome ? OUTCOME_LABEL[e.outcome] : "—"}</span>
              </li>
            ))}
          </ul>
        </TouchlineWidget>

        {vm.tendencies.length > 0 ? (
          <TouchlineWidget>
            <WidgetHeader eyebrow="Tactical tendency" title="Observed patterns" />
            <ul className="mt-2 flex flex-col gap-2 text-[13px]">
              {vm.tendencies.map((t) => (
                <li key={t.tag} className="flex items-center justify-between gap-3">
                  <span className="text-[var(--foreground)]">{t.tag.replace(/_/g, " ").toLowerCase()}</span>
                  <span className="text-[var(--text-muted)]">
                    {t.occurrences} occurrence{t.occurrences === 1 ? "" : "s"} · {t.confidence}
                    {t.outcome ? ` · ${t.outcome.goalsFor}–${t.outcome.goalsAgainst} across ${t.outcome.matchCount}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </TouchlineWidget>
        ) : null}

        {vm.latestFactualSummary ? (
          <TouchlineWidget>
            <WidgetHeader eyebrow="Match environment" title="Brief factual summary" />
            <p className="mt-2 text-[13px] leading-snug text-[var(--text-soft)]">{vm.latestFactualSummary}</p>
          </TouchlineWidget>
        ) : null}
      </div>
    </UiLabShell>
  );
}
