import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventDetail } from '../event-detail';
import { OrgSlugProvider } from '@/components/shell/org-slug-context';

// URL is the sole tab-selection authority (mirrors `fixtures-page.test.tsx`'s
// `next/navigation` mocking approach): `searchParamsState.value` drives what
// `useSearchParams()` returns, and `routerPush` records every navigation so tests can assert the
// query string a tab click produces without a real router.
const searchParamsState = vi.hoisted(() => ({ value: new URLSearchParams() }));
const routerPush = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/o/acme/events/event-1',
  useSearchParams: () => searchParamsState.value,
}));

vi.mock('../../actions', () => ({
  generateEventSquadsAction: vi.fn(),
  fillEventSquadRemainingPlacesAction: vi.fn(),
  clearEventSquadsAction: vi.fn(),
  deleteEventAction: vi.fn(),
  updateEventPlayerAvailability: vi.fn(),
  movePlayerBetweenSquadsAction: vi.fn(),
  addPlayersToEventPoolAction: vi.fn(),
  removePlayerFromEventPoolAction: vi.fn(),
  assignPlayerToEventSquadAction: vi.fn(),
  unassignPlayerFromEventSquadAction: vi.fn(),
  updateEventSquadNameAction: vi.fn(),
  updateEventSquadAction: vi.fn(),
  updateEventMatchDurationAction: vi.fn(),
  updateEventNumberOfHalvesAction: vi.fn(),
  updateEventBreakDurationAction: vi.fn(),
  getAvailablePlayersForEvent: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../event-football-observation-actions', () => ({
  getEventFootballObservationsAction: vi.fn().mockResolvedValue([]),
  saveEventFootballObservationsAction: vi.fn(),
}));

vi.mock('../event-lineup-actions', () => ({
  getEventMatchLineup: vi.fn(),
  createEventMatchLineup: vi.fn(),
  assignPlayerToLineupSlot: vi.fn(),
  removePlayerFromLineupSlot: vi.fn(),
  clearEventMatchLineup: vi.fn(),
  autoFillEventMatchLineup: vi.fn(),
  changeEventMatchLineupFormation: vi.fn(),
  getAvailableFormations: vi.fn(),
  getEligibleEventMatchPlayersAction: vi.fn(),
  getEventMatchLineupEditableAction: vi.fn(),
}));

vi.mock('../../event-finalization-actions', () => ({
  finalizeEventAction: vi.fn(),
  unfinalizeEventAction: vi.fn(),
}));

vi.mock('../../event-guest-player-actions', () => ({
  moveGuestPlayerBetweenSquadsAction: vi.fn(),
}));

vi.mock('../../event-match-actions', () => ({
  createEventMatchAction: vi.fn(),
  updateEventMatchAction: vi.fn(),
  cancelEventMatchAction: vi.fn(),
  reopenEventMatchAction: vi.fn(),
  deleteEventMatchAction: vi.fn(),
  listEventMatchesAction: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../event-post-match-actions', () => ({
  seedEventMatchReportAction: vi.fn(),
  completeEventMatchReportAction: vi.fn(),
  reopenEventMatchReportAction: vi.fn(),
  getEventMatchReport: vi.fn(),
}));

vi.mock('../../event-support-actions', () => ({
  addEventMatchSupportAssignmentAction: vi.fn(),
  removeEventMatchSupportAssignmentAction: vi.fn(),
  getSupportCandidatesForMatchAction: vi.fn(),
  getEventMatchSupportAssignmentsAction: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../event-match-availability-actions', () => ({
  setEventMatchUnavailableAction: vi.fn(),
  removeEventMatchAvailabilityExceptionAction: vi.fn(),
  getEventMatchAvailabilityBoardAction: vi.fn().mockResolvedValue({ matches: [], matrix: [] }),
}));

// `event-day-timeline.tsx`, `event-guest-player-pool-panel.tsx`, and
// `event-match-availability-panel.tsx` (all rendered inside the Overview tab) import these same
// action modules via the `@/...` absolute alias rather than a relative specifier -- both
// specifiers resolve to the identical file, but Vitest's mock registry is populated per
// call site, so each alias form needs its own `vi.mock` to intercept the real (next-auth/DB
// backed) implementation.
vi.mock('@/app/(app)/events/actions', () => ({
  unassignPlayerFromEventSquadAction: vi.fn(),
}));

vi.mock('@/app/(app)/events/event-match-actions', () => ({
  listEventMatchesAction: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/app/(app)/events/event-match-availability-actions', () => ({
  getEventMatchAvailabilityBoardAction: vi.fn().mockResolvedValue({ matches: [], matrix: [] }),
}));

const BASE_DATA = {
  id: 'event-1',
  name: 'Spring Cup',
  eventType: 'CUP',
  startsAt: '2025-05-10T09:00:00.000Z',
  endsAt: null,
  gameFormat: 'SEVEN_A_SIDE',
  matchDurationMinutes: 20,
  numberOfHalves: 2,
  breakDurationMinutes: 5,
  selectionPattern: null,
  notes: null,
  defaultFormationId: null,
  status: 'DRAFT',
  finalizedAt: null,
  finalizedBy: null,
  squads: [],
  players: [],
  availablePlayers: [],
  unassignedPlayers: [],
  addablePlayers: [],
  squadBalances: [],
  validation: {
    availablePlayerCount: 0,
    targetSquadCount: 0,
    targetSize: 7,
    missingRatingsCount: 0,
    partialRatingsCount: 0,
    ratedPlayerCount: 0,
    goalkeeperCoverage: { total: 0, perSquad: 0, sufficient: true },
    positionCoverage: {},
    warnings: [],
    notes: [],
  },
  compatibleFormations: [],
  formationMap: new Map(),
  opponentTeams: [],
  guestPlayerPool: [],
  availableGuestPlayers: [],
} as const;

function renderEventDetail() {
  return render(
    <OrgSlugProvider orgSlug="acme">
      <EventDetail data={BASE_DATA as never} />
    </OrgSlugProvider>,
  );
}

beforeEach(() => {
  searchParamsState.value = new URLSearchParams();
  routerPush.mockClear();
});

describe('EventDetail tab URL addressing', () => {
  it('opens the Squads tab when ?tab=squads is present', () => {
    searchParamsState.value = new URLSearchParams('tab=squads');
    renderEventDetail();
    expect(screen.getByRole('button', { name: 'Squads' })).toHaveAttribute('aria-current', 'page');
  });

  it('opens the Matches tab when ?tab=matches is present', () => {
    searchParamsState.value = new URLSearchParams('tab=matches');
    renderEventDetail();
    expect(screen.getByRole('button', { name: 'Matches' })).toHaveAttribute('aria-current', 'page');
  });

  it('falls back to Overview for an unknown tab value', () => {
    searchParamsState.value = new URLSearchParams('tab=bogus');
    renderEventDetail();
    expect(screen.getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
  });

  it('updates the URL query state when a tab is clicked', async () => {
    const user = userEvent.setup();
    renderEventDetail();

    await user.click(screen.getByRole('button', { name: 'Matches' }));

    expect(routerPush).toHaveBeenCalledWith('/o/acme/events/event-1?tab=matches', { scroll: false });
  });

  it('drops the tab query param entirely when navigating back to Overview', async () => {
    const user = userEvent.setup();
    searchParamsState.value = new URLSearchParams('tab=squads');
    renderEventDetail();

    await user.click(screen.getByRole('button', { name: 'Overview' }));

    expect(routerPush).toHaveBeenCalledWith('/o/acme/events/event-1', { scroll: false });
  });
});
