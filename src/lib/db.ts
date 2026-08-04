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

// RLS tenant context uses SET LOCAL inside Prisma transactions, which requires
// a direct PostgreSQL connection. PgBouncer pooled connections (-pooler)
// do not reliably support SET LOCAL. Use DIRECT_URL with the runtime role
// (matchboard_app_runtime) for queries that need RLS. The direct connection
// bypasses PgBouncer while the Neon serverless driver handles connection pooling.
//
// IMPORTANT: DIRECT_URL typically uses the admin role (matchboard_admin_migration)
// which bypasses RLS. We need the runtime role for RLS enforcement.
// Construct the runtime direct URL by removing -pooler from DATABASE_URL,
// or use DIRECT_RUNTIME_URL if explicitly set.
const runtimeDirectUrl =
  process.env.DIRECT_RUNTIME_URL ||
  (connectionString.includes("-pooler.")
    ? connectionString.replace("-pooler.", ".")
    : connectionString);

const adapter = runtimeDirectUrl.includes(".neon.tech")
  ? new PrismaNeon({ connectionString: runtimeDirectUrl })
  : new PrismaPg(new pg.Pool({ connectionString: runtimeDirectUrl }));

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

const RLS_DEBUG = process.env.RLS_DEBUG === "1";

// Log the connection type at startup for diagnostics
if (typeof window === "undefined") {
  console.log(`[RLS] DB adapter: ${runtimeDirectUrl.includes(".neon.tech") ? "PrismaNeon" : "PrismaPg"}`);
  console.log(`[RLS] DB host: ${runtimeDirectUrl.match(/@([^/]+)\//)?.[1] ?? "unknown"}`);
  console.log(`[RLS] DB uses pooler: ${runtimeDirectUrl.includes("-pooler")}`);
}

const extendedClient = rawClient.$extends({
  name: "tenantRLS",
  query: {
    async $allOperations({ model, operation, args, query }) {
      const orgId = getTenantOrganisationId();

      if (RLS_DEBUG && model && RLS_TABLES.has(model) && RLS_OPS.has(operation)) {
        console.log(`[RLS] ${model}.${operation} orgId=${orgId ?? "MISSING"}`);
      }

      if (orgId && model && RLS_TABLES.has(model) && RLS_OPS.has(operation) && ORG_ID_PATTERN.test(orgId)) {
        return rawClient.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL app.current_organization_id = '${orgId}'`);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const modelDelegate = (tx as any)[model!];
          return modelDelegate[operation](args);
        });
      }

      if (RLS_DEBUG && model && RLS_TABLES.has(model) && RLS_OPS.has(operation) && !orgId) {
        console.warn(`[RLS] FALLTHROUGH ${model}.${operation} — no tenant context set`);
      }

      return query(args);
    },
  },
});

export const db = extendedClient as unknown as PrismaClient;