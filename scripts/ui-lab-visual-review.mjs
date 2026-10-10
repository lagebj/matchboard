import { chromium } from "playwright";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

// Fixture-only visual evidence, not an approved golden. Never access production.
const base = new URL(process.env.UI_LAB_BASE_URL ?? "http://127.0.0.1:3333");
if (!["127.0.0.1", "localhost"].includes(base.hostname)) throw new Error("Local UI Lab only");
const output = path.resolve("test-results/ui-lab-review");

function resolveCommitSha() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}
/**
 * A04's `source-open`-family interactions (Gate A W2): clicks the NAMED "Inspect..." control on
 * the page (independent review round 1, PR #778, finding R3 — several A04 scenes now have more
 * than one scoped inspect trigger, so "click the first match" is no longer correct; each
 * interaction targets its own exact accessible name) and waits for the resulting context-local
 * dialog (inline inspector or bottom sheet) to settle — same settle-detection approach as A01's
 * `lineup-open` (a bottom sheet is DOM-"visible" mid-transform the instant it mounts, so wait on
 * its real rendered position, not just `state: "visible"`; the inline inspector has nothing to
 * settle).
 *
 * Independent review round 2 (finding R4): scenarios with more than one scoped inspector (S1, S4,
 * S6) now enforce exactly one active claim in a single `SourceInspector` (`useActiveSourceClaim`),
 * so a SECOND `source-open`-family interaction in the same page/context should click its trigger
 * DIRECTLY, without closing the first — on desktop (`aria-modal="false"`) this is the real
 * switch-without-closing behavior the review asked to demonstrate, not a workaround. Only a
 * genuinely MODAL dialog (the mobile bottom sheet, `aria-modal="true"`) still needs an explicit
 * close first, since its full-screen backdrop would otherwise intercept the next click — that
 * mirrors real mobile modal behavior, it isn't masking a bug.
 */
function openSourceInspectorByName(name) {
  return async function perform(page) {
    const openDialogs = page.getByRole("dialog");
    if ((await openDialogs.count()) > 0) {
      const isModal = await openDialogs.first().getAttribute("aria-modal");
      if (isModal === "true") {
        await page.keyboard.press("Escape");
        await openDialogs.first().waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
      }
    }
    await page.getByRole("button", { name, exact: true }).click();
    await page.getByRole("dialog").first().waitFor({ state: "visible", timeout: 10000 });
    const isSheet = await page.evaluate(() => document.querySelector('[role="dialog"]')?.getAttribute("aria-modal") === "true");
    if (isSheet) {
      await page.waitForFunction(() => {
        const dialog = document.querySelector('[role="dialog"]');
        if (!dialog) return false;
        const rect = dialog.getBoundingClientRect();
        return rect.height > 0 && rect.bottom <= window.innerHeight + 2;
      }, { timeout: 10000 });
      await page.waitForTimeout(100);
    }
  };
}

// A04 smoke widths near the 600px inspector threshold (independent review round 1, PR #778,
// "verification gaps"). Named `a04-*` (not `tablet-*`) to stay unambiguous from A01's own
// tablet-width extras above.
const a04ExtraSmokeViewports = [
  { name: "a04-360", width: 360, height: 800 },
  { name: "a04-430", width: 430, height: 900 },
];

// Gate A W3 (A03/A07/A09) smoke widths, same 360/430px rationale as A04's — named `a0x-*` to stay
// unambiguous from both A01's `tablet-*` and A04's `a04-*` extras.
const w3ExtraSmokeViewports = [
  { name: "a0x-360", width: 360, height: 800 },
  { name: "a0x-430", width: 430, height: 900 },
];

/**
 * Gate A W3 interaction helpers (`04_TESTS_AND_CAPTURE_MATRIX.md`: "no random timers/network; use
 * a deterministic fixture-step controller/test gate"). A07/A09's shared editor renders its own
 * outer page-level trigger ("Edit lineup" / the scenario's `actionLabel`) AND, once open, an
 * in-dialog confirm button that reuses the SAME accessible name (A09's `actionLabel` is shared by
 * both the outer trigger and the in-dialog confirm control) — `clickWithinDialog` scopes to the
 * open dialog specifically so the two never collide; `clickByName` is for the unambiguous
 * page-level trigger (clicked before any dialog exists) and for controls with their own distinct
 * name (A07's "Confirm assignment", both families' "Continue fixture simulation →", "Close").
 */
