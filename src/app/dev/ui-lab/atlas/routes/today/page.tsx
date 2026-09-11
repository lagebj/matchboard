import {
  TouchlinePageHeader,
  TouchlineButton,
} from "@/components/touchline";
import {
  NextMatchHero,
  AttentionWidget,
  SquadReadinessWidget,
  RecentFootballWidget,
  ScheduleWidget,
  EvidenceSpotlightWidget,
} from "@/components/touchline/widgets";
import { PhaseBars } from "@/components/touchline/viz";
import { UiLabShell } from "../../../ui-lab-shells";
import { atlasNav, todayViewModel } from "../../fixtures";

/**
 * Today — `05_ROUTE_COMPOSITION_TODAY_LEAGUE_HISTORY.md §A`.
 * Golden: today-desktop-light.png / today-mobile-dark.png.
 *
 * Desktop 12-col: [8 hero | 4 squad status] / [8 recent football | 4 attention] / [7 schedule | 5 evidence].
 * Mobile: greeting/date → hero → attention (if items exist) → recent football → schedule → evidence.
 * No external league table (see docs/domain/touchline-atlas-provenance.md §0.5).
 */
export default function AtlasTodayPage() {
  const vm = todayViewModel;

  return (
    <UiLabShell activeKey="today" contentWidthClass="max-w-[1180px]" navBuilder={atlasNav}>
      <TouchlinePageHeader title="Today" context={vm.dateLabel} />

      <div className="mt-5 grid grid-cols-1 gap-5 expanded:grid-cols-12">
        <div className="expanded:col-span-8">
          {vm.heroKind === "match" && vm.heroMatch ? (
            <NextMatchHero
              presentation={vm.heroMatch}
              contextLabel="G2015 · League"
              contextLine="Slemmestad · Pitch 1"
              primaryAction={<TouchlineButton variant="primary">Match details →</TouchlineButton>}
            />
          ) : vm.heroKind === "attention" && vm.heroDecision ? (
            <AttentionWidget items={[{ id: vm.heroDecision.id, title: vm.heroDecision.title, summary: vm.heroDecision.summary, urgency: vm.heroDecision.urgency }]} />
          ) : null}
        </div>
        <div className="expanded:col-span-4">
          {vm.squadStatus ? (
            <SquadReadinessWidget
              available={vm.squadStatus.available}
              doubtful={vm.squadStatus.doubtful}
              unavailable={vm.squadStatus.unavailable}
              exceptions={vm.squadStatus.notAvailable}
            />
          ) : null}
        </div>

        {vm.attentionItems.length > 0 ? (
          <div className="order-first expanded:order-none expanded:col-span-4 expanded:col-start-9">
            <AttentionWidget
              items={vm.attentionItems.map((d) => ({ id: d.id, title: d.title, summary: d.summary, urgency: d.urgency, href: d.deepLink }))}
              overflowCount={vm.attentionOverflowCount}
            />
          </div>
        ) : null}
        <div className="expanded:col-span-8">
          <RecentFootballWidget matches={vm.recentMatches} viewAllHref="/dev/ui-lab/atlas/routes/league" />
        </div>

        <div className="expanded:col-span-7">
          <ScheduleWidget items={vm.scheduleItems.map((s) => ({ id: s.id, timeLabel: s.timeLabel, title: s.title, sublabel: s.sublabel, state: s.isNow ? "current" : "later" }))} />
        </div>
        <div className="expanded:col-span-5">
          {vm.evidenceSpotlight ? (
            <EvidenceSpotlightWidget
              question={vm.evidenceSpotlight.question}
              label={vm.evidenceSpotlight.label}
              title={vm.evidenceSpotlight.title}
              value={vm.evidenceSpotlight.value}
              valueCaption={vm.evidenceSpotlight.valueCaption}
              visual={
                vm.evidenceSpotlight.phaseSegments ? (
                  <PhaseBars question={vm.evidenceSpotlight.question} segments={vm.evidenceSpotlight.phaseSegments} />
                ) : undefined
              }
              sample={vm.evidenceSpotlight.sample}
              confidence={vm.evidenceSpotlight.confidence}
              detailHref={vm.evidenceSpotlight.detailHref}
            />
          ) : null}
        </div>
      </div>
    </UiLabShell>
  );
}
