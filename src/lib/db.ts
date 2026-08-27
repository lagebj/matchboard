import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { isRlsDebug } from "@/lib/env";
import {
  getTenantOrganisationId,
  getTenantUserId,
  getSystemPrivilegeReason,
} from "@/lib/tenancy/tenant-async-storage";
import { isProduction } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Thrown by the tenantRLS extension when an RLS-scoped model is queried with no trusted
 * organisation context and no explicit system privilege (ADR-0087). Distinct class so callers
 * can distinguish this from an ordinary AuthorizationError if they ever need to.
 */
export class TenantContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantContextError";
  }
}

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
  "matchHelperAssignment",
  "rotationPath",
  "movementLedger",
  "formation",
  "formationSlot",
  "matchLineup",
  "matchLineupAssignment",
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
  "assessmentChange",
  "opponentAssessmentChange",
  "plannedRotation",
  "plannedRotationChange",
  "developmentThread",
  "developmentThreadObservation",
]);

const ORG_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

const RLS_DEBUG = isRlsDebug();

// Minimal performance visibility (platform-integrity-programme Phase 9): no APM/tracing
// exists, so this is the cheapest signal available today — log any query slow enough to be
// a real production concern. Not a substitute for real tracing if that's ever warranted.
const SLOW_QUERY_THRESHOLD_MS = 500;

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

// ARR-0029 "Bug 3": AsyncLocalStorage's enterWith() (used by setTenantOrganisationId(), called
// from requireActorContext()) can never make its mutation visible to that function's OWN caller
// once it returns — this is correct, documented Node.js behavior (enterWith() scopes "the
// remainder of the current execution", not an ancestor's), proven with a minimal reproduction:
// an async function that awaits anything before calling enterWith() has its mutation invisible
// to whoever awaits that function, even with zero concurrency. Since requireActorContext() must
// always await a DB lookup before it knows the organisation, its own setTenantOrganisationId()
// call can only ever scope its *own* remaining queries (verified correct) — never the ~350
// call sites of requireActorContext()/requirePageActorContext() that read `ctx` back and then
// issue their own queries. Retrofitting every one of those call sites to redundantly call
// setTenantOrganisationId() themselves is the "textbook correct" fix but is an enormous,
// security-critical surface to safely change at once.
//
// This is the actual protection instead: when ALS context is absent, trust an organisationId
// the caller has *already put directly into the query's own where/data* — exactly the "Prisma
// where-clause injection" pattern AGENTS.md documents as the primary tenant isolation mechanism,
// already used throughout this codebase (getOperationalContext(), requireMatchGroupAccess(),
// requireTeamGroupAccess(), etc. all explicitly merge `ctx.orgFilter.filter`/`ctx.organisationId`
// into their queries as defense-in-depth alongside ALS). That value can only have gotten there
// from a server-verified ActorContext.organisationId — never raw user input, by this codebase's
// established convention — so trusting it does not reopen ARR-0027's original hole (a query with
// *no* scoping anywhere, ALS or explicit, still throws below).
function getExplicitOrgId(operation: string, args: QueryArgs): string | undefined {
  const source = operation === "create" ? (args.data ?? {}) : (args.where ?? {});
  const organisationId = (source as QueryArgs).organisationId;
  return typeof organisationId === "string" ? organisationId : undefined;
}

// Prisma's compound-unique-key where shape (e.g. `{ userId_organisationId: { userId, organisationId } }`,
// generated from `@@unique([userId, organisationId])`) is only valid for `findUnique`. Converting
// findUnique -> findFirst (below) to safely add organisationId filtering must flatten any such key
// first, or Prisma rejects it as an unknown findFirst argument. Every compound-unique accessor in
// this schema is camelCase-field-joined-by-underscore with an object value; no real filter field in
// this codebase is named that way (verified against schema.prisma), so this heuristic is safe here.
function flattenCompoundUniqueWhere(where: QueryArgs): QueryArgs {
  const flattened: QueryArgs = {};
  for (const [key, value] of Object.entries(where)) {
    if (key.includes("_") && value !== null && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(flattened, value as QueryArgs);
    } else {
      flattened[key] = value;
    }
  }
  return flattened;
}

