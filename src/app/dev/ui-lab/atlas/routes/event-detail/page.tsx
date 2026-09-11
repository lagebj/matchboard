import { TouchlinePageHeader, TouchlineButton } from "@/components/touchline";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { SquadReadinessWidget, EventDayWidget } from "@/components/touchline/widgets";
import { atlasNav, eventDetailViewModel } from "../../fixtures";
import { UiLabShell } from "../../../ui-lab-shells";

/**
 * Event detail — `06_ROUTE_COMPOSITION_EVENTS_MATCHDAY.md §B`.
 * Golden: atlas-planning-and-matchday.png panel 5 (adapted for events).
 *
 * `NextMatchHero` is a League `MatchPresentation` wrapper (see next-match-hero.tsx) — Event
 * matches have no `MatchPresentation` equivalent in this codebase (a separate `EventMatch`
 * model), so the next-match feature here is a plain feature-tone widget instead of forcing an
 * incompatible type onto `NextMatchHero`. No map — venue is text only (provenance §0.4).
 */
export default function AtlasEventDetailPage() {
  const vm = eventDetailViewModel;

  return (
    <UiLabShell activeKey="events" contentWidthClass="max-w-[1180px]" navBuilder={atlasNav}>
      <TouchlinePageHeader
        title={vm.name}
        context={`${vm.venue ?? "Venue not set"} · ${vm.gameFormat}`}
        actions={<TouchlineButton variant="secondary">Export</TouchlineButton>}
      />

      <div className="mt-5 grid grid-cols-1 gap-5 expanded:grid-cols-12">
        <div className="expanded:col-span-5">
          <TouchlineWidget tone="feature">
            <WidgetHeader eyebrow="Next match" title={vm.nextMatch ? vm.nextMatch.opponentName : "No match scheduled"} />
            {vm.nextMatch ? (
              <>
                <p className="mt-2 tl-sport text-[28px] font-[650] text-[var(--foreground)]">
                  {new Date(vm.nextMatch.startsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </p>
                <p className="mt-1 text-[13px] text-[var(--text-muted)]">{vm.nextMatch.status}</p>
              </>
            ) : null}
          </TouchlineWidget>
        </div>
        <div className="expanded:col-span-3">
          <TouchlineWidget>
            <WidgetHeader eyebrow="Event facts" title="Details" />
            <dl className="mt-3 flex flex-col gap-2 text-[13px]">
              <div className="flex justify-between gap-2"><dt className="text-[var(--text-muted)]">Venue</dt><dd className="text-[var(--foreground)]">{vm.venue ?? "—"}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-[var(--text-muted)]">Format</dt><dd className="text-[var(--foreground)]">{vm.gameFormat}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-[var(--text-muted)]">Matches</dt><dd className="text-[var(--foreground)]">{vm.timeline.length}</dd></div>
            </dl>
          </TouchlineWidget>
        </div>
        <div className="expanded:col-span-4">
          <SquadReadinessWidget
            title="Squad readiness"
            available={vm.squadReadiness.reduce((s, r) => s + r.currentCount, 0)}
            doubtful={0}
            unavailable={vm.squadReadiness.reduce((s, r) => s + r.missingCount, 0)}
            exceptions={vm.squadReadiness
              .filter((r) => r.missingCount > 0)
              .map((r) => ({ playerId: r.squadId, displayName: r.squadName, reason: `${r.missingCount} short of target` }))}
          />
        </div>

        <div className="expanded:col-span-7">
          <EventDayWidget
            items={vm.timeline.map((m) => ({
              id: m.eventMatchId,
              timeLabel: new Date(m.startsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
              title: `vs ${m.opponentName}`,
              sublabel: m.status,
              state: m.isLive ? "live" : "next",
            }))}
          />
        </div>
        <div className="expanded:col-span-5">
          <TouchlineWidget>
            <WidgetHeader eyebrow="Helpers" title={`${vm.helpersConfirmedCount}/${vm.helpersTotalCount} confirmed`} />
            <ul className="mt-3 flex flex-col gap-2 text-[13px]">
              {vm.helpers.map((h, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <span className="text-[var(--foreground)]">{h.playerName}</span>
                  <span className="text-[var(--text-muted)]">{h.targetMatchLabel} · {h.confirmed ? "Confirmed" : "Pending"}</span>
                </li>
              ))}
            </ul>
          </TouchlineWidget>
        </div>
      </div>
    </UiLabShell>
  );
}
