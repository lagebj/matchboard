import { TouchlinePageHeader, TouchlineButton } from "@/components/touchline";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { atlasNav, postMatchReportFixture } from "../../fixtures";
import { UiLabShell } from "../../../ui-lab-shells";

/**
 * Post-match — `06_ROUTE_COMPOSITION_EVENTS_MATCHDAY.md §H`. Golden: atlas-planning-and-matchday.png
 * panel 4. Order: final score → report status → participation corrections → goals/assists →
 * team reflection → player observations → submit. Actual report fields stay primary; widgets are
 * compact factual summaries only.
 */
export default function AtlasPostMatchPage() {
  const vm = postMatchReportFixture;

  return (
    <UiLabShell activeKey="league" contentWidthClass="max-w-[720px]" navBuilder={atlasNav}>
      <TouchlinePageHeader title="Post-match report" context={`${vm.teamName} vs ${vm.opponent}`} />

      <div className="mt-5 rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget-strong)] p-4 text-center">
        <p className="tl-sport text-[36px] font-[650] text-[var(--foreground)]">{vm.finalScore}</p>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">Report status: {vm.status}</p>
        {vm.attendanceUnknownCount > 0 ? (
          <p className="mt-1 text-[12px] text-[var(--warning)]">{vm.attendanceUnknownCount} player(s) with unknown attendance — completion blocked</p>
        ) : null}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 medium:grid-cols-2">
        <TouchlineWidget>
          <WidgetHeader eyebrow="Goals" title={`${vm.goals.length}`} />
          <ul className="mt-2 flex flex-col gap-1.5 text-[13px]">
            {vm.goals.map((g) => (
              <li key={g.id} className="flex justify-between text-[var(--foreground)]"><span>{g.playerName}</span><span className="tabular-nums text-[var(--text-muted)]">{g.minuteLabel}</span></li>
            ))}
          </ul>
        </TouchlineWidget>
        <TouchlineWidget>
          <WidgetHeader eyebrow="Assists" title={`${vm.assists.length}`} />
          <ul className="mt-2 flex flex-col gap-1.5 text-[13px]">
            {vm.assists.map((a) => (
              <li key={a.id} className="flex justify-between text-[var(--foreground)]"><span>{a.playerName}</span><span className="tabular-nums text-[var(--text-muted)]">{a.minuteLabel}</span></li>
            ))}
          </ul>
        </TouchlineWidget>
      </div>

      <div className="mt-5 flex flex-col gap-4">
        <TouchlineWidget>
          <WidgetHeader eyebrow="Team reflection" title="How did the team perform?" />
          <p className="mt-2 text-[13px] text-[var(--text-muted)]">Not recorded yet.</p>
        </TouchlineWidget>
        <TouchlineWidget>
          <WidgetHeader eyebrow="Football observations" title="Player observations" />
          <p className="mt-2 text-[13px] text-[var(--text-muted)]">No observations recorded yet.</p>
        </TouchlineWidget>
      </div>

      <div className="mt-6">
        <TouchlineButton variant="primary">Complete report</TouchlineButton>
      </div>
    </UiLabShell>
  );
}
