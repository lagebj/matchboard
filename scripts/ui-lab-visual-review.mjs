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

// Gate A W4 (A05/A08/A10/A11) smoke widths, same 600px inspector-threshold rationale as W3's —
// own named set per this script's established "no hidden coupling between waves" convention.
const w4ExtraSmokeViewports = [
  { name: "w4-360", width: 360, height: 800 },
  { name: "w4-430", width: 430, height: 900 },
];

// Gate B W1 (B01-B04 Match Details) smoke widths, same 360/430px rationale as Gate A's — own
// named set per this script's established "no hidden coupling between waves" convention.
const gbExtraSmokeViewports = [
  { name: "gb-360", width: 360, height: 800 },
  { name: "gb-430", width: 430, height: 900 },
];

// Gate A W5 finding: A07 and A10 both reuse A01's `max-w-[920px] ... flex-row` two-column
// inspector-beside-content layout, and (A07 still; A10 fixed in this PR) reused A01's pre-round-4
// `medium:flex-row` (600px) engagement — the same threshold used to decide inspector-vs-sheet at
// all, leaving almost no room for the inspector between ~600-840px. A01's own round-4 remediation
// added these same three tablet widths to prove the fix; applying the identical set here is the
// only way to get real capture evidence for this exact squeeze range (W3/W4 only had 360/430px
// smoke widths, which are below the 600px inspector threshold and so never exercised this layout
// state at all). See docs/ui-lab/gate-a-w5-convergence/INTERACTION_STATE_AUDIT.md.
const inspectorSqueezeSmokeViewports = [
  { name: "squeeze-600", width: 600, height: 900 },
  { name: "squeeze-768", width: 768, height: 1024 },
  { name: "squeeze-900", width: 900, height: 1024 },
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
/**
 * Real-CI finding (commit 1c0ff4c97's capture run): three mobile `sheet-open` captures
 * (add-player-denied, add-player-rsvp-blocked, match-day-addition) came back ~50% different from
 * their own prior-run hashes — not noise (compare: unrelated same-content captures differed by
 * single-digit pixel counts out of ~330k). Direct visual inspection showed the mobile bottom
 * sheet had not opened at all in the new captures: still off-screen, as if the screenshot fired
 * before `TouchlineBottomSheet`'s own `requestAnimationFrame`-driven enter transition committed.
 * `clickByName` — used for every A07/A09 "open" trigger — never waited for this, unlike A01's and
 * A04's own open-interaction helpers (which already settle-wait the sheet). This is pre-existing,
 * timing-dependent flakiness in the capture script itself (not an application bug, not something
 * this round's code changes caused) that happened not to manifest in earlier runs purely by luck
 * — S1's `sheet-open` in this exact run was unaffected. Fixed generically: after the click, if a
 * genuinely modal dialog now exists (`aria-modal="true"`, i.e. the mobile sheet), wait for it to
 * settle into its final on-screen position before returning — the same settle check already used
 * elsewhere in this script. A07's `editor-open` step uses this same helper and was equally
 * exposed; fixing it here covers both families without duplicating the wait logic.
 */
function clickByName(name) {
  return async function perform(page) {
    await page.getByRole("button", { name, exact: true }).click();
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

/**
 * The fixture-simulation "resolve" step (clicking "Continue fixture simulation →" to settle
 * PENDING into its final predeclared outcome). A plain `clickWithinDialog` here raced the
 * screenshot ahead of React's post-click re-render on a real CI runner: the click itself always
 * succeeded, but the heavier A07 pitch re-render in particular was consistently still mid-flight
 * when the screenshot fired immediately after, producing a "resolved" capture pixel-identical to
 * the "pending" one it should differ from (found by inspecting this PR's own first CI capture
 * run — the app's state machine itself was independently verified correct by component tests, so
 * this is a capture-script wait gap, not an app bug). Waiting for the universal "Saving… (fixture
 * simulation)" text to detach after the click guarantees the screenshot reflects the settled
 * state, for every A07/A09 resolve step.
 */
function clickResolvePending() {
  return async function perform(page) {
    const dialog = page.getByRole("dialog").first();
    await dialog.getByRole("button", { name: "Continue fixture simulation →", exact: true }).click();
    await dialog.getByText("Saving… (fixture simulation)").waitFor({ state: "detached", timeout: 10000 });
  };
}

/**
 * B06/W3 remediation (B2-R3/R5) — drives B05 draft's real fixture-local lifecycle instead of the
 * old whole-fixture-swap control this replaced: confirm the real timing blocker, add the real
 * missing goal, then click the real "Complete report" button (native confirm() dialog
 * auto-accepted — this never reaches a production server action, see
 * shared/use-safe-report-lifecycle.ts). Waits for "Reopen report" to confirm the transition
 * actually completed before the screenshot fires.
 */
// B5/R1 — the real `complete()` gate only blocks on timing review (`getTimingSubmissionBlockers()`
// parity), never on goal-attribution reconciliation, matching production's own `completeReport()`
// exactly (see BLOCKERS.md/DATA_TRUTH_AND_FIXTURES.md). That means a report CAN legally reach
// LOCKED with the goal-attribution gap still open — a real, reachable path, not a hypothetical —
// and the candidate must disclose it rather than silently let it look reconciled. Two sequential
// interaction states demonstrate both real outcomes from the one draft page, in order:
//   1. completeB05DraftWithUnresolvedGapFlow — confirm timing ONLY, then complete. Legal; the
//      gap banner must still be visible once locked (B5/R1's visual correction).
//   2. completeB05DraftReconciledFlow — reopen, add the real missing goal (Sindre, 34', via the
//      actual minute input — B5/R1's capture fix), then complete again. The standard/golden
//      completed reference path: fully reconciled, matching `completed/fixtures.ts` exactly.
function completeB05DraftWithUnresolvedGapFlow() {
  return async function perform(page) {
    await page.getByRole("button", { name: "Confirm duration", exact: true }).click();
    await page.getByText("Confirm duration", { exact: true }).waitFor({ state: "detached", timeout: 10000 });

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Complete report", exact: true }).click();
    await page.getByRole("button", { name: "Reopen report", exact: true }).waitFor({ state: "visible", timeout: 10000 });
    // R8-1 — the disclosure must still be showing, AND it must be the LOCKED-state wording
    // specifically ("Reopen the report to add..."), never the editable-state wording — this
    // state is legally LOCKED but NOT reconciled, and the coach must be told to reopen, not to
    // complete an already-completed report.
    await page.getByText(/Reopen the report to add/i).waitFor({ state: "visible", timeout: 10000 });
  };
}

function completeB05DraftReconciledFlow() {
  return async function perform(page) {
    const reopenButton = page.getByRole("button", { name: "Reopen report", exact: true });
    // This exact click was observed failing twice in real CI, on the `mobile` (hasTouch: true)
    // viewport only — Playwright's pre-click actionability check reported an ancestor
    // `<div class="flex flex-col gap-5">` "intercepting pointer events" at the computed click
    // point, every retry, for the full 30s timeout, even after an explicit scroll/viewport reset.
    // Desktop (not touch-emulated) performs the identical click, in the identical application
    // state, successfully every run. The real screenshot from that same failing run's own CI
    // capture (gate-b-w2-b05-draft-mobile-dark-completed-with-gap-transition.png, downloaded and
    // inspected directly) shows the button fully visible and unobstructed — nothing in the
    // rendered page actually covers it. This matches a known Playwright touch-emulation
    // hit-testing false positive, not a real reachability bug; `force: true` skips that
    // pointer-interception pre-check while still performing a real click on the real element —
    // `scrollIntoViewIfNeeded()` beforehand keeps the click honest about the element actually
    // being on-screen first.
    await reopenButton.scrollIntoViewIfNeeded();
    page.once("dialog", (dialog) => dialog.accept());
    await reopenButton.click({ force: true });
    await page.getByRole("button", { name: "Complete report", exact: true }).waitFor({ state: "visible", timeout: 10000 });

    const scorerSelect = page.locator("select").filter({ has: page.locator('option[value=""]', { hasText: "Select scorer" }) });
    await scorerSelect.selectOption({ value: "player-gb5-sindre" });
    await page.getByPlaceholder("Min", { exact: true }).fill("34");
    await page.getByRole("button", { name: "Add goal", exact: true }).click();
    await page.getByText(/recorded during Live Reporting/i).waitFor({ state: "detached", timeout: 10000 });

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Complete report", exact: true }).click();
    await page.getByRole("button", { name: "Reopen report", exact: true }).waitFor({ state: "visible", timeout: 10000 });
    // R8-1 required check: a fully reconciled LOCKED report shows no warning at all.
    await page.getByText(/recorded during Live Reporting/i).waitFor({ state: "detached", timeout: 10000 });
  };
}

/**
 * Gate A W4 (A05/A11) interaction helper: fills the AssistantCoachHypothesisCard's/
 * ProfileChangeReviewCard's text input (where present) before clicking a button whose
 * disabled/enabled state depends on it — a plain `clickByName` alone can't exercise the
 * "Promote to development focus" control, which stays disabled until non-empty.
 */
function fillAndClick(labelText, value, buttonName) {
  return async function perform(page) {
    const input = page.getByLabel(labelText, { exact: true });
    if ((await input.count()) > 0) {
      await input.fill(value);
    }
    await page.getByRole("button", { name: buttonName, exact: true }).click();
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
    extraViewports: [...w3ExtraSmokeViewports, ...inspectorSqueezeSmokeViewports],
    interactionViewports: ["desktop", "mobile", "squeeze-600", "squeeze-768", "squeeze-900"],
    interactions: [
      { id: "editor-open", perform: clickByName("Edit lineup") },
      { id: "draft-preview", perform: clickTestId("lineup-candidate-row") },
      { id: "pending", perform: clickWithinDialog("Confirm assignment") },
      { id: "saved", perform: clickResolvePending() },
    ],
  },
  {
    slug: "gate-a-w3-a07-assign-reserve-denied",
    route: "gate-a/a07-match-details-edit-lineup/assign-reserve-denied",
    extraViewports: [...w3ExtraSmokeViewports, ...inspectorSqueezeSmokeViewports],
    interactionViewports: ["desktop", "mobile", "squeeze-600", "squeeze-768", "squeeze-900"],
    interactions: [
      { id: "editor-open", perform: clickByName("Edit lineup") },
      { id: "draft-preview", perform: clickTestId("lineup-candidate-row") },
      { id: "pending", perform: clickWithinDialog("Confirm assignment") },
      { id: "denied", perform: clickResolvePending() },
    ],
  },
  {
    slug: "gate-a-w3-a07-server-conflict",
    route: "gate-a/a07-match-details-edit-lineup/server-conflict",
    extraViewports: [...w3ExtraSmokeViewports, ...inspectorSqueezeSmokeViewports],
    interactionViewports: ["desktop", "mobile", "squeeze-600", "squeeze-768", "squeeze-900"],
    interactions: [
      { id: "editor-open", perform: clickByName("Edit lineup") },
      { id: "draft-preview", perform: clickTestId("lineup-candidate-row") },
      { id: "pending", perform: clickWithinDialog("Confirm assignment") },
      { id: "conflict", perform: clickResolvePending() },
    ],
  },
  {
    slug: "gate-a-w3-a07-planning-closed-after-opening",
    route: "gate-a/a07-match-details-edit-lineup/planning-closed-after-opening",
    extraViewports: [...w3ExtraSmokeViewports, ...inspectorSqueezeSmokeViewports],
    interactionViewports: ["desktop", "mobile", "squeeze-600", "squeeze-768", "squeeze-900"],
    interactions: [
      { id: "editor-open", perform: clickByName("Edit lineup") },
      { id: "draft-preview", perform: clickTestId("lineup-candidate-row") },
      { id: "pending", perform: clickWithinDialog("Confirm assignment") },
      { id: "planning-closed", perform: clickResolvePending() },
    ],
  },
  {
    slug: "gate-a-w3-a07-dirty-draft-close",
    route: "gate-a/a07-match-details-edit-lineup/dirty-draft-close",
    extraViewports: [...w3ExtraSmokeViewports, ...inspectorSqueezeSmokeViewports],
    interactionViewports: ["desktop", "mobile", "squeeze-600", "squeeze-768", "squeeze-900"],
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
      { id: "saved", perform: clickResolvePending() },
      // Independent review (duplicate-addition finding): close after SUCCESS, then reopen —
      // captures the genuinely new "already included" visual state (disabled candidate row,
      // "Already included in this match" reason) that no prior capture exercised.
      { id: "closed-after-saved", perform: clickWithinDialog("Close") },
      { id: "reopened-already-included", perform: clickByName("Add player") },
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
      { id: "planning-closed", perform: clickResolvePending() },
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
      { id: "conflict", perform: clickResolvePending() },
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
      { id: "saved", perform: clickResolvePending() },
      // Independent review (duplicate-addition finding): close after SUCCESS, then reopen —
      // captures the genuinely new "already included" visual state, and that the separate
      // planned-squad line still reads unchanged in this state too.
      { id: "closed-after-saved", perform: clickWithinDialog("Close") },
      { id: "reopened-already-included", perform: clickByName("Add match-day helper") },
    ],
  },
  // Gate A W4 candidates (programme_v054 `20_UI_LAB_CANDIDATE_WAVES.md` W4) — A05/A08/A10/A11,
  // CANDIDATE, not approved. `w4ExtraSmokeViewports` mirrors A04's/W3's 360/430px smoke widths.
  {
    slug: "gate-a-w4-a05-disabled",
    route: "gate-a/a05-assistant-coach-semantic-grammar/disabled",
    extraViewports: w4ExtraSmokeViewports,
  },
  {
    slug: "gate-a-w4-a05-enabled-with-pattern",
    route: "gate-a/a05-assistant-coach-semantic-grammar/enabled-with-pattern",
    extraViewports: w4ExtraSmokeViewports,
    interactionViewports: ["desktop", "mobile"],
    interactions: [{ id: "promoted", perform: fillAndClick("Development focus to record if promoted", "Composure under pressure", "Promote to development focus") }],
  },
  {
    slug: "gate-a-w4-a05-enabled-without-pattern",
    route: "gate-a/a05-assistant-coach-semantic-grammar/enabled-without-pattern",
    extraViewports: w4ExtraSmokeViewports,
  },
  {
    slug: "gate-a-w4-a05-unavailable",
    route: "gate-a/a05-assistant-coach-semantic-grammar/unavailable",
    extraViewports: w4ExtraSmokeViewports,
  },
  {
    slug: "gate-a-w4-a08-off",
    route: "gate-a/a08-assistant-coach-activation-parity/off",
    extraViewports: w4ExtraSmokeViewports,
  },
  {
    slug: "gate-a-w4-a08-on-strong-pattern",
    route: "gate-a/a08-assistant-coach-activation-parity/on-strong-pattern",
    extraViewports: w4ExtraSmokeViewports,
  },
  {
    slug: "gate-a-w4-a08-on-no-insight",
    route: "gate-a/a08-assistant-coach-activation-parity/on-no-insight",
    extraViewports: w4ExtraSmokeViewports,
  },
  {
    slug: "gate-a-w4-a10-review-alternative-success",
    route: "gate-a/a10-assistant-coach-structured-action/review-alternative-success",
    extraViewports: [...w4ExtraSmokeViewports, ...inspectorSqueezeSmokeViewports],
    interactionViewports: ["desktop", "mobile", "squeeze-600", "squeeze-768", "squeeze-900"],
    interactions: [
      { id: "editor-open", perform: clickByName("Review lineup") },
      { id: "draft-preview", perform: clickTestId("lineup-proposal-row") },
      { id: "pending", perform: clickWithinDialog("Apply proposal") },
      { id: "saved", perform: clickResolvePending() },
      // Independent review finding R4: reopening after a successful apply must show an honest
      // "already applied" state, never a freshly-actionable proposal — capture it explicitly
      // rather than only proving it in component tests.
      { id: "closed-after-saved", perform: clickWithinDialog("Close") },
      { id: "reopened-already-applied", perform: clickByName("Review lineup") },
    ],
  },
  {
    slug: "gate-a-w4-a10-stale-proposal-blocked",
    route: "gate-a/a10-assistant-coach-structured-action/stale-proposal-blocked",
    extraViewports: [...w4ExtraSmokeViewports, ...inspectorSqueezeSmokeViewports],
    interactionViewports: ["desktop", "mobile", "squeeze-600", "squeeze-768", "squeeze-900"],
    // Remediation finding R2: a blocked (stale) proposal no longer renders a selectable
    // `lineup-proposal-row` at all — only the inspectable rationale/evidence inside the blocked-
    // reason banner. "editor-open" alone already captures that settled state; there is no further
    // interaction to perform.
    interactions: [{ id: "editor-open", perform: clickByName("Review lineup") }],
  },
  {
    slug: "gate-a-w4-a10-disabled-or-failed",
    route: "gate-a/a10-assistant-coach-structured-action/disabled-or-failed",
    extraViewports: [...w4ExtraSmokeViewports, ...inspectorSqueezeSmokeViewports],
    interactionViewports: ["desktop", "mobile", "squeeze-600", "squeeze-768", "squeeze-900"],
    interactions: [{ id: "editor-open", perform: clickByName("Review lineup") }],
  },
  {
    slug: "gate-a-w4-a11-coach-text-and-parsed-evidence",
    route: "gate-a/a11-qualitative-evidence-and-mutation/coach-text-and-parsed-evidence",
    extraViewports: w4ExtraSmokeViewports,
  },
  {
    slug: "gate-a-w4-a11-profile-change-review-guarded",
    route: "gate-a/a11-qualitative-evidence-and-mutation/profile-change-review-guarded",
    extraViewports: w4ExtraSmokeViewports,
    interactions: [{ id: "accepted", perform: clickByName("Accept change") }],
  },
  {
    slug: "gate-a-w4-a11-profile-change-review-rejected",
    route: "gate-a/a11-qualitative-evidence-and-mutation/profile-change-review-rejected",
    extraViewports: w4ExtraSmokeViewports,
    interactions: [{ id: "rejected", perform: clickByName("Reject") }],
  },
  // Gate B W1 candidates (official register `25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv` B01-B04) —
  // CANDIDATE, not approved. B01 reuses A07's two-column inspector-beside-content layout and the
  // same A07 fixture-operation grammar, so it gets the same squeeze-width coverage; B02-B04 are
  // static read-only compositions with no responsive inspector threshold, so only the 360/430px
  // smoke widths apply.
  {
    slug: "gate-b-w1-b01-planned-ready",
    route: "gate-b/b01-planned-ready",
    extraViewports: [...gbExtraSmokeViewports, ...inspectorSqueezeSmokeViewports],
    interactionViewports: ["desktop", "mobile", "squeeze-600", "squeeze-768", "squeeze-900"],
    interactions: [
      { id: "editor-open", perform: clickByName("Edit lineup") },
      { id: "draft-preview", perform: clickTestId("lineup-candidate-row") },
      { id: "pending", perform: clickWithinDialog("Confirm assignment") },
      { id: "saved", perform: clickResolvePending() },
    ],
  },
  // B1-R4 remediation: B01's same-match AFTER-state companion — proves the register-required
  // before/after lifecycle identity continuity. Read-only, no inspector, so only the 360/430px
  // smoke widths apply (same as B02-B04).
  {
    slug: "gate-b-w1-b01-after",
    route: "gate-b/b01-planned-ready/after",
    extraViewports: gbExtraSmokeViewports,
  },
  {
    slug: "gate-b-w1-b02-planned-incomplete",
    route: "gate-b/b02-planned-incomplete",
    extraViewports: gbExtraSmokeViewports,
  },
  {
    slug: "gate-b-w1-b03-completed-sparse",
    route: "gate-b/b03-completed-sparse",
    extraViewports: gbExtraSmokeViewports,
  },
  // B1-R8 remediation: B04's evidence-inspection trigger ("Inspect combination evidence") was
  // reachable and component-tested, but no capture ever opened it — every prior B04 capture was
  // `initial` only. Reuses A01/A04's exact responsive squeeze set so the inline-inspector-vs-sheet
  // transition gets the same real evidence B01's Edit Lineup already has.
  {
    slug: "gate-b-w1-b04-completed-rich",
    route: "gate-b/b04-completed-rich",
    extraViewports: [...gbExtraSmokeViewports, ...inspectorSqueezeSmokeViewports],
    interactionViewports: ["desktop", "mobile", "squeeze-600", "squeeze-768", "squeeze-900"],
    interactions: [{ id: "evidence-open", perform: clickByName("Inspect combination evidence") }],
  },
  // Gate B W2 candidate (official register B05, deferred row — now picked up) — CANDIDATE, not
  // approved. The real `PostMatchReportPageShell`/`PostMatchReportShell`/`PostMatchDebrief`, no
  // responsive inspector threshold, so only the 360/430px smoke widths apply (same as B02-B04).
  {
    slug: "gate-b-w2-b05-draft",
    route: "gate-b/b05-post-match-report/draft",
    extraViewports: gbExtraSmokeViewports,
    interactionViewports: ["desktop", "mobile"],
    // fixtureVersion 2 (B2-R3/R5/B5-R1 remediation): drives the real fixture-local lifecycle
    // (confirm timing, click the real "Complete report" button — a native confirm() dialog,
    // auto-accepted) rather than a whole-fixture-swap button, and never reaches a production
    // server action (shared/use-safe-report-lifecycle.ts). Two sequential states from the SAME
    // page load (B5/R1): the real "legally locked but still unresolved" path first, then the
    // real "reopen, add the missing goal, reconcile" path — proving both real outcomes the
    // production completion gate actually allows, plus the pinned-`?tab=players` regression
    // (post-match-report-page-shell.test.tsx's own coverage), with real capture evidence.
    interactions: [
      { id: "completed-with-gap-transition", perform: completeB05DraftWithUnresolvedGapFlow() },
      { id: "completed-transition", perform: completeB05DraftReconciledFlow() },
    ],
  },
  {
    slug: "gate-b-w2-b05-completed",
    route: "gate-b/b05-post-match-report/completed",
    extraViewports: gbExtraSmokeViewports,
  },
  // B5/R5/B5/R7 — the real navigation destination `breadcrumbHref`/"Back to match" now link to,
  // registered for capture so it is not a silent coverage gap the way B06's own two nav pages
  // were (found and fixed in the same pass — see below).
  {
    slug: "gate-b-w2-b05-match-details",
    route: "gate-b/b05-post-match-report/match-details",
    extraViewports: gbExtraSmokeViewports,
  },
  // Gate B W3 candidate (official register B06, "League/Event match comparison") — CANDIDATE,
  // not approved. Four static read-only compositions, no responsive inspector threshold, so only
  // the 360/430px smoke widths apply (same as B02-B04/B05) — reuses `gbExtraSmokeViewports`
  // directly, the same Gate B smoke-width concept every prior Gate B wave has used.
  {
    slug: "gate-b-w3-b06-league-before",
    route: "gate-b/b06-league-event-parity/league/before",
    extraViewports: gbExtraSmokeViewports,
  },
  {
    slug: "gate-b-w3-b06-league-after",
    route: "gate-b/b06-league-event-parity/league/after",
    extraViewports: gbExtraSmokeViewports,
  },
  {
    slug: "gate-b-w3-b06-event-before",
    route: "gate-b/b06-league-event-parity/event/before",
    extraViewports: gbExtraSmokeViewports,
  },
  {
    slug: "gate-b-w3-b06-event-after",
    route: "gate-b/b06-league-event-parity/event/after",
    extraViewports: gbExtraSmokeViewports,
  },
  // B5/R7 — these two real B3-R5 navigation-origin pages existed since the B06 remediation but
  // were never registered here, so they had zero real CI capture evidence despite being linked
  // from every League/Event Before/After page. Found and fixed in this same pass.
  {
    slug: "gate-b-w3-b06-league-match-details",
    route: "gate-b/b06-league-event-parity/league/match-details",
    extraViewports: gbExtraSmokeViewports,
  },
  {
    slug: "gate-b-w3-b06-event-detail",
    route: "gate-b/b06-league-event-parity/event/event-detail",
    extraViewports: gbExtraSmokeViewports,
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
// B3-R1: set only once every registered scenario's loop iteration completes without throwing —
// guards the coverage-completeness check below from masking a real mid-run crash with a less
// useful "missing scenario" error (a crash already fails the run on its own).
let completedAllScenarios = false;
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
  // Same gate, extended additively to Gate A W4 (A05/A08/A10/A11) — every W4 page also marks its
  // root with `data-ui-lab-ready="true"`. Scoped to the four W4 family prefixes only, so every
  // earlier wave is provably unaffected by this addition.
  const isW4Route = (route) =>
    route.startsWith("gate-a/a05-assistant-coach-semantic-grammar/") ||
    route.startsWith("gate-a/a08-assistant-coach-activation-parity/") ||
    route.startsWith("gate-a/a10-assistant-coach-structured-action/") ||
    route.startsWith("gate-a/a11-qualitative-evidence-and-mutation/");
  // Same gate, extended additively to Gate B W1 (B01-B04) — every Gate B page also marks its
  // root with `data-ui-lab-ready="true"`. Scoped to the gate-b/ prefix only, so every Gate A wave
  // is provably unaffected by this addition.
  const isGateBRoute = (route) => route.startsWith("gate-b/");

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
      if (isA04Route(scenario.route) || isW3Route(scenario.route) || isW4Route(scenario.route) || isGateBRoute(scenario.route)) {
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
        // A `fullPage` screenshot can temporarily resize the viewport to capture content taller
        // than the configured window and leave scroll position wherever the last captured
        // segment left it. A SECOND chained interaction (B5/R1's two-step B05 draft flow is the
        // first Gate B scenario to do this) then clicks against coordinates computed from that
        // stale geometry, which resolved to the whole-page wrapper div instead of the intended
        // button on the narrow (`mobile`) viewport in CI. Reassert the real viewport size and
        // reset scroll before any further interaction runs.
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.evaluate(() => window.scrollTo(0, 0));
      }

      // Console/page-error gate (independent review round 1, PR #778, verification gap): bounded
      // to A04 (and now W3/W4) — fails loudly there, only warns elsewhere so no W1/baseline
      // scenario's CI result can change as a side effect of this addition.
      if (consoleErrors.length > 0) {
        const message = scenario.slug+" "+viewport.name+"/"+theme+": "+consoleErrors.length+" console/page error(s): "+consoleErrors.slice(0,3).join(" | ");
        if (isA04Route(scenario.route) || isW3Route(scenario.route) || isW4Route(scenario.route) || isGateBRoute(scenario.route)) throw new Error(message);
        console.warn("WARNING (non-A04 scenario, not failing the run): "+message);
      }
    } finally { await context.close(); }
  }
  completedAllScenarios = true;
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

  // B3-R1: coverage-completeness verifier. The original B06 capture run was green but silently
  // produced zero B06 captures (the scenario simply wasn't registered in `scenarios` above) —
  // this makes that exact class of regression a hard CI failure instead of something only a
  // manual artifact inspection would ever catch. Only runs when the capture loop itself didn't
  // already crash (a crash is already a failure on its own, and re-throwing from `finally`
  // would mask the real error with this one).
  if (completedAllScenarios) {
    const capturedSlugs = new Set(records.map((r) => r.scenario));
    const missing = scenarios.map((s) => s.slug).filter((slug) => !capturedSlugs.has(slug));
    if (missing.length > 0) {
      throw new Error(
        "Capture coverage incomplete — "+missing.length+" registered scenario(s) produced zero captures: "+missing.join(", ")+
        ". A scenario registered in `scenarios` must always produce at least one capture; see manifest.json for what was actually captured.",
      );
    }
  }
}
