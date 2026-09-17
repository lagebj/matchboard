/**
 * One-time production backfill (2026-09-17 live-reporting incident, Hvit vs Graabein City) —
 * second half of the incident, after `scripts/repair-stuck-live-session.ts` already ended the
 * session and seeded the report.
 *
 * Root cause (now fixed in code, `live-match-domain.ts`): `validateLiveEventInput` rejected
 * every `SCORER_SET`/`ASSIST_SET` with a 422 because they carry `correctsEventId` (the goal they
 * annotate) without a `correctionType` — a rule meant for genuine corrections, not annotations.
 * The Durable Object (`workers/live-match/src/match-session-object.ts`) accepted each of these
 * events optimistically, then marked it `failed_terminal` on the 422 and never retried it —
 * `failed_terminal` is a deliberate dead end (SPEC.md §21: a domain-invalid event must never be
 * retried forever), so the events are still sitting in that Durable Object's own storage,
 * nowhere else. Neon never saw them.
 *
 * What this script does:
 *   1. Self-signs a realtime "view" ticket (no browser session available for an already-ended
 *      match) and connects to the production Durable Object over its real WebSocket protocol to
 *      call `getSnapshot` — which returns every event the coordinator ever accepted, regardless
 *      of persistence status, with the exact original fields (SPEC.md §25: "a complete snapshot,
 *      not a partial replay window").
 *   2. Diffs that list against Neon's `LiveMatchEvent` rows by `clientEventId` to find exactly
 *      which accepted events never persisted.
 *   3. Refuses to proceed unless every missing event is `SCORER_SET`/`ASSIST_SET` with a
 *      `playerId` and a `correctsEventId` that already exists in Neon (the goal it annotates) —
 *      this script backfills exactly the known incident class, nothing else.
 *   4. Inserts the missing events, validated by the REAL `validateLiveEventInput` (now fixed)
 *      and written the same way `recordEventForActor()` writes a canonical row — that function
 *      itself cannot be imported from a plain script (`live-match-event-store.ts` starts with
 *      `import "server-only"`, which unconditionally throws outside Next's server runtime), so
 *      this mirrors its `db.liveMatchEvent.create()` call and its clientEventId-conflict
 *      idempotency exactly, preserving the original `clientEventId`/`sequence`/`acceptedAtMs`.
 *      Deliberately does NOT require (or flip) `LiveMatchSession.status: ACTIVE` the way the
 *      live coordinator path does — that guard exists to stop a stray in-flight browser command
 *      from writing after a coach has ended the match through the UI, not because `LiveMatchEvent`
 *      or anything reading it cares about session status; skipping it also means this backfill
 *      never mutates session state at all, only ever adds the specific rows in `missing`.
 *   5. Re-runs the REAL `seedReportFromLiveSession(matchId, organisationId)` to merge Goal/Assist
 *      rows into the DRAFT report. Safe to re-run: it only ever fills a category (goals/assists)
 *      the report has none of yet, never touches an already-set score, and never overwrites an
 *      explicit attendance status a coach already set (ADR-0133 H1).
 *
 * Fully idempotent: re-running finds nothing missing (step 2 comes up empty, by clientEventId)
 * and exits without writing anything.
 *
 * Usage (production, deliberate one-off):
 *   DATABASE_URL="$PRODUCTION_DATABASE_URL" npx tsx scripts/backfill-do-staged-events.ts \
 *     --match cmsfxxjlf000504l7w09hn7ac --org <organisationId> [--dry-run]
 *
 * Requires `PRODUCTION_LIVE_MATCH_REALTIME_SECRET` (or `LIVE_MATCH_REALTIME_SECRET`) in the
 * environment — the same secret the production Worker verifies tickets against
 * (`wrangler secret put LIVE_MATCH_REALTIME_SECRET --env production`).
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { WebSocket, type RawData } from "ws";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { validateLiveEventInput } from "@/lib/live-match/live-match-domain";
import { seedReportFromLiveSession } from "@/lib/reports/report-mutations";
import { runWithTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { signRealtimeTicket } from "@/lib/live-match/realtime/realtime-ticket";
import { PROTOCOL_VERSION } from "@/lib/live-match/realtime/protocol";
import { MATCH_PERIOD_ORDER, type LiveEventInput, type LiveMatchEventType, type LiveEventCorrectionType } from "@/lib/live-match/live-match-types";
import type { MatchSessionSnapshot } from "@/lib/live-match/realtime/realtime-messages";

interface Args {
  matchId: string;
  organisationId: string;
  dryRun: boolean;
  realtimeUrl: string;
  origin: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let matchId: string | undefined;
  let organisationId: string | undefined;
  let dryRun = false;
  let realtimeUrl = "wss://realtime.matchboard.football";
  let origin = "https://app.matchboard.football";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--match") matchId = argv[++i];
    else if (argv[i] === "--org") organisationId = argv[++i];
    else if (argv[i] === "--dry-run") dryRun = true;
    else if (argv[i] === "--realtime-url") realtimeUrl = argv[++i];
    else if (argv[i] === "--origin") origin = argv[++i];
  }
  if (!matchId || !organisationId) {
    console.error("Usage: --match <matchId> --org <organisationId> [--dry-run] [--realtime-url wss://...] [--origin https://...]");
    process.exit(1);
  }
  return { matchId, organisationId, dryRun, realtimeUrl, origin };
}

/** One request/response round trip over the already-open socket, matched by RPC envelope id
 * (`protocol.ts`) — mirrors what the browser client does in `use-live-realtime.ts`, just without
 * its reconnect/retry machinery, which this one-shot script has no use for. */