function clickByName(name) {
  return async function perform(page) {
    await page.getByRole("button", { name, exact: true }).click();
  };
}
function clickWithinDialog(name) {
  return async function perform(page) {
    await page.getByRole("dialog").first().getByRole("button", { name, exact: true }).click();
  };
}
function clickTestId(testId) {
  return async function perform(page) {
    await page.getByTestId(testId).click();
  };
}

// `slug` names the output file; `route` is the dev UI Lab path under /dev/ui-lab/.
// `interactions` (PR #777 remediation, A01/A12 finding): optional extra captures of the SAME
// page, in the SAME browser context (no reload), after performing a deterministic interaction —
// proves initial render AND the reviewable interaction state, and that the action never navigates.
const scenarios = [
  { slug: "match-preparation", route: "atlas-followup/match-preparation" },
  { slug: "completed-match", route: "atlas-followup/completed-match" },
  { slug: "player-detail", route: "atlas-followup/player-detail" },
  { slug: "position-map", route: "atlas-followup/position-map" },
  // Gate A W1 candidates (programme_v054 `20_UI_LAB_CANDIDATE_WAVES.md`) — CANDIDATE, not approved.
  {
    slug: "gate-a-a01-sports-first",
    route: "gate-a/a01-sports-first",
    // Owner/independent review follow-up: verify the 600-840px range where the contextual
    // inspector turns on (useMediaQuery's 600px threshold) but the row layout hasn't yet engaged
    // (Touchline's wider `expanded`, 840px, breakpoint) — the exact range a fixed-width two-column
    // layout would have squeezed, before the row/stacked decoupling fix.
    extraViewports: [
      { name: "tablet-600", width: 600, height: 900 },
      { name: "tablet-768", width: 768, height: 1024 },
      { name: "tablet-900", width: 900, height: 1024 },
    ],
    interactions: [
      {
        id: "lineup-open",
        perform: async (page) => {
          await page.getByText("Lineup", { exact: true }).click();
          await page.getByTestId("lineup-preview-list").waitFor({ state: "visible", timeout: 10000 });
          // Two different presentations open here depending on viewport (A01 final correction):
          // the mobile TouchlineBottomSheet (aria-modal="true", fixed overlay, slides in via a
          // CSS-transform/requestAnimationFrame state flip) or the desktop LineupContextualInspector
          // (aria-modal="false", plain inline flow, no animation at all). Only the sheet needs a
          // settle wait — it's already DOM-"visible" mid-transform, off-screen, the instant it
          // mounts (CSS transforms don't affect visibility). The inspector has nothing to settle,
          // and on a stacked (600-840px) layout its natural position legitimately extends below the
          // viewport fold — waiting for it to be "flush with the viewport bottom" would hang
          // forever, which is exactly what happened here before this fix.
          const isSheet = await page.evaluate(() => document.querySelector('[role="dialog"]')?.getAttribute("aria-modal") === "true");
          if (isSheet) {
            // A `getComputedStyle().transform` read was tried here first and proved unreliable (it
            // can report the settled value a moment before the dialog's actual rendered position/
            // boundingClientRect catches up) — wait on the real rendered position instead: once
            // settled, the sheet's bottom edge sits flush with the viewport bottom; mid-transition
            // (or pre-transition) it extends below it.
            await page.waitForFunction(() => {
              const dialog = document.querySelector('[role="dialog"]');
              if (!dialog) return false;
              const rect = dialog.getBoundingClientRect();
              return rect.height > 0 && rect.bottom <= window.innerHeight + 2;
            }, { timeout: 10000 });
            await page.waitForTimeout(100); // settle grace period
          }
        },
      },
    ],
  },
  { slug: "gate-a-a02-match-lifecycle", route: "gate-a/a02-match-lifecycle" },
  // Gate A W2 candidate (programme_v054 `20_UI_LAB_CANDIDATE_WAVES.md` W2, A04) — CANDIDATE, not
  // approved. `interactionViewports` is a bounded script extension (A04 test/capture matrix: "at
  // minimum source-open ... at 1440 and 390") — when set, interactions only run at those viewport
  // names, not every viewport in `viewports`; omitting it (every W1 scenario above) keeps the
  // original all-viewports behavior unchanged. `a04ExtraSmokeViewports` adds the 360/430px smoke
  // widths independent review round 1 (PR #778) asked for near the 600px inspector threshold.
  {
    slug: "gate-a-a04-partial-minutes",
    route: "gate-a/a04-evidence-grammar/partial-minutes",
    extraViewports: a04ExtraSmokeViewports,
    interactionViewports: ["desktop", "mobile"],
    interactions: [
      { id: "source-open", perform: openSourceInspectorByName("Inspect sources") },
      { id: "source-open-minutes", perform: openSourceInspectorByName("Inspect minutes source") },
    ],
  },
  {
    slug: "gate-a-a04-role-exposure-sparse",
    route: "gate-a/a04-evidence-grammar/role-exposure-sparse",
    extraViewports: a04ExtraSmokeViewports,
  },
  {
    slug: "gate-a-a04-role-exposure-supported",
    route: "gate-a/a04-evidence-grammar/role-exposure-supported",
    extraViewports: a04ExtraSmokeViewports,
    interactionViewports: ["desktop", "mobile"],
    interactions: [{ id: "source-open", perform: openSourceInspectorByName("Inspect sources") }],
  },
  {
    slug: "gate-a-a04-sparse-score-events",
    route: "gate-a/a04-evidence-grammar/sparse-score-events",
    extraViewports: a04ExtraSmokeViewports,
    interactionViewports: ["desktop", "mobile"],
    interactions: [
      { id: "source-open-result", perform: openSourceInspectorByName("Inspect result source") },
      { id: "source-open-event", perform: openSourceInspectorByName("Inspect event source") },
    ],
  },
  {
    slug: "gate-a-a04-central-profile-projection",
    route: "gate-a/a04-evidence-grammar/central-profile-projection",
    extraViewports: a04ExtraSmokeViewports,
    interactionViewports: ["desktop", "mobile"],
    interactions: [{ id: "source-open", perform: openSourceInspectorByName("Inspect sources") }],
  },
  {
    slug: "gate-a-a04-declared-only-versus-evidenced",
    route: "gate-a/a04-evidence-grammar/declared-only-versus-evidenced",
    extraViewports: a04ExtraSmokeViewports,
    interactionViewports: ["desktop", "mobile"],
    interactions: [
      { id: "source-open", perform: openSourceInspectorByName("Inspect case A declaration source") },
      { id: "source-open-case-b", perform: openSourceInspectorByName("Inspect case B evidence sources") },
    ],
  },
  { slug: "gate-a-a06-position-pitches", route: "gate-a/a06-position-pitches" },
  {
    slug: "gate-a-a12-profile-editor",
    route: "gate-a/a12-profile-editor",
    interactions: [
      {
        id: "editor-expanded",
        perform: async (page) => {
          await page.getByRole("button", { name: "Edit" }).click();
          await page.getByRole("combobox").first().waitFor({ state: "visible", timeout: 10000 });
        },
      },
    ],
  },
  // Gate A W3 candidates (programme_v054 `20_UI_LAB_CANDIDATE_WAVES.md` W3) — A03/A07/A09,
  // CANDIDATE, not approved. `w3ExtraSmokeViewports` mirrors A04's 360/430px smoke widths.
  {
    slug: "gate-a-w3-a03-open-decision",
    route: "gate-a/a03-decision-anatomy/open-decision",
    extraViewports: w3ExtraSmokeViewports,
    interactions: [{ id: "why-open", perform: clickByName("Why?") }],
  },
  {
    slug: "gate-a-w3-a03-closed-plan-review",
    route: "gate-a/a03-decision-anatomy/closed-plan-review",
    extraViewports: w3ExtraSmokeViewports,
    interactions: [{ id: "review-open", perform: clickByName("Review plan") }],
  },
  {
    slug: "gate-a-w3-a03-permission-denied",
    route: "gate-a/a03-decision-anatomy/permission-denied",
    extraViewports: w3ExtraSmokeViewports,
  },
  {
    slug: "gate-a-w3-a03-integrity-signal",
    route: "gate-a/a03-decision-anatomy/integrity-signal",
    extraViewports: w3ExtraSmokeViewports,
    interactions: [{ id: "why-open", perform: clickByName("Why?") }],
  },
  {
    slug: "gate-a-w3-a07-assign-reserve-success",
    route: "gate-a/a07-match-details-edit-lineup/assign-reserve-success",
    extraViewports: w3ExtraSmokeViewports,
    interactionViewports: ["desktop", "mobile"],
    interactions: [
      { id: "editor-open", perform: clickByName("Edit lineup") },
      { id: "draft-preview", perform: clickTestId("lineup-candidate-row") },
      { id: "pending", perform: clickWithinDialog("Confirm assignment") },
      { id: "saved", perform: clickWithinDialog("Continue fixture simulation →") },
    ],
  },
  {
    slug: "gate-a-w3-a07-assign-reserve-denied",
    route: "gate-a/a07-match-details-edit-lineup/assign-reserve-denied",
    extraViewports: w3ExtraSmokeViewports,
    interactionViewports: ["desktop", "mobile"],
    interactions: [
      { id: "editor-open", perform: clickByName("Edit lineup") },
      { id: "draft-preview", perform: clickTestId("lineup-candidate-row") },
      { id: "pending", perform: clickWithinDialog("Confirm assignment") },
      { id: "denied", perform: clickWithinDialog("Continue fixture simulation →") },
    ],
  },
  {
    slug: "gate-a-w3-a07-server-conflict",
    route: "gate-a/a07-match-details-edit-lineup/server-conflict",
    extraViewports: w3ExtraSmokeViewports,
    interactionViewports: ["desktop", "mobile"],
    interactions: [
      { id: "editor-open", perform: clickByName("Edit lineup") },
      { id: "draft-preview", perform: clickTestId("lineup-candidate-row") },
      { id: "pending", perform: clickWithinDialog("Confirm assignment") },
      { id: "conflict", perform: clickWithinDialog("Continue fixture simulation →") },
    ],
  },
  {
    slug: "gate-a-w3-a07-planning-closed-after-opening",
    route: "gate-a/a07-match-details-edit-lineup/planning-closed-after-opening",
    extraViewports: w3ExtraSmokeViewports,
    interactionViewports: ["desktop", "mobile"],
    interactions: [
      { id: "editor-open", perform: clickByName("Edit lineup") },
      { id: "draft-preview", perform: clickTestId("lineup-candidate-row") },
      { id: "pending", perform: clickWithinDialog("Confirm assignment") },
      { id: "planning-closed", perform: clickWithinDialog("Continue fixture simulation →") },
    ],
  },
  {
    slug: "gate-a-w3-a07-dirty-draft-close",
    route: "gate-a/a07-match-details-edit-lineup/dirty-draft-close",
    extraViewports: w3ExtraSmokeViewports,
    interactionViewports: ["desktop", "mobile"],
    interactions: [
      { id: "editor-open", perform: clickByName("Edit lineup") },
      { id: "draft-preview", perform: clickTestId("lineup-candidate-row") },
      { id: "discard-prompt", perform: clickWithinDialog("Close") },
      { id: "discarded-and-closed", perform: clickTestId("confirm-discard-and-close") },
    ],
  },
  {
    slug: "gate-a-w3-a09-add-eligible-player-success",
    route: "gate-a/a09-today-quick-action/add-eligible-player-success",
    extraViewports: w3ExtraSmokeViewports,
    interactionViewports: ["desktop", "mobile"],
    interactions: [
      { id: "sheet-open", perform: clickByName("Add player") },
      { id: "draft-preview", perform: clickTestId("today-candidate-row") },
      { id: "pending", perform: clickWithinDialog("Add player") },
      { id: "saved", perform: clickWithinDialog("Continue fixture simulation →") },
    ],
  },
  {
    slug: "gate-a-w3-a09-add-player-denied",
    route: "gate-a/a09-today-quick-action/add-player-denied",
    extraViewports: w3ExtraSmokeViewports,
    interactionViewports: ["desktop", "mobile"],
    interactions: [{ id: "sheet-open", perform: clickByName("Add player") }],
  },
  {
    slug: "gate-a-w3-a09-add-player-rsvp-blocked",
    route: "gate-a/a09-today-quick-action/add-player-rsvp-blocked",
    extraViewports: w3ExtraSmokeViewports,
    interactionViewports: ["desktop", "mobile"],
    interactions: [{ id: "sheet-open", perform: clickByName("Add player") }],
  },
  {
    slug: "gate-a-w3-a09-add-player-planning-closed",
    route: "gate-a/a09-today-quick-action/add-player-planning-closed",
    extraViewports: w3ExtraSmokeViewports,
    interactionViewports: ["desktop", "mobile"],
    interactions: [
      { id: "sheet-open", perform: clickByName("Add player") },
      { id: "draft-preview", perform: clickTestId("today-candidate-row") },
      { id: "pending", perform: clickWithinDialog("Add player") },
      { id: "planning-closed", perform: clickWithinDialog("Continue fixture simulation →") },
    ],
  },
  {
    slug: "gate-a-w3-a09-add-player-conflict",
    route: "gate-a/a09-today-quick-action/add-player-conflict",
    extraViewports: w3ExtraSmokeViewports,
    interactionViewports: ["desktop", "mobile"],
    interactions: [
      { id: "sheet-open", perform: clickByName("Add player") },
      { id: "draft-preview", perform: clickTestId("today-candidate-row") },
      { id: "pending", perform: clickWithinDialog("Add player") },
      { id: "conflict", perform: clickWithinDialog("Continue fixture simulation →") },
    ],
  },
  {
    slug: "gate-a-w3-a09-match-day-addition",
    route: "gate-a/a09-today-quick-action/match-day-addition",
    extraViewports: w3ExtraSmokeViewports,
    interactionViewports: ["desktop", "mobile"],
    interactions: [
      { id: "sheet-open", perform: clickByName("Add match-day helper") },
      { id: "draft-preview", perform: clickTestId("today-candidate-row") },
      { id: "pending", perform: clickWithinDialog("Add match-day helper") },
      { id: "saved", perform: clickWithinDialog("Continue fixture simulation →") },
    ],
  },
];
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
  { name: "narrow", width: 320, height: 720 },
];
const records = [];
await mkdir(output,{recursive:true});
const browser = await chromium.launch();
try {
  // A04's own route guard for the data-ui-lab-ready/console-error gates below — bounded to A04
  // only, so every W1/baseline scenario's capture behavior is provably unchanged (independent
  // review round 1, PR #778).
  const isA04Route = (route) => route.startsWith("gate-a/a04-evidence-grammar/");
  // Same gate, extended additively to Gate A W3 (A03/A07/A09) — every W3 page also marks its root
  // with `data-ui-lab-ready="true"`. Scoped to the three W3 family prefixes only, so A01/A02/A04/
  // A06/A12 and the non-Gate-A baseline scenarios are provably unaffected by this addition.
  const isW3Route = (route) =>
    route.startsWith("gate-a/a03-decision-anatomy/") ||
    route.startsWith("gate-a/a07-match-details-edit-lineup/") ||
    route.startsWith("gate-a/a09-today-quick-action/");

  for (const scenario of scenarios) for (const viewport of [...viewports, ...(scenario.extraViewports ?? [])]) for (const theme of ["dark","light"]) {
    // Width-based, not name-based: correct for any current or future viewport, including the
    // tablet-* extras above, without special-casing each new name.
    const isNarrowDevice = viewport.width < 600;
    const context = await browser.newContext({
      viewport:{width:viewport.width,height:viewport.height},
      isMobile:isNarrowDevice,hasTouch:isNarrowDevice,
      colorScheme:theme,reducedMotion:"reduce",deviceScaleFactor:1,
    });
    try {
      const page = await context.newPage();
      const consoleErrors = [];
      // Pre-existing, environment-level noise observed on EVERY scenario (W1 and baseline
      // included) in this local dev-server setup — a report-only CSP directive warning and two
      // resource-load failures unrelated to any page's own rendering. Filtered everywhere (not
      // just A04) so the gate only reacts to a genuinely new error.
      const isKnownDevServerNoise = (text) => /upgrade-insecure-requests/i.test(text) || /net::ERR_FAILED/.test(text);
      page.on("console",(msg)=>{ if (msg.type()==="error" && !isKnownDevServerNoise(msg.text())) consoleErrors.push(msg.text()); });
      page.on("pageerror",(err)=>{ const text=String(err); if (!isKnownDevServerNoise(text)) consoleErrors.push(text); });
      const url = new URL("/dev/ui-lab/"+scenario.route,base);
      url.searchParams.set("theme",theme);
      const response = await page.goto(url.toString(),{waitUntil:"networkidle",timeout:90000});
      if (response?.status()!==200) throw new Error(url.pathname+": HTTP "+response?.status());
      await page.locator("h1").first().waitFor({state:"visible",timeout:30000});
      await page.locator('.touchline[data-theme="'+theme+'"]').first().waitFor({state:"attached",timeout:30000});
      // A04 candidate-ready signal (04_TEST_AND_CAPTURE_MATRIX.md: "Wait for an explicit
      // candidate-ready indicator"), independent review round 1 verification gap — every A04
      // scenario page marks its root with `data-ui-lab-ready="true"` once mounted.
      if (isA04Route(scenario.route) || isW3Route(scenario.route)) {
        await page.locator('[data-ui-lab-ready="true"]').first().waitFor({state:"attached",timeout:30000});
      }
      await page.evaluate(()=>document.fonts.ready);
      await page.addStyleTag({content:"nextjs-portal,#__next-build-watcher,[data-nextjs-dev-tools-button],[data-nextjs-toast]{display:none!important}"});
      const initialName=scenario.slug+"-"+viewport.name+"-"+theme+".png";
      const initialPath = path.join(output,initialName);
      await page.screenshot({path:initialPath,fullPage:true,animations:"disabled",caret:"hide"});
      const initialSha256 = createHash("sha256").update(await readFile(initialPath)).digest("hex");
      records.push({
        scenario: scenario.slug,
        route: scenario.route,
        viewport: viewport.name,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        theme,
        interactionState: "initial",
        file: initialName,
        sha256: initialSha256,
      });
      console.log("Captured "+initialName+" sha256="+initialSha256);

      for (const interaction of scenario.interactions ?? []) {
        if (scenario.interactionViewports && !scenario.interactionViewports.includes(viewport.name)) continue;
        await interaction.perform(page);
        const urlBefore = url.pathname;
        if (page.url() && new URL(page.url()).pathname !== urlBefore) {
          throw new Error(
            scenario.slug+" interaction '"+interaction.id+"' navigated away from "+urlBefore+" to "+page.url()+" — context-local actions must not navigate.",
          );
        }
        const name=scenario.slug+"-"+viewport.name+"-"+theme+"-"+interaction.id+".png";
        const filePath = path.join(output,name);
        await page.screenshot({path:filePath,fullPage:true,animations:"disabled",caret:"hide"});
        const sha256 = createHash("sha256").update(await readFile(filePath)).digest("hex");
        records.push({
          scenario: scenario.slug,
          route: scenario.route,
          viewport: viewport.name,
          viewportWidth: viewport.width,
          viewportHeight: viewport.height,
          theme,
          interactionState: interaction.id,
          file: name,
          sha256,
        });
        console.log("Captured "+name+" sha256="+sha256);
      }

      // Console/page-error gate (independent review round 1, PR #778, verification gap): bounded
      // to A04 (and now W3) — fails loudly there, only warns elsewhere so no W1/baseline scenario's
      // CI result can change as a side effect of this addition.
      if (consoleErrors.length > 0) {
        const message = scenario.slug+" "+viewport.name+"/"+theme+": "+consoleErrors.length+" console/page error(s): "+consoleErrors.slice(0,3).join(" | ");
        if (isA04Route(scenario.route) || isW3Route(scenario.route)) throw new Error(message);
        console.warn("WARNING (non-A04 scenario, not failing the run): "+message);
      }
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  const sourceCommitSha = resolveCommitSha();
  await writeFile(path.join(output,"manifest.json"),JSON.stringify({
    description:"Temporary UI Lab visual-review evidence; requires human approval. Not an approved golden.",
    sourceCommitSha,
    generatedAt:new Date().toISOString(),
    environment:{node:process.version,platform:process.platform,ci:Boolean(process.env.CI)},
    knownLimitations:[
      "Captured against a local/ephemeral dev server, not a production or preview deployment.",
      "Gate A scenarios (scenario slugs prefixed gate-a-) are CANDIDATE only — see docs/ui-lab/gate-a-w1-candidates/.",
    ],
    approvalStatus:"CANDIDATE",
    captures:records,
  },null,2)+"\n");
}
