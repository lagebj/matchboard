import type { TabItem } from "@/components/ui/tab-rail";

/**
 * Match Details + Post-Match Report lifecycle-aware tab definitions
 * (`.matchboard-work/matchboard_match_details_exact_goldens_2026-09-18/`, corrected exact-golden
 * edition — supersedes every earlier generated Match Details lifecycle-convergence bundle).
 *
 * One module owns every tab array/default/legacy-alias so tab validity, rendering and URL
 * resolution cannot drift apart (`08_COMPONENT_AND_ROUTE_ARCHITECTURE.md`: "Create one
 * lifecycle-aware tab-definition module. Do not scatter hard-coded tab arrays across route
 * components."). Pure, DB-free, unit-tested.
 */

// ---------------------------------------------------------------------------
// Match Details (root canonical route)
// ---------------------------------------------------------------------------

/** The two Match Details compositions (`02_PRODUCT_MODEL_AND_LIFECYCLE.md`). LIVE keeps the
 * BEFORE tab set/IA unchanged — only the primary action swaps — so it is not a third state here;
 * see `deriveMatchDetailSurfaceState()` in `match-detail-view-model.ts`. */
export type MatchDetailSurfaceState = "BEFORE" | "AFTER";

export type MatchDetailTabKey =
  | "overview"
  | "tactics"
  | "rotations"
  | "opponent-context"
  | "notes"
  | "events"
  | "stats"
  | "after-match"
  | "history";

/**
 * Post-launch correction (2026-09-18): "Lineup" and "Tactics" are no longer separate before-match
 * tabs — a coach reported the Overview "Planned lineup" region as effectively showing no lineup
 * (a formation-name/filled-count summary, not the real pitch), and asked for the real pitch editor
 * and the (by then thin — coaching intent + match format only) Tactics content to live directly
 * on Overview instead of two more tab clicks away. Overview now fully absorbs both — there is no
 * remaining reason for either as a separate before-match tab.
 */
const BEFORE_MATCH_TABS: TabItem<MatchDetailTabKey>[] = [
  { key: "overview", label: "Overview" },
  { key: "rotations", label: "Rotations" },
  { key: "opponent-context", label: "Opponent context" },
  { key: "notes", label: "Notes" },
];

const AFTER_MATCH_TABS: TabItem<MatchDetailTabKey>[] = [
  { key: "overview", label: "Overview" },
  { key: "events", label: "Events" },
  { key: "stats", label: "Stats" },
  { key: "tactics", label: "Tactics" },
  { key: "after-match", label: "After match" },
  { key: "opponent-context", label: "Opponent context" },
  { key: "history", label: "History" },
];

const BEFORE_MATCH_DEFAULT_TAB: MatchDetailTabKey = "overview";
const AFTER_MATCH_DEFAULT_TAB: MatchDetailTabKey = "overview";

/** Legacy `?tab=` aliases from the pre-existing (superseded) `Squad | Tactics | Rotations |
 * After match | Opponent context | Review` tab set (`03_MATCH_DETAILS_BEFORE_MATCH_SPEC.md`
 * "Map old Match Details tab URLs where practical"), so an existing bookmark/link degrades
 * gracefully instead of silently opening the wrong content. `review` has no inline tab in either
 * surface — it is preserved only as the dedicated `/review` route entry point. */
const LEGACY_TAB_ALIASES: Partial<Record<string, MatchDetailTabKey>> = {
  squad: "overview",
  opponent: "opponent-context",
  // "lineup" (before-match) folded into Overview 2026-09-18 — see BEFORE_MATCH_TABS' own comment.
  // Left unmapped here deliberately: "tactics" still resolves naturally to Overview via the
  // "no match in this surface's tab set" fallback below, without an explicit alias, because
  // "tactics" remains a real, different tab for the AFTER surface and an alias would incorrectly
  // force it to Overview there too.
  lineup: "overview",
};

export function getMatchDetailTabs(surfaceState: MatchDetailSurfaceState): TabItem<MatchDetailTabKey>[] {
  return surfaceState === "BEFORE" ? BEFORE_MATCH_TABS : AFTER_MATCH_TABS;
}

export function getMatchDetailDefaultTab(surfaceState: MatchDetailSurfaceState): MatchDetailTabKey {
  return surfaceState === "BEFORE" ? BEFORE_MATCH_DEFAULT_TAB : AFTER_MATCH_DEFAULT_TAB;
}

