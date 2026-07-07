import Link from 'next/link';
import { getPlanningPeriods, getFormations } from '../actions';

export const metadata = { title: 'Create Event' };

export default async function CreateEventPage() {
  const [planningPeriods, formations] = await Promise.all([
    getPlanningPeriods(),
    getFormations(),
  ]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create Event</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Set up a cup, tournament, or friendly day for squad planning
        </p>
      </div>

      <form action="/events/new" method="POST" className="space-y-6">
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              Event name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Spring Cup 2026"
            />
          </div>

          <div>
            <label htmlFor="eventType" className="block text-sm font-medium mb-1">
              Event type
            </label>
            <select
              id="eventType"
              name="eventType"
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="CUP">Cup</option>
              <option value="TOURNAMENT">Tournament</option>
              <option value="FRIENDLY_DAY">Friendly day</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="startsAt" className="block text-sm font-medium mb-1">
                Start date *
              </label>
              <input
                type="date"
                id="startsAt"
                name="startsAt"
                required
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="endsAt" className="block text-sm font-medium mb-1">
                End date
              </label>
              <input
                type="date"
                id="endsAt"
                name="endsAt"
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="gameFormat" className="block text-sm font-medium mb-1">
              Game format
            </label>
            <select
              id="gameFormat"
              name="gameFormat"
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="THREE_A_SIDE">3-a-side</option>
              <option value="FIVE_A_SIDE">5-a-side</option>
              <option value="SEVEN_A_SIDE">7-a-side</option>
              <option value="NINE_A_SIDE">9-a-side</option>
              <option value="ELEVEN_A_SIDE">11-a-side</option>
            </select>
          </div>

          <div>
            <label htmlFor="sourcePlanningPeriodId" className="block text-sm font-medium mb-1">
              Source phase
            </label>
            <select
              id="sourcePlanningPeriodId"
              name="sourcePlanningPeriodId"
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">None</option>
              {planningPeriods.map((pp) => (
                <option key={pp.id} value={pp.id}>
                  {pp.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="defaultFormationId" className="block text-sm font-medium mb-1">
              Default formation
            </label>
            <select
              id="defaultFormationId"
              name="defaultFormationId"
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">No formation (role template)</option>
              {formations.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.gameFormat.replace('_', '-')})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="selectionPattern" className="block text-sm font-medium mb-1">
              Selection pattern
            </label>
            <select
              id="selectionPattern"
              name="selectionPattern"
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="ALL_BALANCED">All squads balanced</option>
              <option value="ONE_COMPETITIVE_BALANCED_REMAINDER">
                One competitive squad + balanced remainder
              </option>
              <option value="MANUAL_SEED_AUTO_BALANCE">
                Manual seed + auto balance
              </option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="squadCount" className="block text-sm font-medium mb-1">
                Number of squads
              </label>
              <input
                type="number"
                id="squadCount"
                name="squadCount"
                min={2}
                max={10}
                defaultValue={2}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="targetSize" className="block text-sm font-medium mb-1">
                Target squad size
              </label>
              <input
                type="number"
                id="targetSize"
                name="targetSize"
                min={3}
                max={18}
                defaultValue={7}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium mb-1">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Optional notes about the event..."
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Create event
          </button>
            <Link
              href="/events"
              className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Cancel
            </Link>
        </div>
      </form>
    </div>
  );
}