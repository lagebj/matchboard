/**
 * ONE-OFF, guarded remediation for the Rød v Drammens BK Blå League match
 * (2026-09-09, ~17:30–18:40 CEST) — the incident investigated in ADR-0133.
 *
 * The live-reporting session persisted 68 `LiveMatchEvent` rows, but
 * `seedReportFromLiveSession()` no-op'd against a DRAFT report that already
 * existed (ADR-0133 S5 / H1), so the coach re-entered the score and scorers by
 * hand at 19:53 CEST. That left the LOCKED `PostMatchReport`:
 *
 *   - 8 `Goal` rows, all `minute = NULL`
 *   - 0 `Assist` rows        (7 live `ASSIST_SET` events lost)
 *   - 0 `MatchRotation` rows  (13 live substitution pairs lost)
 *
 * This script reconstructs the recoverable evidence from the surviving live
 * timeline WITHOUT touching the coach's authoritative facts:
 *
 *   - the 3–8 scoreline is NOT recomputed or changed
 *   - `Goal` scorer attribution is NOT changed
 *   - report `status` / `completedAt` / `completedBy` are NOT changed
 *
 * It only:
 *   1. Backfills `Goal.minute` on the 7 hand-entered goal rows that map 1:1 (by
 *      scorer, in chronological order) to a surviving `GOAL_FOR` live event.
 *      The 8th goal (Benjamin LR) has no live event — its `minute` stays NULL.
 *   2. Creates the 5 lost `Assist` rows from the surviving `ASSIST_SET` events,
 *      plus 1 coach-asserted assist for the 8th goal (Oliver IS — the coach
 *      stated this explicitly; the goal itself was never live-recorded).
 *   3. Recreates the 13 lost `MatchRotation` rows by pairing `ROTATION_OUT` /
 *      `ROTATION_IN` events (same period, wall-clock within 5 s). The one
 *      substitution whose `ROTATION_IN` carried an `EVENT_REVERSED` marker is
 *      still included — the coach confirmed it happened. Substitutions after
 *      16:17:49 UTC were never recorded live and are left absent.
 *   4. Re-runs `replayPostMatchLearningHistory()` for this match so the actual
 *      timeline / combination / opponent / player evidence rebuilds from the
 *      restored rotations.
 *
 * Minute derivation (matching `combination-goal-attribution.ts`, which reads
 * `Goal.minute` as a continuous play-minute and does `minute * 60_000`):
 *   - first-half goal:  floor((wall - kickoff) / 60_000), min 1
 *   - second-half goal: round((halfTime - kickoff) / 60_000)  (= 31 here)
 *                       + floor((wall - secondHalfStart) / 60_000)
 * Period boundaries are the FIRST recorded PERIOD_START/PERIOD_END events, i.e.
 * before the F5 replay burst re-emitted them.
 *
 * DRY-RUN BY DEFAULT. Pass `--apply` to write. Idempotent: re-running re-derives
 * the same values; assists are only created when the report has none, LIVE
 * rotations are deleted and recreated.
 *
 * Usage:
 *   DATABASE_URL="$(neon connection-string production --project-id mute-mode-75031528 \
 *     --database-name neondb --role-name neondb_owner)" \
 *     npx tsx scripts/remediate-rod-drammens-live-report.ts            # dry-run
 *   ... same, with --apply                                             # write
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { runWithTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { replayPostMatchLearningHistory } from "@/lib/evidence/post-match-learning-replay";

const MATCH_ID = "cmsfxtt2t000304l7b3pyeuwr";
const ORG_ID = "msamadfdrf0uhjelo0czgd5omf7kyf";
const REPORT_ID = "cmtu88rqg00000bgmsx3t29ag";

/**
 * Goal row id -> the surviving `GOAL_FOR` live event id it maps to (by scorer,
 * chronological). `null` = no live event (Benjamin LR's 8th goal). Verified
 * below: each mapped event's `SCORER_SET` playerId must equal the Goal row's
 * playerId, or the script aborts.
 */