/** Resolves an untrusted `?tab=` value against the surface's real tab set — falls back to that
 * surface's default rather than rendering empty content (`03` spec: "Invalid values fall back to
 * `overview`."), and maps the old tab vocabulary's still-meaningful values across. A tab that is
 * only valid in the *other* surface state (e.g. `notes` while AFTER, `history` while BEFORE) also
 * falls back to the default — changing lifecycle state can make an old tab invalid. */
export function resolveMatchDetailTab(
  surfaceState: MatchDetailSurfaceState,
  requestedTab: string | null | undefined,
): MatchDetailTabKey {
  const tabs = getMatchDetailTabs(surfaceState);
  const alias = requestedTab ? LEGACY_TAB_ALIASES[requestedTab] : undefined;
  const candidate = alias ?? requestedTab;
  const match = tabs.find((t) => t.key === candidate);
  return match ? match.key : getMatchDetailDefaultTab(surfaceState);
}

// ---------------------------------------------------------------------------
// Post-Match Report (`/post-match`)
// ---------------------------------------------------------------------------

/** Surface B's own two states (`02_PRODUCT_MODEL_AND_LIFECYCLE.md`) — distinct from Match
 * Details' BEFORE/AFTER and from the richer `MatchReportStatus` enum (`DRAFT | REPORTED |
 * LOCKED`): REPORTED is folded into DRAFT here (still editable, not yet the final locked
 * record), matching ADR-0003's "one visible completion action" — there is no routine
 * intermediate report state a coach is meant to see as different from "still working on it". */
export type PostMatchReportSurfaceState = "DRAFT" | "COMPLETED";

export type PostMatchTabKey = "summary" | "timeline" | "players" | "reflection" | "review" | "combinations";

const POST_MATCH_DRAFT_TABS: TabItem<PostMatchTabKey>[] = [
  { key: "summary", label: "Summary" },
  { key: "timeline", label: "Timeline" },
  { key: "players", label: "Players" },
  { key: "reflection", label: "Reflection" },
  { key: "review", label: "Review" },
];

const POST_MATCH_COMPLETED_TABS: TabItem<PostMatchTabKey>[] = [
  { key: "summary", label: "Summary" },
  { key: "timeline", label: "Timeline" },
  { key: "players", label: "Players" },
  { key: "reflection", label: "Reflection" },
  { key: "combinations", label: "Combinations" },
];

export function getPostMatchReportTabs(surfaceState: PostMatchReportSurfaceState): TabItem<PostMatchTabKey>[] {
  return surfaceState === "DRAFT" ? POST_MATCH_DRAFT_TABS : POST_MATCH_COMPLETED_TABS;
}

/**
 * DRAFT defaults to `players` — not `summary` — even though Summary is listed/rendered first in
 * the tab rail. ADR-0003 ("Post-match reporting is a direct workflow") is a real, e2e-tested
 * behavioural contract: finishing live reporting must land the coach on the actual editable
 * report workspace with its completion action immediately reachable, with no extra required
 * click (`e2e/post-match-evidence-parity.spec.ts` clicks "Complete report" immediately after
 * landing on `/post-match`, with zero intermediate navigation). The written exact-goldens spec
 * only fixes the tab *order*, not which tab is selected by default, so this does not conflict
 * with it — see ADR-0147. COMPLETED has no equivalent completion-action urgency, so it defaults
 * to `summary`, matching the golden's own illustrated active tab.
 */
export function getPostMatchReportDefaultTab(surfaceState: PostMatchReportSurfaceState): PostMatchTabKey {
  return surfaceState === "DRAFT" ? "players" : "summary";
}

export function resolvePostMatchReportTab(
  surfaceState: PostMatchReportSurfaceState,
  requestedTab: string | null | undefined,
): PostMatchTabKey {
  const tabs = getPostMatchReportTabs(surfaceState);
  const match = tabs.find((t) => t.key === requestedTab);
  return match ? match.key : getPostMatchReportDefaultTab(surfaceState);
}

/** `reportStatus` is the raw `MatchReportStatus` (or `undefined`/`"NOT_STARTED"` when no report
 * row exists yet) — `REPORTED` intentionally maps to `DRAFT` here, matching ADR-0003 (see the
 * `PostMatchReportSurfaceState` doc comment). */
export function derivePostMatchReportSurfaceState(
  reportStatus: string | null | undefined,
): PostMatchReportSurfaceState {
  return reportStatus === "LOCKED" ? "COMPLETED" : "DRAFT";
}