const extendedClient = rawClient.$extends({
  name: "tenantRLS",
  query: {
    async $allOperations({ model, operation, args, query: rawQuery }) {
      // The generated client (Prisma 7's "prisma-client" generator) reports `model` in
      // PascalCase matching the schema declaration ("Team"), not the lowerCamelCase client
      // accessor ("team") RLS_TABLES has always been keyed by (see security-audit.test.ts's
      // own PascalCase->lowerCamelCase conversion, which proves that convention was always
      // intended). Comparing the raw PascalCase `model` against RLS_TABLES/"organisationMembership"
      // directly silently never matched anything — normalize once, here, so both this and the
      // organisationMembership self-read special case below actually fire. See ARR-0029.
      const modelName = model ? model.charAt(0).toLowerCase() + model.slice(1) : null;
      const queryStart = performance.now();
      const query = async (queryArgs: unknown) => {
        try {
          return await rawQuery(queryArgs as Parameters<typeof rawQuery>[0]);
        } finally {
          const durationMs = performance.now() - queryStart;
          if (durationMs > SLOW_QUERY_THRESHOLD_MS) {
            logger.warn(
              { model: model ?? "raw", operation, durationMs: Math.round(durationMs) },
              "[slow-query]",
            );
          }
        }
      };

      const orgId = getTenantOrganisationId();
      const userId = getTenantUserId();
      const isRlsTable = modelName != null && RLS_TABLES.has(modelName);
      const needsOrgFilter = isRlsTable && !!orgId && ORG_ID_PATTERN.test(orgId);

      if (RLS_DEBUG && isRlsTable) {
        if (!orgId) {
          logger.warn({ model, operation }, "[RLS] FALLTHROUGH — no tenant context set");
        } else {
          logger.debug({ model, operation, orgId }, "[RLS]");
        }
      }

      // When organisation context is not set but userId is available,
      // inject userId into OrganisationMembership queries for self-read scoping.
      // This ensures that auth resolution queries (which happen before org context
      // is known) only see the authenticated user's own memberships, preventing
      // cross-tenant membership leakage. See ARR-0052.
      if (!needsOrgFilter && modelName === "organisationMembership" && userId) {
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
        if (isRlsTable) {
          const privilegeReason = getSystemPrivilegeReason();
          if (privilegeReason) {
            if (RLS_DEBUG) {
              logger.warn(
                { model, operation, privilegeReason },
                "[RLS] SYSTEM PRIVILEGE — unscoped by explicit runWithSystemPrivilege() opt-in",
              );
            }
            return query(args);
          }

          // See getExplicitOrgId()'s doc comment (ARR-0029 "Bug 3") for why this exists: ALS
          // context is frequently absent here for structural reasons, not because the caller
          // forgot to scope — trust an organisationId already present in the caller's own
          // where/data instead of refusing a query that is, in fact, correctly scoped.
          const explicitOrgId = getExplicitOrgId(operation, args as QueryArgs);
          if (explicitOrgId && ORG_ID_PATTERN.test(explicitOrgId)) {
            if (RLS_DEBUG) {
              logger.debug(
                { model, operation, explicitOrgId },
                "[RLS] explicit where/data organisationId trusted (no ALS context)",
              );
            }
            return query(args);
          }

          // Fail closed (ADR-0087): an RLS-scoped model with no trusted organisation context,
          // no explicit system privilege, and no explicit organisationId in the query's own
          // where/data must never run unscoped. This includes the case where orgId is present
          // but fails ORG_ID_PATTERN — a malformed/tampered value is not a softer case than
          // "absent", it is refused the same way.
          throw new TenantContextError(
            `Refusing unscoped query on RLS-scoped model "${model}" (operation "${operation}"): ` +
              "no trusted organisation context is set. Call requireActorContext() / " +
              "requirePageActorContext() / runWithTenantOrganisationId() before this query, or, " +
              "for a genuinely privileged system operation only, wrap it in runWithSystemPrivilege() " +
              "with a specific reason. See ADR-0087.",
          );
        }

        return query(args);
      }

      const typedArgs = args as QueryArgs;

      switch (operation) {
        // findUnique requires unique fields in where, so we convert to findFirst
        // to safely add organisationId filtering without breaking unique constraints.
        case "findUnique": {
          // Indexed by modelName (lowerCamelCase), not the raw PascalCase `model` — rawClient's
          // properties are the lowerCamelCase client accessors (rawClient.team), same casing
          // bug as isRlsTable above.
          const modelDelegate = (rawClient as unknown as Record<string, Record<string, (...a: unknown[]) => Promise<unknown>>>)[modelName as string];
          const flatWhere = flattenCompoundUniqueWhere((typedArgs.where ?? {}) as QueryArgs);
          return modelDelegate.findFirst(withOrgWhere({ ...typedArgs, where: flatWhere }, orgId!));
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