function callRpc(ws: WebSocket, method: string, params: unknown, timeoutMs = 15000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = randomUUID();
    const timeout = setTimeout(() => {
      ws.off("message", onMessage);
      reject(new Error(`RPC "${method}" timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    function onMessage(raw: RawData) {
      let msg: { kind?: string; id?: string; ok?: boolean; result?: unknown; error?: { code?: string; message?: string } };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (msg.kind !== "result" || msg.id !== id) return;
      clearTimeout(timeout);
      ws.off("message", onMessage);
      if (msg.ok) resolve(msg.result);
      else reject(new Error(`RPC "${method}" failed: ${msg.error?.code} ${msg.error?.message}`));
    }

    ws.on("message", onMessage);
    ws.send(JSON.stringify({ protocol: PROTOCOL_VERSION, kind: "call", id, method, params }));
  });
}

async function fetchDoSnapshot(params: {
  matchId: string;
  sessionId: string;
  organisationId: string;
  realtimeUrl: string;
  origin: string;
  secret: string;
}): Promise<MatchSessionSnapshot> {
  // "view" capability only — this script must never be able to call recordEvent/endSession on
  // the Durable Object, only read its snapshot.
  const ticket = await signRealtimeTicket(
    {
      userId: "ops-backfill-script",
      organisationId: params.organisationId,
      matchId: params.matchId,
      sessionId: params.sessionId,
      capabilities: ["view"],
      subjectType: "LEAGUE",
    },
    params.secret,
  );

  const ws = new WebSocket(`${params.realtimeUrl}/matches/${params.matchId}`, { headers: { Origin: params.origin } });
  await new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });

  try {
    await callRpc(ws, "authenticate", { ticket, clientId: "ops-backfill-script" });
    const snapshot = await callRpc(ws, "getSnapshot", {});
    return snapshot as MatchSessionSnapshot;
  } finally {
    ws.close();
  }
}

/**
 * Mirrors `recordEventForActor()`'s own write exactly (`live-match-event-store.ts`, which this
 * script cannot import — see the file header) so the resulting row is byte-identical to what the
 * live coordinator path would have written, minus that function's `LiveMatchSession.status`
 * check (deliberately not applicable to a backfill of events that already happened during the
 * session — see the file header). Idempotent by `clientEventId`, exactly like the original.
 */
async function persistBackfilledEvent(
  input: LiveEventInput,
  organisationId: string,
): Promise<{ id: string; sequence: number | null }> {
  const validationError = validateLiveEventInput(input);
  if (validationError) {
    throw new Error(`Refusing to persist ${input.clientEventId}: ${validationError}`);
  }

  const existing = await db.liveMatchEvent.findUnique({
    where: { clientEventId: input.clientEventId },
    select: { id: true, sequence: true },
  });
  if (existing) return existing;

  try {
    const event = await db.liveMatchEvent.create({
      data: {
        matchId: input.matchId,
        sessionId: input.sessionId,
        eventType: input.eventType as LiveMatchEventType,
        period: input.period ? MATCH_PERIOD_ORDER.indexOf(input.period) : undefined,
        matchSeconds: input.matchSeconds,
        wallClockTime: new Date(),
        playerId: input.playerId,
        secondaryPlayerId: input.secondaryPlayerId,
        correctionType: input.correctionType as LiveEventCorrectionType | undefined,
        correctsEventId: input.correctsEventId,
        clientEventId: input.clientEventId,
        organisationId,
        sequence: input.sequence,
        acceptedAt: input.acceptedAtMs != null ? new Date(input.acceptedAtMs) : undefined,
      },
      select: { id: true, sequence: true },
    });
    return event;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // A concurrent/retried run already created this exact row — idempotent, same as
      // recordEventForActor's own race handling.
      const raceExisting = await db.liveMatchEvent.findUnique({
        where: { clientEventId: input.clientEventId },
        select: { id: true, sequence: true },
      });
      if (raceExisting) return raceExisting;
    }
    throw error;
  }
}

async function main(): Promise<void> {
  const { matchId, organisationId, dryRun, realtimeUrl, origin } = parseArgs();
  const secret = process.env.PRODUCTION_LIVE_MATCH_REALTIME_SECRET ?? process.env.LIVE_MATCH_REALTIME_SECRET;
  if (!secret) {
    console.error("Set PRODUCTION_LIVE_MATCH_REALTIME_SECRET (or LIVE_MATCH_REALTIME_SECRET) to the Worker's verification secret.");
    process.exit(1);
  }

  await runWithTenantOrganisationId(organisationId, async () => {
    const match = await db.match.findFirst({ where: { id: matchId, organisationId }, select: { id: true, opponent: true } });
    if (!match) {
      console.error(`Match ${matchId} not found for organisation ${organisationId} — refusing.`);
      process.exit(1);
    }

    const session = await db.liveMatchSession.findFirst({
      where: { matchId, organisationId },
      select: { id: true, status: true },
      orderBy: { startedAt: "desc" },
    });
    if (!session) {
      console.error(`No LiveMatchSession found for match ${matchId} — nothing to backfill.`);
      process.exit(1);
    }

    console.log(`Session ${session.id} (status=${session.status}). Connecting to the Durable Object for a snapshot...`);
    const snapshot = await fetchDoSnapshot({ matchId, sessionId: session.id, organisationId, realtimeUrl, origin, secret });
    console.log(
      `Durable Object snapshot: ${snapshot.events.length} accepted event(s), coordinator session status=${snapshot.session.status}, lastSequence=${snapshot.lastSequence}.`,
    );

    const existingRows = await db.liveMatchEvent.findMany({ where: { matchId, organisationId }, select: { clientEventId: true } });
    const persistedClientEventIds = new Set(existingRows.map((r) => r.clientEventId).filter((id): id is string => id != null));

    const missing = snapshot.events.filter((e) => !persistedClientEventIds.has(e.clientEventId));
    console.log(`${missing.length} Durable-Object-accepted event(s) never reached Neon.`);
    if (missing.length === 0) {
      console.log("Nothing to backfill.");
      return;
    }

    // Refuse anything outside the known incident class — this script is a targeted fix for one
    // diagnosed bug, not a general "trust the coordinator over Neon" tool.
    const unexpectedType = missing.filter((e) => e.eventType !== "SCORER_SET" && e.eventType !== "ASSIST_SET");
    if (unexpectedType.length > 0) {
      console.error(
        `Refusing: ${unexpectedType.length} missing event(s) are not SCORER_SET/ASSIST_SET (${unexpectedType.map((e) => `${e.clientEventId}:${e.eventType}`).join(", ")}) — this script only backfills the known incident class.`,
      );
      process.exit(1);
    }
    for (const e of missing) {
      if (!e.playerId) {
        console.error(`Refusing: ${e.clientEventId} (${e.eventType}) has no playerId.`);
        process.exit(1);
      }
      if (e.correctsEventId && !persistedClientEventIds.has(e.correctsEventId)) {
        console.error(`Refusing: ${e.clientEventId} (${e.eventType}) targets goal ${e.correctsEventId} via correctsEventId, but that goal is not in Neon.`);
        process.exit(1);
      }
    }

    missing.sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
    console.log(`Events to backfill for ${match.opponent}, in ascending sequence order:`);
    for (const e of missing) {
      console.log(`  seq=${e.sequence ?? "-"} ${e.eventType} clientEventId=${e.clientEventId} playerId=${e.playerId} correctsEventId=${e.correctsEventId ?? "-"}`);
    }

    if (dryRun) {
      console.log("[dry-run] Would insert the events above, then re-run seedReportFromLiveSession.");
      return;
    }

    for (const e of missing) {
      const input: LiveEventInput = {
        matchId,
        sessionId: session.id,
        eventType: e.eventType as LiveMatchEventType,
        period: e.period ?? undefined,
        matchSeconds: e.matchSeconds ?? undefined,
        playerId: e.playerId,
        secondaryPlayerId: e.secondaryPlayerId,
        clientEventId: e.clientEventId,
        correctionType: e.correctionType ? (e.correctionType as LiveEventCorrectionType) : undefined,
        correctsEventId: e.correctsEventId ?? undefined,
        sequence: e.sequence ?? undefined,
        acceptedAtMs: new Date(e.createdAt).getTime(),
      };
      const canonical = await persistBackfilledEvent(input, organisationId);
      console.log(`Persisted ${e.clientEventId} -> canonical id ${canonical.id} (sequence ${canonical.sequence ?? "-"}).`);
    }

    const seed = await seedReportFromLiveSession(matchId, organisationId);
    if (!seed.success) {
      console.error(`Report merge failed: ${seed.error}`);
      process.exit(1);
    }
    console.log(`Report merged: reportId=${seed.reportId}, status=${seed.status}, merged=${seed.merged}.`);
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
