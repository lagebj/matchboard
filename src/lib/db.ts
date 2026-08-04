import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { getTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set. Add it to your .env file.");
}

const adapter = connectionString.includes(".neon.tech")
  ? new PrismaNeon({ connectionString })
  : new PrismaPg(new pg.Pool({ connectionString }));

const rawClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = rawClient;
}

const RLS_TABLES = new Set([
  "organisation",
  "organisationMembership",
  "organisationInvitation",
  "machinePrincipal",
  "footballGroup",
  "groupAccess",
  "footballGroupPlayer",
  "groupMovementPath",
  "team",
  "player",
  "match",
  "opponentTeam",
  "ruleConfig",
  "season",
  "leagueSeason",
  "matchRound",
  "availability",
  "selection",
  "rotationPath",
  "movementLedger",
  "formation",
  "formationSlot",
  "matchLineup",
  "matchLineupAssignment",
  "playerPosition",
  "warning",
  "playerLock",
  "selectionAudit",
  "decisionRecord",
  "coachingIntent",
  "postMatchReport",
  "postMatchPlayerActual",
  "goal",
  "assist",
  "matchReportAbsence",
  "matchReportPlayerStat",
  "playerReadinessSignal",
  "matchExecutionFeedback",
  "teamReflection",
  "opponentEncounterObservation",
  "selectionExplanation",
  "movementCandidate",
  "event",
  "eventPlayerAvailability",
  "eventSquad",
  "eventSquadPlayer",
  "eventMatch",
  "eventPostMatchReport",
  "eventPostMatchPlayer",
  "eventGoalEvent",
  "eventAssistEvent",
  "eventMatchSupportAssignment",
  "eventMatchLineup",
  "eventMatchLineupAssignment",
  "seasonPeriodSnapshot",
  "teamSeasonSnapshot",
  "teamSeasonSnapshotPlayer",
  "policyDecisionLog",
  "reviewRequest",
  "notificationOutbox",
  "workOwnership",
  "liveMatchSession",
  "liveMatchEvent",
  "matchRotation",
  "fairPlayObservation",
  "opponentSportingEvidence",
  "playerDevelopmentObservation",
  "playerProfileSuggestion",
]);

const RLS_OPS = new Set([
  "findMany", "findFirst", "findUnique", "create", "update",
  "delete", "updateMany", "deleteMany", "count", "aggregate",
  "groupBy", "upsert",
]);

const ORG_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

const extendedClient = rawClient.$extends({
  name: "tenantRLS",
  query: {
    async $allOperations({ model, operation, args, query }) {
      const orgId = getTenantOrganisationId();

      if (orgId && model && RLS_TABLES.has(model) && RLS_OPS.has(operation) && ORG_ID_PATTERN.test(orgId)) {
        return rawClient.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL app.current_organization_id = '${orgId}'`);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const modelDelegate = (tx as any)[model!];
          return modelDelegate[operation](args);
        });
      }

      return query(args);
    },
  },
});

export const db = extendedClient as unknown as PrismaClient;