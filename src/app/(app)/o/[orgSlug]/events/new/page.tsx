import { requirePageActorContext } from "@/lib/auth/actor-context";
import { getLeagueSeasons, getFormations } from '@/app/(app)/events/actions';
import { CreateEventForm } from '@/components/events/create-event-form';

export const metadata = { title: 'Create Event' };

export default async function CreateEventPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  await requirePageActorContext(orgSlug);
  const [_leagueSeasons, formations] = await Promise.all([
    getLeagueSeasons(),
    getFormations(),
  ]);

  const formationOptions = formations.map((f) => ({
    id: f.id,
    name: f.name,
    gameFormat: f.gameFormat,
  }));

  return <CreateEventForm formations={formationOptions} />;
}