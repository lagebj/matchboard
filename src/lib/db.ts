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

// Use the pooled connection for runtime queries. Application-level tenant
// isolation is achieved via where-clause injection in the Prisma extension
// below, not via SET LOCAL RLS session variables. The Neon serverless driver
// does not reliably share SET LOCAL state between raw SQL and model queries
// inside the same $transaction, making where-clause injection the correct
// approach. Database RLS policies serve as a defence-in-depth safety net.
const runtimeUrl = process.env.DIRECT_RUNTIME_URL || connectionString;

const adapter = runtimeUrl.includes(".neon.tech")
  ? new PrismaNeon({ connectionString: runtimeUrl })
  : new PrismaPg(new pg.Pool({ connectionString: runtimeUrl }));

const rawClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = rawClient;
}

// Tables that are organisation-scoped and require tenant filtering.
// Application-level where-clause injection is the primary tenant isolation mechanism.
// Database RLS policies serve as defence-in-depth when app.current_organization_id is set.
// Organisation is excluded because it IS the organisation, not scoped by one.
const RLS_TABLES = new Set([
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

const ORG_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

const RLS_DEBUG = process.env.RLS_DEBUG === "1";

type QueryArgs = Record<string, unknown>;

function withOrgWhere(args: QueryArgs, orgId: string): QueryArgs {
  const where = (args.where ?? {}) as QueryArgs;
  return { ...args, where: { ...where, organisationId: orgId } };
}

function withOrgData(args: QueryArgs, orgId: string): QueryArgs {
  const data = (args.data ?? {}) as QueryArgs;
  return { ...args, data: { ...data, organisationId: orgId } };
}

function withOrgWhereAndData(args: QueryArgs, orgId: string): QueryArgs {
  return withOrgData(withOrgWhere(args, orgId), orgId);
}

const extendedClient = rawClient.$extends({
  name: "tenantRLS",
  query: {
    async $allOperations({ model, operation, args, query }) {
      const orgId = getTenantOrganisationId();
      const isRlsTable = model != null && RLS_TABLES.has(model);
      const needsFilter = isRlsTable && !!orgId && ORG_ID_PATTERN.test(orgId);

      if (RLS_DEBUG && isRlsTable) {
        if (!orgId) {
          console.warn(`[RLS] FALLTHROUGH ${model}.${operation} — no tenant context set`);
        } else {
          console.log(`[RLS] ${model}.${operation} orgId=${orgId}`);
        }
      }

      if (!needsFilter) {
        return query(args);
      }

      const typedArgs = args as QueryArgs;

      switch (operation) {
        // findUnique requires unique fields in where, so we convert to findFirst
        // to safely add organisationId filtering without breaking unique constraints.
        case "findUnique": {
          const modelDelegate = (rawClient as unknown as Record<string, Record<string, (...a: unknown[]) => Promise<unknown>>>)[model as string];
          return modelDelegate.findFirst(withOrgWhere(typedArgs, orgId!));
        }

        case "findMany":
        case "findFirst":
        case "count":
        case "aggregate":
        case "groupBy":
          return query(withOrgWhere(typedArgs, orgId!));

        case "create":
          return query(withOrgData(typedArgs, orgId!));

        case "update":
          return query(withOrgWhereAndData(typedArgs, orgId!));

        case "upsert": {
          const withWhere = withOrgWhere(typedArgs, orgId!);
          const update = (withWhere.update ?? {}) as QueryArgs;
          const create = (withWhere.create ?? {}) as QueryArgs;
          return query({
            ...withWhere,
            update: { ...update, organisationId: orgId },
            create: { ...create, organisationId: orgId },
          });
        }

        case "delete":
          return query(withOrgWhere(typedArgs, orgId!));

        case "updateMany":
        case "deleteMany":
          return query(withOrgWhere(typedArgs, orgId!));

        default:
          return query(args);
      }
    },
  },
});

export const db = extendedClient as unknown as PrismaClient;