import { db } from "@/lib/db";
import { hasMatchPassed } from "@/lib/match-date-utils";
import type { AssistantWorkItem } from "@/lib/assistant/types";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

export async function getEventWorkItems(orgFilter?: OrgFilterMode): Promise<AssistantWorkItem[]> {
  const orgWhere = orgFilter && orgFilter.type === "org" ? orgFilter.filter : {};
  const now = new Date();
  const items: AssistantWorkItem[] = [];

  const events = await db.event.findMany({
    where: { ...orgWhere },
    orderBy: { startsAt: "asc" },
  });

  for (const event of events) {
    const eventMatches = await db.eventMatch.findMany({
      where: { eventId: event.id, status: { not: "CANCELLED" } },
      include: {
        eventSquad: { select: { id: true, name: true, targetSize: true } },
        postMatchReport: { select: { id: true, status: true } },
        lineup: { select: { id: true } },
        supportAssignments: { select: { id: true } },
      },
    });

    const squadCount = await db.eventSquad.count({
      where: { eventId: event.id },
    });

    const availablePlayerCount = await db.eventPlayerAvailability.count({
      where: { eventId: event.id, status: "AVAILABLE" },
    });

    const totalMatchCount = await db.eventMatch.count({
      where: { eventId: event.id },
    });

    if (eventMatches.length === 0 && totalMatchCount === 0) {
      items.push({
        id: `event-setup-${event.id}`,
        category: "event_setup_missing",
        priority: 2,
        title: `${event.name} needs match setup`,
        summary: "Event has no matches configured.",
        matchRoundId: "",
        eventId: event.id,
        affectedTeamIds: [],
        affectedPlayerIds: [],
        primaryActionLabel: "Setup matches",
        primaryActionHref: `/events/${event.id}`,
      });
      continue;
    }

    if (eventMatches.length === 0) {
      continue;
    }

    if (squadCount === 0) {
      items.push({
        id: `event-squads-${event.id}`,
        category: "event_squads_missing",
        priority: 4,
        title: `${event.name} needs squad setup`,
        summary: "Event has matches but no squads.",
        matchRoundId: "",
        eventId: event.id,
        affectedTeamIds: [],
        affectedPlayerIds: [],
        primaryActionLabel: "Setup squads",
        primaryActionHref: `/events/${event.id}`,
      });
      continue;
    }

    if (squadCount > 0) {
      const draftSquadCount = await db.eventSquad.count({
        where: { eventId: event.id, status: "DRAFT" },
      });

      if (draftSquadCount === squadCount) {
        items.push({
          id: `event-squads-draft-${event.id}`,
          category: "event_squads_ready",
          priority: 5,
          title: `${event.name}: squads need review`,
          summary: "Generated squads are ready for review before committing.",
          matchRoundId: "",
          eventId: event.id,
          affectedTeamIds: [],
          affectedPlayerIds: [],
          primaryActionLabel: "View squads",
          primaryActionHref: `/events/${event.id}`,
        });
      }
    }

    for (const match of eventMatches) {
      const lineupExists = !!match.lineup;
      const reportExists = !!match.postMatchReport;
      const reportIsDraft = match.postMatchReport?.status === "DRAFT";
      const hasPassed = hasMatchPassed(
        { startsAt: match.startsAt, matchDurationMinutes: event.matchDurationMinutes, status: match.status },
        now,
      );

      if (!lineupExists && !hasPassed) {
        const hasExistingItem = items.some(
          (i) => i.category === "event_lineup_missing" && i.eventId === event.id,
        );
        if (!hasExistingItem) {
          items.push({
            id: `event-lineup-${match.id}`,
            category: "event_lineup_missing",
            priority: 5,
            title: `${event.name}: lineup needed`,
            summary: `Match vs ${match.opponentName || "opponent"} has no planned lineup.`,
            matchRoundId: "",
            matchId: match.id,
            eventId: event.id,
            affectedTeamIds: [],
            affectedPlayerIds: [],
            primaryActionLabel: "Plan lineup",
            primaryActionHref: `/events/${event.id}`,
          });
        }
        continue;
      }

      if (hasPassed && !reportExists) {
        items.push({
          id: `event-report-${match.id}`,
          category: "event_report_needed",
          priority: 10,
          title: `${event.name}: post-match report needed`,
          summary: `Match vs ${match.opponentName || "opponent"} has passed with no report.`,
          matchRoundId: "",
          matchId: match.id,
          eventId: event.id,
          affectedTeamIds: [],
          affectedPlayerIds: [],
          primaryActionLabel: "Create report",
          primaryActionHref: `/events/${event.id}`,
        });
        continue;
      }

      if (hasPassed && reportIsDraft) {
        items.push({
          id: `event-report-incomplete-${match.id}`,
          category: "event_report_incomplete",
          priority: 12,
          title: `${event.name}: complete post-match report`,
          summary: `Match vs ${match.opponentName || "opponent"} has a draft report.`,
          matchRoundId: "",
          matchId: match.id,
          eventId: event.id,
          affectedTeamIds: [],
          affectedPlayerIds: [],
          primaryActionLabel: "Continue report",
          primaryActionHref: `/events/${event.id}`,
        });
        continue;
      }

      if (match.supportAssignments.length === 0 && match.eventSquad && availablePlayerCount > (match.eventSquad.targetSize ?? 0)) {
        const hasExistingItem = items.some(
          (i) => i.category === "event_helpers_missing" && i.eventId === event.id,
        );
        if (!hasExistingItem) {
          items.push({
            id: `event-helpers-${match.id}`,
            category: "event_helpers_missing",
            priority: 9,
            title: `${event.name}: helpers needed`,
            summary: `Match vs ${match.opponentName || "opponent"} may need support players.`,
            matchRoundId: "",
            matchId: match.id,
            eventId: event.id,
            affectedTeamIds: [],
            affectedPlayerIds: [],
            primaryActionLabel: "Plan helpers",
            primaryActionHref: `/events/${event.id}`,
          });
        }
      }
    }
  }

  return items;
}