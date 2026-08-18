import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { getTenantOrganisationId, getTenantUserId } from "@/lib/tenancy/tenant-async-storage";
import { isProduction } from "@/lib/env";

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

if (!isProduction()) {
  globalForPrisma.prisma = rawClient;
}

// Tables that are organisation-scoped and require tenant filtering.
// Application-level where-clause injection is the primary tenant isolation mechanism.
// Database RLS policies serve as defence-in-depth when app.current_organization_id is set.
// Organisation is excluded because it IS the organisation, not scoped by one.
export const RLS_TABLES = new Set([
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
  "workOwnership",
  "liveMatchSession",
  "liveMatchEvent",
  "matchRotation",
  "fairPlayObservation",
  "opponentSportingEvidence",
  "playerDevelopmentObservation",
  "playerProfileSuggestion",
  "teamBestLineup",
  "teamBestLineupAssignment",
  "eventLiveMatchSession",
  "eventLiveMatchEvent",
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
      const userId = getTenantUserId();
      const isRlsTable = model != null && RLS_TABLES.has(model);
      const needsOrgFilter = isRlsTable && !!orgId && ORG_ID_PATTERN.test(orgId);

      if (RLS_DEBUG && isRlsTable) {
        if (!orgId) {
          console.warn(`[RLS] FALLTHROUGH ${model}.${operation} — no tenant context set`);
        } else {
          console.log(`[RLS] ${model}.${operation} orgId=${orgId}`);
        }
      }

      // When organisation context is not set but userId is available,
      // inject userId into OrganisationMembership queries for self-read scoping.
      // This ensures that auth resolution queries (which happen before org context
      // is known) only see the authenticated user's own memberships, preventing
      // cross-tenant membership leakage. See ARR-0052.
      if (!needsOrgFilter && model === "organisationMembership" && userId) {
        const typedArgs = args as QueryArgs;
        switch (operation) {
          case "findUnique":
          case "findFirst":
          case "findMany":
          case "count":
          case "aggregate":
          case "groupBy": {
            const where = (typedArgs.where ?? {}) as QueryArgs;
            return query({ ...typedArgs, where: { ...where, userId } });
          }
          case "update":
          case "delete":
          case "updateMany":
          case "deleteMany": {
            const where = (typedArgs.where ?? {}) as QueryArgs;
            return query({ ...typedArgs, where: { ...where, userId } });
          }
          default:
            break;
        }
      }

      if (!needsOrgFilter) {
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

// The tenantRLS extension does not add new client-level methods or modify
// result types — it only injects organisationId into where/data clauses.
// The cast to PrismaClient erases the extension's generic type parameter
// because no consumer references extension-specific types, and the extended
// client has the same surface API as PrismaClient. If Prisma's extension
// API changes or new extension-specific methods are added, this cast must
// be revisited. See ARR-0055 and ADR-0057 for context.
export const db = extendedClient as unknown as PrismaClient;