const GOAL_TO_LIVE_EVENT: Record<string, string | null> = {
  cmtuedmz000000agmcreehfnf: "cmtu9b3hu000004i5c0a6px12", // Wesam A   (1H)
  cmtuedr1w00010agm3vm2d8yk: "cmtuavf8q000204l7pijvybcs", // Anton BB  (2H)
  cmtuedtgh00020agmbo7k9dpr: "cmtuax69l000104ldg6sis6ef", // Anton BB  (2H)
  cmtuedw1c00030agm51wd6xa9: "cmtub02ns000404l7gbbky0r6", // Anton BB  (2H)
  cmtuedzg300040agmiypt4ao2: "cmtub5701000204lai6aidrv0", // Stas B    (2H)
  cmtuee21b00050agmmtv89nwd: "cmtubaq4a000604l71sm9f9qb", // Stas B    (2H)
  cmtuee8x400060agm4ic0kb1d: "cmtub3q4k000504l70vsa88qy", // Adrian M  (2H)
  cmtueecfv00070agmbxp33dg8: null, //                        Benjamin LR — no live event
};

/** Surviving `ASSIST_SET` live event ids whose goal was NOT dropped/reversed. */
const LIVE_ASSIST_EVENT_IDS = [
  "cmtu9b64y000204i500vd3u40", // -> Benjamin LR   (assisted Wesam A, 1H)
  "cmtuax860000504lbdpl3jm3f", // -> cmorfn9y7     (assisted Anton BB, 2H)
  "cmtub05i4000104l1nztq3ka6", // -> cmorfl43u     (assisted Anton BB, 2H)
  "cmtub3zl500000agmv0hcza1q", // -> Oliver IS     (assisted Adrian M, 2H)
  "cmtubasz7000704l7vudlqgkf", // -> Oliver IS     (assisted Stas B, 2H)
];

/**
 * Coach-asserted assist for the 8th goal, which was never live-recorded. The
 * coach stated it twice: "the last goal is Benjamin LR with assist by Oliver
 * IS" / "then Benjamin LR assisted by Oliver IS". Set to `[]` to omit.
 */
const COACH_ASSERTED_ASSIST_PLAYER_IDS = ["cmorfqn26000c6wo7xtbphfv2"]; // Oliver IS

async function resolveNames(ids: string[]): Promise<Map<string, string>> {
  const rows = await db.player.findMany({
    where: { id: { in: [...new Set(ids.filter(Boolean))] } },
    select: { id: true, firstName: true, lastName: true },
  });
  return new Map(rows.map((r) => [r.id, `${r.firstName}${r.lastName ? ` ${r.lastName}` : ""}`]));
}

