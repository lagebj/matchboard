#!/usr/bin/env node

/**
 * Gate A golden-authority consistency check (read-only, default-safe — never writes a file).
 *
 * Originally ported from the Gate A W5 handoff bundle's `scripts/audit_gate_a.py`
 * (`.matchboard-work/Matchboard_Gate_A_W5_Golden_Consistency_Implementation_Bundle_2026-10-12/`),
 * fixing a false-positive bug where the Python original validated `approval.revisionSha` (a
 * 40-hex git commit SHA) against a 64-hex SHA-256 pattern. Rewritten again for the W5 independent
 * technical review (finding W5-R1, see `docs/ui-lab/gate-a-w5-convergence/CHANGED_FILES.md`):
 * completion is now a positive requirement over an explicit expected-scenario registry
 * (`scripts/lib/gate-a-authority.mjs`'s `EXPECTED_SCENARIOS`), not merely "zero CANDIDATE entries
 * and zero errors" — the prior formula could report completion with every candidate REJECTed, a
 * scenario silently missing from a manifest, or an approved capture absent from its own
 * attestation (previously only a WARNING, now an ERROR).
 *
 * This is metadata-only: it never fetches raw PNG bytes and never approves a golden. It does not
 * replace the normative programme contracts, an owner's explicit visual review, or a separate
 * byte-level CI-artifact re-verification (see VISUAL_COVERAGE_AND_CAPTURE.md for that). See the
 * `scopeDisclaimer` field in this script's own JSON output for the explicit, non-exhaustive list
 * of what a clean result does and does not establish.
 *
 * Usage:
 *   node scripts/audit-gate-a-golden-authority.mjs [repoRoot]
 *
 * Exit codes:
 *   0 — no ERROR-severity issues found (WARNING issues may still be present; golden authority may
 *       still be incomplete — check the `goldenAuthorityComplete` field, not just the exit code)
 *   1 — at least one ERROR-severity issue found
 */

import { auditGateA } from "./lib/gate-a-authority.mjs";

const repoRoot = process.argv[2] ? String(process.argv[2]) : new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const result = auditGateA(repoRoot);
console.log(JSON.stringify(result, null, 2));
process.exit(result.issues.some((i) => i.severity === "ERROR") ? 1 : 0);
