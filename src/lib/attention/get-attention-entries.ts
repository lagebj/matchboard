import { db } from '@/lib/db';
import { requireActorContext, canAdmin, hasTeamAccess } from '@/lib/auth/actor-context';

export type AttentionCategory =
  | 'review_assigned'
  | 'review_changes_requested'
  | 'invitation_pending'
  | 'missing_post_match_report'
  | 'event_review_needed'
  | 'expiring_support_access'
  | 'unacknowledged_handover'
  | 'unowned_fixture';

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

export async function getAttentionEntries(orgSlug?: string): Promise<AttentionEntry[]> {
  const ctx = await requireActorContext(orgSlug);

  if (ctx.orgFilter.type !== 'org') return [];

  const organisationId = ctx.organisationId;
  const isAdmin = canAdmin(ctx);
  const entries: AttentionEntry[] = [];

  const membership = await db.organisationMembership.findFirst({
    where: { userId: ctx.userId, organisationId },
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

  const pendingInvitations = isAdmin
    ? await db.organisationInvitation.findMany({
        where: {
          organisationId,
          status: 'PENDING',
        },
        orderBy: { createdAt: 'asc' },
      })
    : [];

  const now = new Date();
  for (const inv of pendingInvitations) {
    if (inv.expiresAt && inv.expiresAt < now) continue;

    entries.push({
      id: `invitation-${inv.id}`,
      category: 'invitation_pending',
      title: `Pending invitation for ${inv.invitedEmail}`,
      summary: `Invitation as ${inv.intendedRole} is awaiting acceptance.`,
      href: `/organisations`,
      urgency: 'LOW',
      dueAt: inv.expiresAt,
      sourceType: 'organisation_invitation',
      sourceId: inv.id,
    });
  }

  const expiringSupportMemberships = isAdmin
    ? await db.organisationMembership.findMany({
        where: {
          organisationId,
          role: 'SUPPORT',
          expiresAt: { not: null, lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
        },
        include: { user: { select: { name: true } } },
        orderBy: { expiresAt: 'asc' },
      })
    : [];

  for (const supportMembership of expiringSupportMemberships) {
    entries.push({
      id: `expiring-support-${supportMembership.id}`,
      category: 'expiring_support_access',
      title: `Expiring SUPPORT access: ${supportMembership.user?.name ?? 'Unknown'}`,
      summary: `SUPPORT access expires on ${supportMembership.expiresAt!.toLocaleDateString()}.`,
      href: `/organisations`,
      urgency: 'HIGH',
      dueAt: supportMembership.expiresAt,
      sourceType: 'organisation_membership',
      sourceId: supportMembership.id,
    });
  }

  const orgWhere = ctx.orgFilter.type === 'org' ? ctx.orgFilter.filter : {};

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
        teamId: true,
      },
      orderBy: { startsAt: 'desc' },
      take: 20,
    });

    const teamFilteredMatches = await Promise.all(
      recentMatches.map(async (match) =>
        match.teamId ? await hasTeamAccess(ctx, match.teamId) : true,
      ),
    ).then((results) => recentMatches.filter((_, i) => results[i]));

    for (const match of teamFilteredMatches) {
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

  const unacknowledgedHandovers = await db.workOwnership.findMany({
    where: {
      ownerMembershipId: membership.id,
      status: 'ACTIVE',
      acknowledgedAt: null,
      assignedByMembershipId: { not: membership.id },
      organisationId,
    },
    orderBy: { createdAt: 'asc' },
  });

  for (const handover of unacknowledgedHandovers) {
    entries.push({
      id: `handover-${handover.id}`,
      category: 'unacknowledged_handover',
      title: `Handover: ${handover.targetType.replace(/_/g, ' ').toLowerCase()}`,
      summary: handover.handoverNote ?? 'Work ownership has been handed over to you. Please acknowledge.',
      href: handover.targetType === 'EVENT' ? `/events/${handover.targetId}` : `/matches/${handover.targetId}`,
      urgency: 'HIGH',
      dueAt: handover.dueAt,
      sourceType: 'work_ownership',
      sourceId: handover.id,
    });
  }

  const upcomingUnownedFixtures = isAdmin
    ? await db.workOwnership.findMany({
        where: {
          organisationId,
          targetType: 'FIXTURE',
          status: 'ACTIVE',
          dueAt: { not: null, lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { dueAt: 'asc' },
      })
    : [];

  const ownedFixtureIds = new Set(upcomingUnownedFixtures.map((o) => o.targetId));

  if (recentLeagueSeason) {
    const upcomingMatches = await db.match.findMany({
      where: {
        ...orgWhere,
        matchRound: { leagueSeasonId: recentLeagueSeason.id },
        status: 'SCHEDULED',
        startsAt: { gte: now, lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
      },
      select: {
        id: true,
        opponent: true,
        startsAt: true,
        teamId: true,
      },
      orderBy: { startsAt: 'asc' },
      take: 10,
    });

    const teamFilteredUpcoming = await Promise.all(
      upcomingMatches.map(async (match) =>
        match.teamId ? await hasTeamAccess(ctx, match.teamId) : true,
      ),
    ).then((results) => upcomingMatches.filter((_, i) => results[i]));

    for (const match of teamFilteredUpcoming) {
      if (ownedFixtureIds.has(match.id)) continue;

      entries.push({
        id: `unowned-fixture-${match.id}`,
        category: 'unowned_fixture',
        title: `No owner assigned: vs ${match.opponent}`,
        summary: `The upcoming match on ${match.startsAt.toLocaleDateString()} has no assigned owner.`,
        href: `/matches/${match.id}`,
        urgency: 'LOW',
        dueAt: match.startsAt,
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