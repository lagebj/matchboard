/**
 * Documentation screenshot generator (ADR-0103, user-documentation-experience Phase 3).
 *
 * A dedicated Playwright capture runner, deliberately separate from e2e/*.spec.ts (does not run
 * through the @playwright/test test runner, so it never competes with Browser Acceptance Tests
 * semantics or retries). Captures real, current Matchboard UI against the Fjordvik FK
 * documentation dataset (scripts/seed-docs-dataset.ts) and writes content assets to
 * public/docs/screenshots/** -- these are documentation images (page.screenshot()), never
 * expect(page).toHaveScreenshot() visual-regression baselines (DECISIONS.md D12).
 *
 * Usage:
 *   MATCHBOARD_ENV=test npx tsx scripts/docs-screenshots.ts
 *   MATCHBOARD_ENV=test npx tsx scripts/docs-screenshots.ts --id today-overview
 *
 * Requires a running local Matchboard instance (default http://localhost:3333) seeded with
 * `npm run db:seed:docs`, and TEST_AGENT_AUTH_SECRET matching that instance's environment.
 * Refuses to run against any non-local base URL.
 *
 * The seed script and the running instance must point at the same database: export
 * DATABASE_URL="$TEST_DATABASE_URL" before both `npm run db:seed:docs` and starting the app
 * (`MATCHBOARD_ENV=test TEST_AGENT_AUTH_ENABLED=true npm run dev`). src/lib/db.ts's application
 * singleton reads DATABASE_URL only -- it does not fall back to TEST_DATABASE_URL -- so a mismatch
 * here seeds one database while the running app (and this script, via HTTP) reads another,
 * unseeded one.
 */

import "dotenv/config";
import { chromium, type Page } from "playwright";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";

const BASE_URL = process.env.DOCS_SCREENSHOT_BASE_URL ?? "http://localhost:3333";
const OUTPUT_ROOT = join(__dirname, "..", "public", "docs", "screenshots");
const DOCS_NAMESPACE = "test-agent.matchboard.football"; // matches src/auth.ts's default TEST_AGENT_AUTH_NAMESPACE

if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE_URL)) {
  console.error(`Refusing to run: DOCS_SCREENSHOT_BASE_URL "${BASE_URL}" is not local. This generator must never run against a deployed environment, including production.`);
  process.exit(1);
}

type ResolvedIds = {
  orgSlug: string;
  todayPath: string;
  playersPath: string;
  fixturesPath: string;
  upcomingRoundPath: string;
  readyMatchPath: string;
  storyMatchPath: string;
  postMatchPath: string;
  opponentPath: string;
  eventPath: string;
};

type Scenario = {
  id: string;
  output: string;
  viewport: "desktop" | "mobile";
  path: (ids: ResolvedIds) => string;
  prepare?: (page: Page) => Promise<void>;
};

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

const SCENARIOS: Scenario[] = [
  {
    id: "today-overview",
    output: "getting-started/today-overview.png",
    viewport: "desktop",
    path: (ids) => ids.todayPath,
  },
  {
    id: "players-season-overview",
    output: "players/players-season-overview.png",
    viewport: "desktop",
    path: (ids) => ids.playersPath,
  },
  {
    id: "fixtures-league-season",
    output: "fixtures/fixtures-league-season.png",
    viewport: "desktop",
    path: (ids) => ids.fixturesPath,
  },
  {
    id: "round-board-plan-integrity",
    output: "planning/round-board-plan-integrity.png",
    viewport: "desktop",
    path: (ids) => ids.upcomingRoundPath,
  },
  {
    id: "match-starting-plan",
    output: "planning/match-starting-plan.png",
    viewport: "desktop",
    path: (ids) => `${ids.readyMatchPath}?tab=tactics`,
  },
  {
    id: "generated-lineup",
    output: "planning/generated-lineup.png",
    viewport: "desktop",
    path: (ids) => `${ids.storyMatchPath}?tab=tactics`,
  },
  {
    id: "planned-rotations",
    output: "planning/planned-rotations.png",
    viewport: "desktop",
    path: (ids) => `${ids.storyMatchPath}?tab=rotations`,
  },
  {
    id: "post-match-report",
    output: "matchday/post-match-report.png",
    viewport: "desktop",
    path: (ids) => ids.postMatchPath,
  },
  {
    id: "opponent-evidence-history",
    output: "evidence/opponent-evidence-history.png",
    viewport: "desktop",
    path: (ids) => ids.opponentPath,
  },
  {
    id: "event-squads",
    output: "events/event-squads.png",
    viewport: "desktop",
    path: (ids) => ids.eventPath,
  },
  {
    id: "round-board-plan-integrity-mobile",
    output: "planning/round-board-plan-integrity-mobile.png",
    viewport: "mobile",
    path: (ids) => ids.upcomingRoundPath,
  },
];

