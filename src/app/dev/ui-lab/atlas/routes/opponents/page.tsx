import Link from "next/link";
import { TouchlinePageHeader } from "@/components/touchline";
import { atlasNav, opponentsViewModel } from "../../fixtures";
import { UiLabShell } from "../../../ui-lab-shells";

const RESULT_LABEL: Record<string, string> = { won: "Won", lost: "Lost", drawn: "Drawn" };
const LEVEL_LABEL: Record<string, string> = { unknown: "Not assessed", low: "Low", medium: "Medium", high: "High" };

/**
 * Opponents list — `09_ROUTE_COMPOSITION_OPPONENTS_TEAMS_SEASON.md §A`.
 * No invented percentage strength score — `sportingLevel` is the real categorical
 * unknown/low/medium/high vocabulary, never a number (provenance §0.7).
 */
export default function AtlasOpponentsPage() {
  const vm = opponentsViewModel;

  return (
    <UiLabShell activeKey="more" contentWidthClass="max-w-[900px]" navBuilder={atlasNav}>
      <TouchlinePageHeader title="Opponents" context="Encounter history and match environment" />

      <div className="mt-5 grid grid-cols-2 gap-3 medium:max-w-[420px]">
        {[
          { label: "Recently faced", value: vm.recentlyFacedCount },
          { label: "Needs follow-up", value: vm.needsFollowUpCount },
        ].map((s) => (
          <div key={s.label} className="rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-3.5">
            <p className="tl-sport text-[22px] font-[650] text-[var(--foreground)]">{s.value}</p>
            <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{s.label}</p>
          </div>
        ))}
      </div>

      <ul className="mt-6 divide-y divide-[var(--border-soft)] border-t border-[var(--border-soft)]">
        {vm.opponents.map((o) => (
          <li key={o.opponentTeamId}>
            <Link href="#" className="flex items-center justify-between gap-3 py-3 no-underline">
              <span className="min-w-0">
                <span className="block text-[14px] font-[600] text-[var(--foreground)]">{o.displayName}</span>
                <span className="block text-[12px] text-[var(--text-muted)]">
                  {o.encounterCount} encounter{o.encounterCount === 1 ? "" : "s"} · Sporting level: {LEVEL_LABEL[o.sportingLevel]}
                </span>
              </span>
              <span className="shrink-0 text-[12px] text-[var(--text-muted)]">
                {o.lastEncounterResult ? RESULT_LABEL[o.lastEncounterResult] : "—"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </UiLabShell>
  );
}
