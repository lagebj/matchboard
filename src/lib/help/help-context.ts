/**
 * Contextual Help registry (ADR-0103, user-documentation-experience Phase 5).
 *
 * One typed mapping from a stable application context to a documentation target. Routes/feature
 * shells resolve to a `HelpContextId` (see `resolveHelpContextId`); the Help drawer renders that
 * target's `docsPath` as a compact same-origin embed of the canonical public docs (PROGRAMME.md
 * §9.4) -- never a second copy of documentation prose.
 */

export type HelpContextId =
  | "today"
  | "players"
  | "fixtures"
  | "round-board"
  | "match-tactics"
  | "match-live"
  | "post-match"
  | "evidence"
  | "opponents"
  | "events"
  | "reports"
  | "settings";

export type HelpTarget = {
  docsPath: string;
  label: string;
};

export const HELP_TARGETS: Record<HelpContextId, HelpTarget> = {
  today: { docsPath: "/docs/today", label: "Today" },
  players: { docsPath: "/docs/players", label: "Players" },
  fixtures: { docsPath: "/docs/fixtures-and-rounds", label: "Fixtures and rounds" },
  "round-board": { docsPath: "/docs/squad-planning", label: "Squad planning" },
  "match-tactics": { docsPath: "/docs/squad-planning", label: "Squad planning" },
  "match-live": { docsPath: "/docs/matchday", label: "Matchday" },
  "post-match": { docsPath: "/docs/post-match", label: "Post-match" },
  evidence: { docsPath: "/docs/evidence-and-learning", label: "Evidence and learning" },
  opponents: { docsPath: "/docs/opponents", label: "Opponents" },
  events: { docsPath: "/docs/events", label: "Events" },
  reports: { docsPath: "/docs/reports", label: "Reports" },
  settings: { docsPath: "/docs/settings-and-access", label: "Settings and access" },
};

const DEFAULT_HELP_TARGET: HelpTarget = { docsPath: "/docs", label: "Documentation" };

/**
 * Resolves a Next.js pathname (e.g. `/o/fjordvik-fk/rounds/abc123`) to a HelpContextId.
 * Intentionally simple prefix matching -- one central place instead of string matching spread
 * across components (PROGRAMME.md §9.2). Falls back to the docs home when no context matches
 * rather than guessing.
 */
export function resolveHelpContextId(pathname: string): HelpContextId | null {
  const withoutOrg = pathname.replace(/^\/o\/[^/]+/, "");

  if (withoutOrg === "" || withoutOrg === "/" || withoutOrg.startsWith("/today")) return "today";
  if (withoutOrg.startsWith("/players")) return "players";
  if (withoutOrg.startsWith("/fixtures")) return "fixtures";
  if (withoutOrg.startsWith("/rounds")) return "round-board";
  if (/\/matches\/[^/]+\/live/.test(withoutOrg)) return "match-live";
  if (/\/matches\/[^/]+\/post-match/.test(withoutOrg)) return "post-match";
  if (withoutOrg.startsWith("/matches")) return "match-tactics";
  if (withoutOrg.startsWith("/opponents")) return "opponents";
  if (withoutOrg.startsWith("/events")) return "events";
  if (withoutOrg.startsWith("/insights") || withoutOrg.startsWith("/history")) return "evidence";
  if (withoutOrg.startsWith("/season") || withoutOrg.startsWith("/reviews")) return "reports";
  if (withoutOrg.startsWith("/settings") || withoutOrg.startsWith("/organisations")) return "settings";

  return null;
}

export function getHelpTarget(contextId: HelpContextId | null): HelpTarget {
  if (!contextId) return DEFAULT_HELP_TARGET;
  return HELP_TARGETS[contextId] ?? DEFAULT_HELP_TARGET;
}