async function resolveIds(): Promise<ResolvedIds> {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL, max: 1 });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter });

  const org = await db.organisation.findFirstOrThrow({ where: { slug: "fjordvik-fk" } });
  const upcomingRound = await db.matchRound.findFirstOrThrow({ where: { organisationId: org.id, status: "DRAFT" }, orderBy: { createdAt: "desc" } });
  const readyMatch = await db.match.findFirstOrThrow({
    where: { organisationId: org.id, matchRoundId: upcomingRound.id, selections: { some: { status: "FINALIZED" } } },
  });
  const storyMatch = await db.match.findFirstOrThrow({
    where: { organisationId: org.id, opponent: "Bergstad IF" },
    orderBy: { startsAt: "desc" },
  });
  const opponent = await db.opponentTeam.findFirstOrThrow({ where: { organisationId: org.id, displayName: "Bergstad IF" } });
  const event = await db.event.findFirstOrThrow({ where: { organisationId: org.id, name: "Fjord Cup" } });

  await db.$disconnect();

  return {
    orgSlug: org.slug,
    todayPath: `/o/${org.slug}/today`,
    playersPath: `/o/${org.slug}/players`,
    fixturesPath: `/o/${org.slug}/fixtures`,
    upcomingRoundPath: `/o/${org.slug}/rounds/${upcomingRound.id}`,
    readyMatchPath: `/o/${org.slug}/matches/${readyMatch.id}`,
    storyMatchPath: `/o/${org.slug}/matches/${storyMatch.id}`,
    postMatchPath: `/o/${org.slug}/matches/${storyMatch.id}/post-match`,
    opponentPath: `/o/${org.slug}/opponents/${opponent.id}`,
    eventPath: `/o/${org.slug}/events/${event.id}`,
  };
}

async function authenticate(page: Page): Promise<void> {
  const secret = process.env.TEST_AGENT_AUTH_SECRET;
  if (!secret) {
    throw new Error("TEST_AGENT_AUTH_SECRET is not set. This must match the target instance's TEST_AGENT_AUTH_SECRET.");
  }
  const csrfResponse = await page.request.get(`${BASE_URL}/api/auth/csrf`);
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };
  const callbackResponse = await page.request.post(`${BASE_URL}/api/auth/callback/test-agent`, {
    form: { email: `docs-coach@${DOCS_NAMESPACE}`, secret, csrfToken },
  });
  const sessionResponse = await page.request.get(`${BASE_URL}/api/auth/session`);
  const session = (await sessionResponse.json()) as { user?: { email?: string } } | null;
  if (!session?.user?.email) {
    console.error("callback status", callbackResponse.status(), await callbackResponse.text().catch(() => ""));
    throw new Error("Authentication did not produce a session. Check TEST_AGENT_AUTH_SECRET and TEST_AGENT_AUTH_ENABLED on the target instance.");
  }
}

async function captureScenario(page: Page, scenario: Scenario, ids: ResolvedIds): Promise<void> {
  const viewport = VIEWPORTS[scenario.viewport];
  await page.setViewportSize(viewport);
  await page.goto(`${BASE_URL}${scenario.path(ids)}`, { waitUntil: "networkidle" });

  // Semantic readiness: wait for the app shell's primary navigation, not a fixed sleep.
  await page.locator("nav[aria-label='Primary'], [role='navigation']").first().waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});

  // Suppress animation nondeterminism for stable captures.
  await page.addStyleTag({ content: "*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; }" });

  if (scenario.prepare) await scenario.prepare(page);

  const outputPath = join(OUTPUT_ROOT, scenario.output);
  mkdirSync(dirname(outputPath), { recursive: true });
  await page.screenshot({ path: outputPath });
  console.log(`Captured ${scenario.id} -> ${outputPath}`);
}

async function main() {
  const env = process.env.MATCHBOARD_ENV;
  if (env !== "test") {
    console.error(`Refusing to run: MATCHBOARD_ENV is "${env}", not "test".`);
    process.exit(1);
  }

  const idFilterIndex = process.argv.indexOf("--id");
  const idFilter = idFilterIndex >= 0 ? process.argv[idFilterIndex + 1] : undefined;
  const tagFilterIndex = process.argv.indexOf("--tag");
  void tagFilterIndex;

  const scenarios = idFilter ? SCENARIOS.filter((s) => s.id === idFilter) : SCENARIOS;
  if (scenarios.length === 0) {
    console.error(`No scenario matches --id ${idFilter}. Known IDs: ${SCENARIOS.map((s) => s.id).join(", ")}`);
    process.exit(1);
  }

  const ids = await resolveIds();

  const browser = await chromium.launch();
  // Fixed locale/timezone for stable captures (DECISIONS.md D16, PROGRAMME.md §11.1).
  const context = await browser.newContext({ locale: "en-US", timezoneId: "Europe/Oslo" });
  const page = await context.newPage();

  await authenticate(page);

  for (const scenario of scenarios) {
    try {
      await captureScenario(page, scenario, ids);
    } catch (err) {
      console.error(`Failed to capture ${scenario.id}:`, err instanceof Error ? err.message : err);
    }
  }

  await browser.close();
  console.log(`Done. ${scenarios.length} scenario(s) processed.`);
}

main().catch((err) => {
  console.error("Screenshot generation failed:", err);
  process.exit(1);
});
