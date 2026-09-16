import { requirePageActorContext } from '@/lib/auth/actor-context';
import { getEventsOverview } from '@/lib/events/get-events-overview';
import { buildEventsOperatingViewModel } from '@/lib/touchline/presentation/events-overview-view-model';
import { EventsOperatingSurface } from '@/components/events/events-operating-surface';

export const metadata = { title: 'Events' };

/**
 * Events — Event-level operating surface (Matchboard Events Operating Surface bundle). Replaces
 * the previous sparse grouped-month list + small "Next event" widget (Touchline Design Atlas,
 * ADR-0136) with a route composition that leads with the next Event's factual readiness/
 * attention/participating squads/facts, and a single-rail Event Season list below.
 *
 * This page owns data fetching + view-model construction only; all layout/composition lives in
 * `EventsOperatingSurface` and all readiness/attention/ordering computation lives in
 * `buildEventsOperatingViewModel()` (no domain computation here, matching League's
 * `FixturesPage` -> `LeagueSurface` -> `buildLeagueOperatingViewModel()` split).
 */
export default async function EventsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  await requirePageActorContext(orgSlug);

  const events = await getEventsOverview();
  const viewModel = buildEventsOperatingViewModel(events, new Date().toISOString());

  return <EventsOperatingSurface orgSlug={orgSlug} viewModel={viewModel} />;
}
