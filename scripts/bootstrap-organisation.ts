/**
 * Bootstrap Organisation Migration Script
 * 
 * Per ADR-0035 MT-2.8: Automatic idempotent migration using
 * BOOTSTRAP_OWNER_EMAIL, BOOTSTRAP_ORGANIZATION_NAME, and
 * BOOTSTRAP_ORGANIZATION_SLUG environment variables.
 * 
 * This script:
 * 1. Creates a bootstrap organisation if one doesn't exist
 * 2. Creates an OWNER membership for the bootstrap user
 * 3. Assigns all existing rows with null organisationId to the bootstrap org
 * 4. Is idempotent — safe to run multiple times
 * 
 * Usage:
 *   npx tsx scripts/bootstrap-organisation.ts
 * 
 * Required environment variables:
 *   DATABASE_URL        — database connection
 *   BOOTSTRAP_OWNER_EMAIL — email of the user who will be the org OWNER
 *   BOOTSTRAP_ORGANIZATION_NAME — name of the bootstrap organisation
 *   BOOTSTRAP_ORGANIZATION_SLUG — URL-safe slug for the bootstrap organisation
 */

import { db } from "../src/lib/db";

const BOOTSTRAP_ORG_NAME = process.env.BOOTSTRAP_ORGANIZATION_NAME ?? "Default Club";
const BOOTSTRAP_ORG_SLUG = process.env.BOOTSTRAP_ORGANIZATION_SLUG ?? "default-club";
const BOOTSTRAP_OWNER_EMAIL = process.env.BOOTSTRAP_OWNER_EMAIL;

if (!BOOTSTRAP_OWNER_EMAIL) {
  console.error("BOOTSTRAP_OWNER_EMAIL is required.");
  process.exit(1);
}

async function main() {
  try {
    console.log("Starting bootstrap organisation migration...");
    console.log(`  Organisation: ${BOOTSTRAP_ORG_NAME} (${BOOTSTRAP_ORG_SLUG})`);
    console.log(`  Owner email: ${BOOTSTRAP_OWNER_EMAIL}`);

    const user = await db.user.findFirst({
      where: { email: BOOTSTRAP_OWNER_EMAIL },
    });

    if (!user) {
      console.error(`User with email ${BOOTSTRAP_OWNER_EMAIL} not found. Create the user first.`);
      process.exit(1);
    }

    const existingOrg = await db.organisation.findFirst({
      where: { slug: BOOTSTRAP_ORG_SLUG },
    });

    let orgId: string;

    if (existingOrg) {
      orgId = existingOrg.id;
      console.log(`  Organisation already exists: ${existingOrg.name} (${existingOrg.id})`);
    } else {
      const org = await db.organisation.create({
        data: {
          name: BOOTSTRAP_ORG_NAME,
          slug: BOOTSTRAP_ORG_SLUG,
          memberships: {
            create: {
              userId: user.id,
              role: "OWNER",
            },
          },
        },
      });
      orgId = org.id;
      console.log(`  Created organisation: ${org.name} (${org.id})`);
    }

    const existingMembership = await db.organisationMembership.findUnique({
      where: { userId_organisationId: { userId: user.id, organisationId: orgId } },
    });

    if (!existingMembership) {
      await db.organisationMembership.create({
        data: {
          userId: user.id,
          organisationId: orgId,
          role: "OWNER",
        },
      });
      console.log(`  Created OWNER membership for ${user.email}`);
    } else {
      console.log(`  Membership already exists for ${user.email} (role: ${existingMembership.role})`);
    }

    console.log(`\n  Assigning existing rows to organisation ${orgId}...`);

    // Assign rows table by table using Prisma model updates
    // Each update sets organisationId on rows where it is still null
    const updateResults = await Promise.all([
      db.player.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["Player", r.count] as const),
      db.opponentTeam.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["OpponentTeam", r.count] as const),
      db.leagueSeason.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["LeagueSeason", r.count] as const),
      db.season.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["Season", r.count] as const),
      db.match.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["Match", r.count] as const),
      db.matchRound.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["MatchRound", r.count] as const),
      db.availability.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["Availability", r.count] as const),
      db.selection.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["Selection", r.count] as const),
      db.rotationPath.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["RotationPath", r.count] as const),
      db.movementLedger.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["MovementLedger", r.count] as const),
      db.formation.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["Formation", r.count] as const),
      db.formationSlot.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["FormationSlot", r.count] as const),
      db.matchLineup.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["MatchLineup", r.count] as const),
      db.matchLineupAssignment.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["MatchLineupAssignment", r.count] as const),
      db.playerPosition.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["PlayerPosition", r.count] as const),
      db.warning.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["Warning", r.count] as const),
      db.playerLock.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["PlayerLock", r.count] as const),
      db.selectionAudit.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["SelectionAudit", r.count] as const),
      db.decisionRecord.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["DecisionRecord", r.count] as const),
      db.coachingIntent.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["CoachingIntent", r.count] as const),
      db.postMatchReport.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["PostMatchReport", r.count] as const),
      db.postMatchPlayerActual.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["PostMatchPlayerActual", r.count] as const),
      db.goal.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["Goal", r.count] as const),
      db.assist.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["Assist", r.count] as const),
      db.matchReportAbsence.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["MatchReportAbsence", r.count] as const),
      db.matchReportPlayerStat.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["MatchReportPlayerStat", r.count] as const),
      db.playerReadinessSignal.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["PlayerReadinessSignal", r.count] as const),
      db.matchExecutionFeedback.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["MatchExecutionFeedback", r.count] as const),
      db.teamReflection.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["TeamReflection", r.count] as const),
      db.opponentEncounterObservation.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["OpponentEncounterObservation", r.count] as const),
      db.selectionExplanation.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["SelectionExplanation", r.count] as const),
      db.movementCandidate.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["MovementCandidate", r.count] as const),
      db.event.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["Event", r.count] as const),
      db.eventPlayerAvailability.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["EventPlayerAvailability", r.count] as const),
      db.eventSquad.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["EventSquad", r.count] as const),
      db.eventSquadPlayer.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["EventSquadPlayer", r.count] as const),
      db.eventMatch.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["EventMatch", r.count] as const),
      db.team.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["Team", r.count] as const),
      db.leagueSeason.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["LeagueSeason", r.count] as const),
      db.ruleConfig.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["RuleConfig", r.count] as const),
      db.eventPostMatchReport.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["EventPostMatchReport", r.count] as const),
      db.eventPostMatchPlayer.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["EventPostMatchPlayer", r.count] as const),
      db.eventGoalEvent.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["EventGoalEvent", r.count] as const),
      db.eventAssistEvent.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["EventAssistEvent", r.count] as const),
      db.eventMatchSupportAssignment.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["EventMatchSupportAssignment", r.count] as const),
      db.eventMatchLineup.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["EventMatchLineup", r.count] as const),
      db.eventMatchLineupAssignment.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["EventMatchLineupAssignment", r.count] as const),
      db.seasonPeriodSnapshot.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["SeasonPeriodSnapshot", r.count] as const),
      db.teamSeasonSnapshot.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["TeamSeasonSnapshot", r.count] as const),
      db.teamSeasonSnapshotPlayer.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["TeamSeasonSnapshotPlayer", r.count] as const),
      db.policyDecisionLog.updateMany({ where: { organisationId: null }, data: { organisationId: orgId } }).then((r) => ["PolicyDecisionLog", r.count] as const),
    ]);

    for (const [table, count] of updateResults) {
      if (count > 0) {
        console.log(`    ${table}: ${count} rows updated`);
      }
    }

    console.log("\nBootstrap organisation migration complete.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();