/**
 * Development-context-and-evidence integrity verification (ADR-0155 step B4, source bundle
 * §08's "Verify command"). Read-only -- never mutates anything; exits non-zero when any check
 * finds a violation, so it can gate a deploy/backfill step.
 *
 * Checks (per the bundle's own minimum list):
 *   - duplicate current metric identity (player/scope/metric/version/inputRevision);
 *   - invalid zone ids;
 *   - negative exposure/value for metrics that can never be negative;
 *   - required source refs missing;
 *   - a trend with fewer than 6 eligible source matches;
 *   - revision format sanity ("where practical" -- a full recompute-and-compare is what the
 *     recompute command itself already does on every run; this is a cheap structural check,
 *     not a byte-for-byte re-derivation).
 *
 * Usage:
 *   npx tsx scripts/verify-development-context.ts
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { runWithSystemPrivilege } from "@/lib/tenancy/tenant-async-storage";

const SYSTEM_PRIVILEGE_REASON = "development-context-verify-cross-tenant-scan";

const ZONE_ID_PATTERN = /^D[1-6]_L[1-5]$/;
const NEVER_NEGATIVE_METRICS = new Set(["role_seconds", "event_count", "teammate_copresence_seconds", "game_state_role_seconds"]);
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

type Violation = { check: string; detail: string };

async function checkDuplicateCurrentIdentity(): Promise<Violation[]> {
  const rows = await db.derivedMeasurement.findMany({
    select: { playerId: true, scopeType: true, scopeKey: true, metricKey: true, metricVersion: true, inputRevision: true, id: true },
  });
  const seen = new Map<string, string>();
  const violations: Violation[] = [];
  for (const row of rows) {
    const key = [row.playerId, row.scopeType, row.scopeKey, row.metricKey, row.metricVersion, row.inputRevision].join("\u0000");
    const existingId = seen.get(key);
    if (existingId) {
      violations.push({ check: "duplicate-current-identity", detail: `rows ${existingId} and ${row.id} share identity ${key}` });
    } else {
      seen.set(key, row.id);
    }
  }
  return violations;
}

async function checkInvalidZoneIds(): Promise<Violation[]> {
  const rows = await db.derivedMeasurement.findMany({
    where: { metricKey: { in: ["zone_event_count", "zone_event_share"] } },
    select: { id: true, dimensions: true },
  });
  const violations: Violation[] = [];
  for (const row of rows) {
    const zoneId = (row.dimensions as Record<string, unknown>).zoneId;
    if (zoneId != null && (typeof zoneId !== "string" || !ZONE_ID_PATTERN.test(zoneId))) {
      violations.push({ check: "invalid-zone-id", detail: `row ${row.id} has zoneId ${JSON.stringify(zoneId)}` });
    }
  }
  return violations;
}

async function checkNegativeValues(): Promise<Violation[]> {
  const rows = await db.derivedMeasurement.findMany({
    where: { metricKey: { in: [...NEVER_NEGATIVE_METRICS] } },
    select: { id: true, metricKey: true, value: true, exposureSeconds: true },
  });
  const violations: Violation[] = [];
  for (const row of rows) {
    if (row.value < 0) violations.push({ check: "negative-value", detail: `row ${row.id} (${row.metricKey}) has value ${row.value}` });
    if (row.exposureSeconds != null && row.exposureSeconds < 0) {
      violations.push({ check: "negative-exposure", detail: `row ${row.id} (${row.metricKey}) has exposureSeconds ${row.exposureSeconds}` });
    }
  }
  return violations;
}

async function checkMissingSourceRefs(): Promise<Violation[]> {
  const rows = await db.derivedMeasurement.findMany({ select: { id: true, metricKey: true, sourceRefs: true } });
  const violations: Violation[] = [];
  for (const row of rows) {
    const refs = row.sourceRefs as unknown[];
    if (!Array.isArray(refs) || refs.length === 0) {
      violations.push({ check: "missing-source-refs", detail: `row ${row.id} (${row.metricKey}) has no sourceRefs` });
    }
  }
  return violations;
}

async function checkTrendWindowSize(): Promise<Violation[]> {
  const rows = await db.derivedTrend.findMany({
    select: { id: true, metricKey: true, previousWindowMatchIds: true, latestWindowMatchIds: true },
  });
  const violations: Violation[] = [];
  for (const row of rows) {
    const previous = row.previousWindowMatchIds as unknown[];
    const latest = row.latestWindowMatchIds as unknown[];
    if (!Array.isArray(previous) || !Array.isArray(latest) || previous.length !== 3 || latest.length !== 3) {
      violations.push({
        check: "trend-insufficient-eligible-matches",
        detail: `trend ${row.id} (${row.metricKey}) has ${Array.isArray(previous) ? previous.length : "?"}/${Array.isArray(latest) ? latest.length : "?"} previous/latest matches, expected 3/3 (six eligible matches total)`,
      });
    }
  }
  return violations;
}

async function checkRevisionFormat(): Promise<Violation[]> {
  const [measurements, trends] = await Promise.all([
    db.derivedMeasurement.findMany({ select: { id: true, inputRevision: true } }),
    db.derivedTrend.findMany({ select: { id: true, inputRevision: true } }),
  ]);
  const violations: Violation[] = [];
  for (const row of [...measurements, ...trends]) {
    if (!SHA256_HEX_PATTERN.test(row.inputRevision)) {
      violations.push({ check: "revision-format", detail: `row ${row.id} has a malformed inputRevision` });
    }
  }
  return violations;
}

async function main() {
  const checks = [
    checkDuplicateCurrentIdentity,
    checkInvalidZoneIds,
    checkNegativeValues,
    checkMissingSourceRefs,
    checkTrendWindowSize,
    checkRevisionFormat,
  ];

  const results = await runWithSystemPrivilege(SYSTEM_PRIVILEGE_REASON, () => Promise.all(checks.map((check) => check())));
  const violations = results.flat();

  if (violations.length === 0) {
    console.log("Development-context verification PASSED — no violations found.");
    return;
  }

  console.error(`Development-context verification FAILED — ${violations.length} violation(s):\n`);
  for (const violation of violations) {
    console.error(`  [${violation.check}] ${violation.detail}`);
  }
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
