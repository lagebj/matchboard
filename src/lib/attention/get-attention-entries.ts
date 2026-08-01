import { db } from '@/lib/db';
import { requireCoachAccess } from '@/lib/auth';
import { resolveOrgFilterForUser } from '@/lib/tenancy/resolve-org-filter';

export type AttentionCategory =
  | 'review_assigned'
  | 'review_changes_requested'
  | 'invitation_pending'
  | 'missing_post_match_report'
  | 'event_review_needed';

export type AttentionUrgency = 'LOW' | 'NORMAL' | 'HIGH';

export type AttentionEntry = {
  id: string;
  category: AttentionCategory;
  title: string;
  summary: string;
  href: string;
  urgency: AttentionUrgency;
  dueAt: Date | null;
  sourceType: string;
  sourceId: string;
};

export async function getAttentionEntries(): Promise<AttentionEntry[]> {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? '');

  if (orgFilter.type !== 'org') return [];

  const organisationId = orgFilter.organisationId;
  const entries: AttentionEntry[] = [];

  const membership = await db.organisationMembership.findFirst({
    where: { userId: coach.id, organisationId },
  });

  if (!membership) return [];

  const pendingReviews = await db.reviewRequest.findMany({
    where: {
      reviewerMembershipId: membership.id,
      status: 'PENDING',
      organisationId,
    },
    orderBy: { createdAt: 'asc' },
  });

  for (const review of pendingReviews) {
    entries.push({
      id: `review-assigned-${review.id}`,
      category: 'review_assigned',
      title: `Review requested: ${review.targetType === 'EVENT_SQUAD' ? 'Event squad' : 'Match lineup'}`,
      summary: review.requestMessage ?? 'A review has been requested.',
      href: review.targetType === 'EVENT_SQUAD' ? `/events/${review.targetId}` : `/matches/${review.targetId}`,
      urgency: 'NORMAL',
      dueAt: null,
      sourceType: 'review_request',
      sourceId: review.id,
    });
  }

  const changesRequested = await db.reviewRequest.findMany({
    where: {
      requestedByMembershipId: membership.id,
      status: 'CHANGES_REQUESTED',
      organisationId,
    },
    orderBy: { createdAt: 'desc' },
  });

  for (const review of changesRequested) {
    entries.push({
      id: `review-changes-${review.id}`,
      category: 'review_changes_requested',
      title: `Changes requested on your ${review.targetType === 'EVENT_SQUAD' ? 'event squad' : 'lineup'}`,
      summary: review.reviewerComment ?? 'Changes have been requested.',
      href: review.targetType === 'EVENT_SQUAD' ? `/events/${review.targetId}` : `/matches/${review.targetId}`,
      urgency: 'HIGH',
      dueAt: null,
      sourceType: 'review_request',
      sourceId: review.id,
    });
  }

  const pendingInvitations = await db.organisationInvitation.findMany({
    where: {
      organisationId,
      status: 'PENDING',
    },
    orderBy: { createdAt: 'asc' },
  });

  const now = new Date();
  for (const inv of pendingInvitations) {
    if (inv.expiresAt && inv.expiresAt < now) continue;

    entries.push({
      id: `invitation-${inv.id}`,
      category: 'invitation_pending',
      title: `Pending invitation for ${inv.invitedEmail}`,
      summary: `Invitation as ${inv.intendedRole} is awaiting acceptance.`,
      href: '/organisations',
      urgency: 'LOW',
      dueAt: inv.expiresAt,
      sourceType: 'organisation_invitation',
      sourceId: inv.id,
    });
  }

  const orgWhere = orgFilter.type === 'org' ? orgFilter.filter : {};

  const recentLeagueSeason = await db.leagueSeason.findFirst({
    where: { ...orgWhere },
    orderBy: { startDate: 'desc' },
    select: { id: true },
  });

  if (recentLeagueSeason) {
    const matchesWithReports = await db.postMatchReport.findMany({
      where: { status: { in: ['DRAFT', 'REPORTED', 'LOCKED'] } },
      select: { matchId: true },
    });
    const matchIdsWithReports = new Set(matchesWithReports.map((r) => r.matchId));

    const recentMatches = await db.match.findMany({
      where: {
        ...orgWhere,
        matchRound: { leagueSeasonId: recentLeagueSeason.id },
        status: 'SCHEDULED',
      },
      select: {
        id: true,
        opponent: true,
        homeAway: true,
        startsAt: true,
      },
      orderBy: { startsAt: 'desc' },
      take: 20,
    });

    for (const match of recentMatches) {
      if (matchIdsWithReports.has(match.id)) continue;
      if (match.startsAt > now) continue;

      entries.push({
        id: `missing-report-${match.id}`,
        category: 'missing_post_match_report',
        title: `Missing report: vs ${match.opponent}`,
        summary: `The ${match.homeAway.toLowerCase()} match has been played but has no post-match report.`,
        href: `/matches/${match.id}`,
        urgency: 'NORMAL',
        dueAt: null,
        sourceType: 'match',
        sourceId: match.id,
      });
    }
  }

  entries.sort((a, b) => {
    const urgencyOrder: Record<AttentionUrgency, number> = { HIGH: 0, NORMAL: 1, LOW: 2 };
    return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
  });

  return entries;
}