import { getLeagueSeasons, getFormations } from '../actions';
import { CreateEventForm } from '@/components/events/create-event-form';

export const metadata = { title: 'Create Event' };

export default async function CreateEventPage() {
  const [leagueSeasons, formations] = await Promise.all([
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