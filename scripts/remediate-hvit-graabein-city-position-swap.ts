/**
 * ONE-OFF, guarded remediation for the Hvit v Graabein City League match
 * (matchId cmsfxxjlf000504l7w09hn7ac, organisationId
 * msamadfdrf0uhjelo0czgd5omf7kyf) — the incident that led to
 * `fix(live-match): stop a position correction reassigning an uninvolved
 * substitute` / "pick a teammate to swap with instead of a position code"
 * (PR #667).
 *
 * Root cause (fixed in that PR, going forward): the planned rotation's
 * position-only swap entry (sequence 2 of PlannedRotation cmu4hq32d…,
 * "Anton BB out / Ibro O in") had `outPosition`/`inPosition` recorded
 * backwards — each player's *declared* `Player.primaryPosition` (Anton
 * declared ST, Ibro declared CB) rather than their actual position at that
 * point in the match (Anton was genuinely playing CB from kickoff; Ibro had
 * just subbed on to play ST). Applying that plan live recorded two
 * `POSITIONS_CHANGED` events with the same backwards positions, which
 * `rebuildActualTimeline()` then faithfully turned into a wrong
 * `ActualPositionInterval` history for both players — this is what Match
 * Insights was reporting ("Ibro O has no recorded playing time at CB this
 * season") when the coach flagged it as false.
 *
 * This script corrects the two source facts and rebuilds everything
 * downstream from them — it does not hand-edit `ActualPositionInterval`,
 * `PostMatchPlayerActual.actualPositions`, or any other derived table
 * directly, since those are recomputed products of the event log, not
 * independent facts (ARR-0052's own point: don't create a fourth
 * derivation, use the one real rebuild path):
 *
 *   1. `PlannedRotationChange` (sequence 2): outPosition/inPosition swapped
 *      to the correct values (CB/ST instead of ST/CB) — a direct edit,
 *      matching how the coach's own "Edit change" form edits this row;
 *      plans are not an append-only log.
 *   2. The two wrong `POSITIONS_CHANGED` `LiveMatchEvent` rows are left
 *      untouched (never mutated — ARR-0047's own finding: an event row's
 *      `correctionType` stays `null` forever) and instead *reversed* via
 *      the app's own existing undo mechanism (`EVENT_REVERSED` marker rows,
 *      the same shape `handleUndo()` in `live-match-client.tsx` produces),
 *      followed by two new `POSITIONS_CHANGED` events at the exact same
 *      period/matchSeconds with the corrected payloads — so the timeline's
 *      interval boundary is unchanged, only the position values are.
 *   3. `replayPostMatchLearningHistory()` is re-run for this one match,
 *      which rebuilds `ActualPositionInterval` (and everything the
 *      Evidence-Informed Match Planning programme derives from it) from
 *      the now-corrected event log — the same idempotent pipeline every
 *      completed match's report-completion already runs through.
 *
 * DRY-RUN BY DEFAULT. Pass `--apply` to write. Idempotent: re-running finds
 * the plan row already corrected and the events already reversed, and
 * skips those steps (only the rebuild re-runs, harmlessly).
 *
 * Usage:
 *   DATABASE_URL="$(neon connection-string production --project-id mute-mode-75031528 \
 *     --database-name neondb --role-name neondb_owner)" \
 *     npx tsx scripts/remediate-hvit-graabein-city-position-swap.ts        # dry-run
 *   ... same, with --apply                                                 # write
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { runWithTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { replayPostMatchLearningHistory } from "@/lib/evidence/post-match-learning-replay";

const MATCH_ID = "cmsfxxjlf000504l7w09hn7ac";
const ORG_ID = "msamadfdrf0uhjelo0czgd5omf7kyf";

const PLANNED_ROTATION_ID = "cmu4hq32d000004jmfnxmgj1h";
const PLANNED_CHANGE_ID = "cmu4iwsw1000f04jthf95lddk"; // sequence 2

const ANTON_PLAYER_ID = "cmorflsma00046wo7d558rrcv"; // declared ST, genuinely played CB
const IBRO_PLAYER_ID = "cmorfv4r1000k6wo76roy79lc"; // declared CB, genuinely played ST

const ANTON_EVENT_ID = "cmu5q7fvb000004kx8awjwb8b"; // wrong: fromPosition ST -> toPosition CB
const IBRO_EVENT_ID = "cmu5q7g01000104kxm2pt2myu"; // wrong: fromPosition CB -> toPosition ST

// Both wrong events share this session, period, and matchSeconds — reused for the
// replacement events so the corrected timeline has the exact same interval boundary.
const SESSION_ID = "cmu5psumd000004jpou9c7s7a";
const PERIOD = 3;
const MATCH_SECONDS = 626929;

async function main() {
  const apply = process.argv.includes("--apply");
  const mode = apply ? "APPLY" : "DRY-RUN";
  console.log(`\n=== Hvit v Graabein City position-swap remediation (${mode}) ===\n`);

  await runWithTenantOrganisationId(ORG_ID, async () => {
    // ── Pre-flight: state must be exactly what this remediation expects ──────
    const match = await db.match.findFirst({ where: { id: MATCH_ID, organisationId: ORG_ID }, select: { id: true } });
    if (!match) throw new Error(`Match ${MATCH_ID} not found for org ${ORG_ID}. Aborting.`);

    const change = await db.plannedRotationChange.findFirst({
      where: { id: PLANNED_CHANGE_ID, plannedRotationId: PLANNED_ROTATION_ID, organisationId: ORG_ID },
      select: { outPlayerId: true, inPlayerId: true, outPosition: true, inPosition: true, positionOnly: true },
    });
    if (!change) throw new Error(`PlannedRotationChange ${PLANNED_CHANGE_ID} not found. Aborting.`);
    if (change.outPlayerId !== ANTON_PLAYER_ID || change.inPlayerId !== IBRO_PLAYER_ID || !change.positionOnly) {
      throw new Error(`PlannedRotationChange ${PLANNED_CHANGE_ID} does not match the expected out/in players. Aborting.`);
    }
    const planAlreadyFixed = change.outPosition === "CB" && change.inPosition === "ST";
    if (!planAlreadyFixed && !(change.outPosition === "ST" && change.inPosition === "CB")) {
      throw new Error(
        `PlannedRotationChange ${PLANNED_CHANGE_ID} has unexpected outPosition/inPosition ` +
          `(${change.outPosition}/${change.inPosition}) — neither the known-wrong nor the known-fixed values. Aborting.`,
      );
    }

    const [antonEvent, ibroEvent] = await Promise.all([
      db.liveMatchEvent.findFirst({
        where: { id: ANTON_EVENT_ID, matchId: MATCH_ID, organisationId: ORG_ID },
        select: { id: true, playerId: true, payload: true, period: true, matchSeconds: true, sessionId: true, correctionType: true },
      }),
      db.liveMatchEvent.findFirst({
        where: { id: IBRO_EVENT_ID, matchId: MATCH_ID, organisationId: ORG_ID },
        select: { id: true, playerId: true, payload: true, period: true, matchSeconds: true, sessionId: true, correctionType: true },
      }),
    ]);
    if (!antonEvent || !ibroEvent) throw new Error("One or both source POSITIONS_CHANGED events not found. Aborting.");
    if (antonEvent.playerId !== ANTON_PLAYER_ID || ibroEvent.playerId !== IBRO_PLAYER_ID) {
      throw new Error("Source events do not have the expected playerId. Aborting.");
    }
    const antonPayload = antonEvent.payload as { fromPosition?: string; toPosition?: string } | null;
    const ibroPayload = ibroEvent.payload as { fromPosition?: string; toPosition?: string } | null;
    const eventsLookWrong =
      antonPayload?.fromPosition === "ST" && antonPayload?.toPosition === "CB" &&
      ibroPayload?.fromPosition === "CB" && ibroPayload?.toPosition === "ST";

    const [existingReversalOfAnton, existingReversalOfIbro] = await Promise.all([
      db.liveMatchEvent.findFirst({ where: { matchId: MATCH_ID, organisationId: ORG_ID, eventType: "EVENT_REVERSED", correctsEventId: ANTON_EVENT_ID } }),
      db.liveMatchEvent.findFirst({ where: { matchId: MATCH_ID, organisationId: ORG_ID, eventType: "EVENT_REVERSED", correctsEventId: IBRO_EVENT_ID } }),
    ]);
    const eventsAlreadyReversed = Boolean(existingReversalOfAnton && existingReversalOfIbro);

    if (!eventsLookWrong && !eventsAlreadyReversed) {
      throw new Error(
        `Source events have neither the expected wrong payloads nor an existing reversal — ` +
          `Anton=${JSON.stringify(antonPayload)} Ibro=${JSON.stringify(ibroPayload)}. Aborting.`,
      );
    }

    console.log("── 1. PlannedRotationChange fix ──");
    if (planAlreadyFixed) {
      console.log(`  SKIPPED — already outPosition=CB inPosition=ST (this appears to be a re-run).`);
    } else {
      console.log(`  outPosition: ST -> CB`);
      console.log(`  inPosition:  CB -> ST`);
    }

    console.log("\n── 2. LiveMatchEvent reversal + correction ──");
    if (eventsAlreadyReversed) {
      console.log(`  SKIPPED — both events already have an EVENT_REVERSED marker (this appears to be a re-run).`);
    } else {
      console.log(`  Reverse ${ANTON_EVENT_ID} (Anton BB, currently ${JSON.stringify(antonPayload)})`);
      console.log(`  Reverse ${IBRO_EVENT_ID}  (Ibro O,   currently ${JSON.stringify(ibroPayload)})`);
      console.log(`  Record new POSITIONS_CHANGED for Anton BB: fromPosition=CB toPosition=ST (period=${PERIOD} matchSeconds=${MATCH_SECONDS})`);
      console.log(`  Record new POSITIONS_CHANGED for Ibro O:   fromPosition=ST toPosition=CB (period=${PERIOD} matchSeconds=${MATCH_SECONDS})`);
    }

    if (!apply) {
      console.log(`\n(DRY-RUN) No writes performed. Would then call replayPostMatchLearningHistory("${ORG_ID}", { matchId: "${MATCH_ID}" }).\n`);
      return;
    }

    // ── Writes ────────────────────────────────────────────────────────────
    console.log("\n── Applying ──");

    if (!planAlreadyFixed) {
      await db.plannedRotationChange.update({
        where: { id: PLANNED_CHANGE_ID },
        data: { outPosition: "CB", inPosition: "ST" },
      });
      console.log("  PlannedRotationChange updated");
    }

    if (!eventsAlreadyReversed) {
      await db.liveMatchEvent.create({
        data: {
          matchId: MATCH_ID,
          organisationId: ORG_ID,
          sessionId: SESSION_ID,
          eventType: "EVENT_REVERSED",
          correctionType: "REVERSAL",
          correctsEventId: ANTON_EVENT_ID,
          wallClockTime: new Date(),
          clientEventId: crypto.randomUUID(),
        },
      });
      await db.liveMatchEvent.create({
        data: {
          matchId: MATCH_ID,
          organisationId: ORG_ID,
          sessionId: SESSION_ID,
          eventType: "EVENT_REVERSED",
          correctionType: "REVERSAL",
          correctsEventId: IBRO_EVENT_ID,
          wallClockTime: new Date(),
          clientEventId: crypto.randomUUID(),
        },
      });
      console.log("  2 EVENT_REVERSED marker rows created");

      await db.liveMatchEvent.create({
        data: {
          matchId: MATCH_ID,
          organisationId: ORG_ID,
          sessionId: SESSION_ID,
          eventType: "POSITIONS_CHANGED",
          period: PERIOD,
          matchSeconds: MATCH_SECONDS,
          playerId: ANTON_PLAYER_ID,
          payload: { fromPosition: "CB", toPosition: "ST" },
          wallClockTime: new Date(),
          clientEventId: crypto.randomUUID(),
        },
      });
      await db.liveMatchEvent.create({
        data: {
          matchId: MATCH_ID,
          organisationId: ORG_ID,
          sessionId: SESSION_ID,
          eventType: "POSITIONS_CHANGED",
          period: PERIOD,
          matchSeconds: MATCH_SECONDS,
          playerId: IBRO_PLAYER_ID,
          payload: { fromPosition: "ST", toPosition: "CB" },
          wallClockTime: new Date(),
          clientEventId: crypto.randomUUID(),
        },
      });
      console.log("  2 corrected POSITIONS_CHANGED rows created");
    }

    console.log("\n── Rebuilding post-match learning ──");
    const learning = await replayPostMatchLearningHistory(ORG_ID, { matchId: MATCH_ID });
    console.log(JSON.stringify(learning, null, 2));
    console.log("\nDone.\n");
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
