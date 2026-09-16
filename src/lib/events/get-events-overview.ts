/**
 * Dedicated, bounded Events overview loader (Matchboard Events Operating Surface bundle,
 * `04_DATA_AND_VIEW_MODEL_CONTRACT.md`).
 *
 * `getEvents()` (`src/app/(app)/events/actions.ts`) stays a generic Event list source for its
 * existing consumers. This loader is a separate, route-specific query so the first-class Events
 * route can load the richer readiness/attention/facts shape it needs (squad target/minSize,
 * EventMatch + support-assignment aggregates) without turning `getEvents()` into an oversized,
 * ever-growing source for every consumer (bundle §00 "Reason for new dedicated overview loader").
 *
 * One tenant-scoped query. Prisma resolves the nested `select` in a bounded query plan — this is
 * not a per-Event/per-squad/per-match application-level loop (09 "Performance/security").
 */

import { db } from '@/lib/db';
import { requirePageActorContext } from '@/lib/auth/actor-context';
import { setTenantOrganisationId } from '@/lib/tenancy/tenant-async-storage';

export type EventsOverviewSquadRow = {
  id: string;
  name: string;
  status: string;
  targetSize: number;
  minSize: number | null;
  players: Array<{ id: string; playerId: string | null; guestPlayerId: string | null }>;
};

export type EventsOverviewPlayerRow = {
  id: string;
  playerId: string | null;
  guestPlayerId: string | null;
  status: string;
};

export type EventsOverviewMatchRow = {
  id: string;
  status: string;
  supportAssignments: Array<{ id: string }>;
};

export type EventsOverviewEventRow = {
  id: string;
  name: string;
  eventType: string;
  startsAt: Date;
  endsAt: Date | null;
  status: string;
  squads: EventsOverviewSquadRow[];
  players: EventsOverviewPlayerRow[];
  eventMatches: EventsOverviewMatchRow[];
};

/** Tenant-scoped Events overview query. Fields only — no presentation copy, no React. */
export async function getEventsOverview(): Promise<EventsOverviewEventRow[]> {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);

  return db.event.findMany({
    where: {
      ...ctx.orgFilter.filter,
    },
    orderBy: { startsAt: 'desc' },
    select: {
      id: true,
      name: true,
      eventType: true,
      startsAt: true,
      endsAt: true,
      status: true,
      squads: {
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          status: true,
          targetSize: true,
          minSize: true,
          players: {
            select: { id: true, playerId: true, guestPlayerId: true },
          },
        },
      },
      players: {
        select: { id: true, playerId: true, guestPlayerId: true, status: true },
      },
      eventMatches: {
        select: {
          id: true,
          status: true,
          supportAssignments: { select: { id: true } },
        },
      },
    },
  });
}