async function main() {
  const apply = process.argv.includes("--apply");
  const mode = apply ? "APPLY" : "DRY-RUN";
  console.log(`\n=== Rød v Drammens BK Blå live-report remediation (${mode}) ===\n`);

  await runWithTenantOrganisationId(ORG_ID, async () => {
    // ── Pre-flight: state must be exactly what this remediation expects ──────
    const report = await db.postMatchReport.findFirst({
      where: { id: REPORT_ID, matchId: MATCH_ID, organisationId: ORG_ID },
      select: { status: true, homeGoals: true, awayGoals: true },
    });
    if (!report) throw new Error(`Report ${REPORT_ID} not found for match ${MATCH_ID}`);
    console.log(`Report: status=${report.status} score(home-away)=${report.homeGoals}-${report.awayGoals}`);
    if (report.homeGoals !== 3 || report.awayGoals !== 8) {
      throw new Error(`Unexpected scoreline ${report.homeGoals}-${report.awayGoals}; expected 3-8. Aborting.`);
    }

    const goals = await db.goal.findMany({
      where: { reportId: REPORT_ID, organisationId: ORG_ID },
      select: { id: true, playerId: true, minute: true },
      orderBy: { createdAt: "asc" },
    });
    if (goals.length !== 8) throw new Error(`Expected 8 Goal rows, found ${goals.length}. Aborting.`);
    const unexpectedGoalIds = goals.map((g) => g.id).filter((id) => !(id in GOAL_TO_LIVE_EVENT));
    if (unexpectedGoalIds.length > 0) {
      throw new Error(`Goal rows not in the mapping: ${unexpectedGoalIds.join(", ")}. Aborting.`);
    }
    if (goals.some((g) => g.minute !== null)) {
      console.log("NOTE: at least one Goal.minute is already set — this appears to be a re-run.");
    }

    const existingAssistCount = await db.assist.count({ where: { reportId: REPORT_ID, organisationId: ORG_ID } });
    const existingLiveRotationCount = await db.matchRotation.count({
      where: { matchId: MATCH_ID, source: "LIVE", organisationId: ORG_ID },
    });
    console.log(`Existing: ${existingAssistCount} Assist row(s), ${existingLiveRotationCount} LIVE MatchRotation row(s)\n`);

    // ── Period boundaries: first recorded PERIOD_START/END (pre-F5) ─────────
    const boundaryEvents = await db.liveMatchEvent.findMany({
      where: {
        matchId: MATCH_ID,
        organisationId: ORG_ID,
        eventType: { in: ["PERIOD_START", "PERIOD_END"] },
      },
      select: { eventType: true, period: true, wallClockTime: true },
      orderBy: { createdAt: "asc" },
    });
    const firstBy = (pred: (e: (typeof boundaryEvents)[number]) => boolean) => {
      const e = boundaryEvents.find(pred);
      if (!e?.wallClockTime) throw new Error("Missing a period-boundary event with a wall-clock time. Aborting.");
      return e.wallClockTime.getTime();
    };
    const kickoffMs = firstBy((e) => e.eventType === "PERIOD_START" && e.period === 1);
    const halfTimeMs = firstBy((e) => e.eventType === "PERIOD_END" && e.period === 2);
    const secondHalfMs = firstBy((e) => e.eventType === "PERIOD_START" && e.period === 3);
    const firstHalfOffsetMin = Math.round((halfTimeMs - kickoffMs) / 60_000);
    console.log(
      `Period boundaries (UTC): KO=${new Date(kickoffMs).toISOString()}  ` +
        `HT=${new Date(halfTimeMs).toISOString()}  2H=${new Date(secondHalfMs).toISOString()}`,
    );
    console.log(`First-half play length: ${firstHalfOffsetMin} min (offset added to 2H minutes)\n`);

    const deriveMinute = (wallMs: number): number => {
      if (wallMs <= halfTimeMs) return Math.max(1, Math.floor((wallMs - kickoffMs) / 60_000));
      return firstHalfOffsetMin + Math.max(0, Math.floor((wallMs - secondHalfMs) / 60_000));
    };

    // ── 1. Goal.minute backfill ────────────────────────────────────────────
    const mappedEventIds = Object.values(GOAL_TO_LIVE_EVENT).filter((v): v is string => v !== null);
    const goalForEvents = await db.liveMatchEvent.findMany({
      where: { id: { in: mappedEventIds }, matchId: MATCH_ID, organisationId: ORG_ID },
      select: { id: true, eventType: true, wallClockTime: true },
    });
    // Adjacent SCORER_SET for each mapped GOAL_FOR (next SCORER_SET in time).
    const allScorerSets = await db.liveMatchEvent.findMany({
      where: { matchId: MATCH_ID, organisationId: ORG_ID, eventType: "SCORER_SET" },
      select: { playerId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    const goalForRows = await db.liveMatchEvent.findMany({
      where: { id: { in: mappedEventIds }, organisationId: ORG_ID },
      select: { id: true, createdAt: true },
    });
    const scorerForEvent = new Map<string, string | null>();
    for (const gf of goalForRows) {
      const next = allScorerSets.find((s) => s.createdAt.getTime() >= gf.createdAt.getTime());
      scorerForEvent.set(gf.id, next?.playerId ?? null);
    }

    const goalMinutePlan: { goalId: string; playerId: string | null; minute: number | null; note: string }[] = [];
    for (const goal of goals) {
      const eventId = GOAL_TO_LIVE_EVENT[goal.id];
      if (!eventId) {
        goalMinutePlan.push({ goalId: goal.id, playerId: goal.playerId, minute: null, note: "no live event — minute stays NULL" });
        continue;
      }
      const ev = goalForEvents.find((e) => e.id === eventId);
      if (!ev?.wallClockTime) throw new Error(`GOAL_FOR event ${eventId} missing wallClockTime. Aborting.`);
      const scorer = scorerForEvent.get(eventId) ?? null;
      if (scorer !== goal.playerId) {
        throw new Error(
          `Scorer mismatch for Goal ${goal.id}: row playerId=${goal.playerId} but live SCORER_SET=${scorer}. Aborting.`,
        );
      }
      const wallMs = ev.wallClockTime.getTime();
      goalMinutePlan.push({
        goalId: goal.id,
        playerId: goal.playerId,
        minute: deriveMinute(wallMs),
        note: `${new Date(wallMs).toISOString()} -> ${wallMs <= halfTimeMs ? "1H" : "2H"}`,
      });
    }

    // ── 2. Assist reconstruction ──────────────────────────────────────────
    const liveAssistEvents = await db.liveMatchEvent.findMany({
      where: { id: { in: LIVE_ASSIST_EVENT_IDS }, matchId: MATCH_ID, organisationId: ORG_ID, eventType: "ASSIST_SET" },
      select: { id: true, playerId: true },
    });
    if (liveAssistEvents.length !== LIVE_ASSIST_EVENT_IDS.length) {
      throw new Error(`Expected ${LIVE_ASSIST_EVENT_IDS.length} live ASSIST_SET rows, found ${liveAssistEvents.length}. Aborting.`);
    }
    const assistPlan: { playerId: string; source: string }[] = [
      ...liveAssistEvents
        .filter((e): e is typeof e & { playerId: string } => !!e.playerId)
        .map((e) => ({ playerId: e.playerId, source: `live ASSIST_SET ${e.id}` })),
      ...COACH_ASSERTED_ASSIST_PLAYER_IDS.map((playerId) => ({
        playerId,
        source: "coach-asserted (8th goal, Benjamin LR, no live event)",
      })),
    ];

    // ── 3. Rotation reconstruction ────────────────────────────────────────
    const rotationEvents = await db.liveMatchEvent.findMany({
      where: {
        matchId: MATCH_ID,
        organisationId: ORG_ID,
        eventType: { in: ["ROTATION_OUT", "ROTATION_IN"] },
      },
      select: { id: true, eventType: true, period: true, matchSeconds: true, playerId: true, wallClockTime: true },
      orderBy: { wallClockTime: "asc" },
    });
    const outs = rotationEvents.filter((e) => e.eventType === "ROTATION_OUT");
    const ins = rotationEvents.filter((e) => e.eventType === "ROTATION_IN");
    const usedIn = new Set<string>();
    const rotationPlan: {
      outPlayerId: string;
      inPlayerId: string;
      period: number;
      matchSeconds: number | null;
      liveEventId: string;
      wallOut: string;
    }[] = [];
    for (const out of outs) {
      if (!out.playerId || out.period == null || !out.wallClockTime) continue;
      const match = ins
        .filter(
          (i) =>
            i.playerId &&
            !usedIn.has(i.id) &&
            i.period === out.period &&
            i.wallClockTime &&
            Math.abs(i.wallClockTime.getTime() - out.wallClockTime!.getTime()) <= 5_000,
        )
        .sort(
          (a, b) =>
            Math.abs(a.wallClockTime!.getTime() - out.wallClockTime!.getTime()) -
            Math.abs(b.wallClockTime!.getTime() - out.wallClockTime!.getTime()),
        )[0];
      if (!match?.playerId) {
        console.log(`  WARN: no ROTATION_IN paired with ROTATION_OUT ${out.id} (${out.playerId}) — skipped`);
        continue;
      }
      usedIn.add(match.id);
      rotationPlan.push({
        outPlayerId: out.playerId,
        inPlayerId: match.playerId,
        period: out.period,
        matchSeconds: out.matchSeconds ?? null,
        liveEventId: out.id,
        wallOut: out.wallClockTime.toISOString(),
      });
    }

    // ── Report ────────────────────────────────────────────────────────────
    const names = await resolveNames([
      ...goalMinutePlan.map((p) => p.playerId).filter((v): v is string => !!v),
      ...assistPlan.map((a) => a.playerId),
      ...rotationPlan.flatMap((r) => [r.outPlayerId, r.inPlayerId]),
    ]);
    const nm = (id: string | null) => (id ? (names.get(id) ?? id) : "(none)");

    console.log("── 1. Goal.minute backfill ──");
    for (const p of goalMinutePlan) {
      console.log(`  ${p.goalId}  ${nm(p.playerId).padEnd(14)}  minute=${p.minute ?? "NULL"}   ${p.note}`);
    }
    console.log(`\n── 2. Assist rows to create (${assistPlan.length}) ──`);
    if (existingAssistCount > 0) {
      console.log(`  SKIPPED — report already has ${existingAssistCount} assist row(s) (idempotency guard).`);
    } else {
      for (const a of assistPlan) console.log(`  ${nm(a.playerId).padEnd(14)}  <- ${a.source}`);
    }
    console.log(`\n── 3. MatchRotation rows to (re)create (${rotationPlan.length}) ──`);
    for (const r of rotationPlan) {
      console.log(
        `  P${r.period}  ${r.wallOut}  OUT ${nm(r.outPlayerId).padEnd(14)} IN ${nm(r.inPlayerId).padEnd(14)}  ms=${r.matchSeconds ?? "null"}  live=${r.liveEventId}`,
      );
    }
    if (rotationPlan.length !== 13) {
      console.log(`\n  WARN: expected 13 rotation pairs, derived ${rotationPlan.length}.`);
    }

    if (!apply) {
      console.log(`\n(DRY-RUN) No writes performed. Would then call replayPostMatchLearningHistory("${ORG_ID}", { matchId: "${MATCH_ID}" }).\n`);
      return;
    }

    // ── Writes ────────────────────────────────────────────────────────────
    console.log("\n── Applying ──");
    let minutesUpdated = 0;
    for (const p of goalMinutePlan) {
      if (p.minute == null) continue;
      await db.goal.update({ where: { id: p.goalId }, data: { minute: p.minute } });
      minutesUpdated++;
    }
    console.log(`  ${minutesUpdated} Goal.minute value(s) updated`);

    if (existingAssistCount === 0 && assistPlan.length > 0) {
      await db.assist.createMany({
        data: assistPlan.map((a) => ({ reportId: REPORT_ID, playerId: a.playerId, type: "NORMAL" as const, organisationId: ORG_ID })),
      });
      console.log(`  ${assistPlan.length} Assist row(s) created`);
    } else {
      console.log(`  Assist creation skipped (report already had ${existingAssistCount})`);
    }

    const del = await db.matchRotation.deleteMany({ where: { matchId: MATCH_ID, source: "LIVE", organisationId: ORG_ID } });
    if (del.count > 0) console.log(`  ${del.count} pre-existing LIVE MatchRotation row(s) deleted`);
    if (rotationPlan.length > 0) {
      await db.matchRotation.createMany({
        data: rotationPlan.map((r) => ({
          matchId: MATCH_ID,
          outPlayerId: r.outPlayerId,
          inPlayerId: r.inPlayerId,
          period: r.period,
          matchSeconds: r.matchSeconds,
          positionOnly: false,
          source: "LIVE" as const,
          liveEventId: r.liveEventId,
          organisationId: ORG_ID,
        })),
      });
      console.log(`  ${rotationPlan.length} MatchRotation row(s) created`);
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
