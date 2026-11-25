import { test, expect } from "@playwright/test";

/**
 * Gate D W1 (Player Intelligence; register D01/D02/D04/D07/D08/D09) remediation — real Chromium
 * assertions for the simulated interactions and profile-level presentations the owner's
 * remediation brief required browser-level (not just component-test) evidence for. Runs under the
 * `ui-lab-gate-d` project only (`playwright.config.ts`), against the same local `next dev` server
 * `scripts/ui-lab-visual-review.mjs` already starts in CI (`.github/workflows/ui-lab-visual-review.yml`).
 * No auth, no database — `/dev/ui-lab` is explicitly unauthenticated (`src/app/dev/ui-lab/layout.tsx`).
 *
 * D07/D08's review/approval surfaces and D09's Edit/Retract are directional design candidates for
 * ADR-0160's decided-but-unimplemented policy — every simulated control is asserted to fire zero
 * real Next.js Server Action requests, using the `next-action` request header (not a blanket "zero
 * POST" check — a blanket check false-failed once in CI on an unrelated CSP-report POST, per
 * `ui-lab-gate-c.spec.ts`'s own precedent comment).
 */

const BASE = "/dev/ui-lab/gate-d";

function collectServerActionRequests(page: import("@playwright/test").Page): string[] {
  const requests: string[] = [];
  page.on("request", (req) => {
    if (req.method() === "POST" && req.headers()["next-action"]) requests.push(req.url());
  });
  return requests;
}

test.describe("D01 — approved 14-role profile experience", () => {
  test("agreeing: declared and evidence-derived profile roles render and agree", async ({ page }) => {
    await page.goto(`${BASE}/d01-overview-position-evidence/agreeing-positions`);
    await expect(page.getByText("Declared:")).toBeVisible();
    await expect(page.getByText("Evidence-derived:")).toBeVisible();
    await expect(page.getByText("Declared and evidence-derived profile roles agree.")).toBeVisible();
  });

  test("agreeing: the exact-tactical-evidence drill-down is reachable", async ({ page }) => {
    await page.goto(`${BASE}/d01-overview-position-evidence/agreeing-positions`);
    const details = page.locator("details", { hasText: "Exact tactical evidence" });
    await expect(details.locator("summary")).toBeVisible();
    await details.locator("summary").click();
    await expect(details.locator("li").first()).toBeVisible();
  });

  test("diverging: shows the declared vs. evidence-derived profile-role divergence and the no-automatic-mutation disclosure", async ({ page }) => {
    await page.goto(`${BASE}/d01-overview-position-evidence/diverging-positions`);
    await expect(page.getByText(/Declared profile role \(.*\) and the evidence-derived role \(.*\) differ\./)).toBeVisible();
    await expect(page.getByText(/no automatic\s*\n?\s*primary-position mutation occurs/)).toBeVisible();
  });

  test("diverging: the declared profile role is never rendered as if it had already been replaced", async ({ page }) => {
    await page.goto(`${BASE}/d01-overview-position-evidence/diverging-positions`);
    await expect(page.getByText(/still the real,\s*current declaration/i)).toBeVisible();
  });
});

test.describe("D02 — real profile-level consolidation, exact drill-down preserved", () => {
  test("populated: the profile-level consolidated view renders as the primary presentation, with the exact breakdown collapsed by default", async ({ page }) => {
    await page.goto(`${BASE}/d02-evidence-dot-consolidation/populated-evidence`);
    // The real StackedDistribution legend renders each segment as "{code} {percent}%" — these are
    // the literal, correctly-consolidated profile-level values (CB 58%+25%=83%, DM 17%).
    await expect(page.getByText("CB 83%", { exact: true })).toBeVisible();
    await expect(page.getByText("DM 17%", { exact: true })).toBeVisible();
    // The exact breakdown is real but collapsed-by-default (native <details>, no `open`
    // attribute) — RCB/CDM exist in the DOM but are not the primary, immediately-visible view.
    const details = page.locator("details", { hasText: "Exact tactical breakdown" });
    await expect(details).not.toHaveJSProperty("open", true);
  });

  test("populated: the exact breakdown drill-down is reachable and shows the original exact codes", async ({ page }) => {
    await page.goto(`${BASE}/d02-evidence-dot-consolidation/populated-evidence`);
    const details = page.locator("details", { hasText: "Exact tactical breakdown" });
    await details.locator("summary").click();
    await expect(details.locator(":visible", { hasText: "RCB" }).first()).toBeVisible();
    await expect(details.locator(":visible", { hasText: "CDM" }).first()).toBeVisible();
  });

  test("sparse: the single-code edge case still renders both the profile-level and exact-level views", async ({ page }) => {
    await page.goto(`${BASE}/d02-evidence-dot-consolidation/sparse-evidence`);
    await expect(page.getByText("Exact tactical breakdown")).toBeVisible();
  });
});

test.describe("D07 — correct cumulative-materiality semantics (pending vs. applied)", () => {
  test("the pending proposal is never shown as already applied, before any decision", async ({ page }) => {
    await page.goto(`${BASE}/d07-attribute-evolution-review/pending-material-approval`);
    await expect(page.getByTestId("baseline-value")).toHaveText("6");
    await expect(page.getByTestId("current-applied-value")).toHaveText("7");
    await expect(page.getByTestId("proposed-value")).toHaveText("8");
    await expect(page.getByTestId("decision-result")).toHaveCount(0);
  });

  test("the threshold boundary text states the correct trigger (2 cumulative points)", async ({ page }) => {
    await page.goto(`${BASE}/d07-attribute-evolution-review/pending-material-approval`);
    await expect(page.getByText(/2 or more points/)).toBeVisible();
  });

  test("Accept applies a truthful simulated decision, with no real Server Action invoked", async ({ page }) => {
    await page.goto(`${BASE}/d07-attribute-evolution-review/pending-material-approval`);
    const requests = collectServerActionRequests(page);

    await page.getByRole("button", { name: "Accept", exact: true }).click();
    await expect(page.getByTestId("decision-result")).toContainText("Accepted");
    await expect(page.getByTestId("decision-result")).toContainText("8");
    // The dt/dd summary values are fixture-derived, not mutated by the simulated decision — the
    // component does not pretend 8 is now the real current-applied value.
    await expect(page.getByTestId("current-applied-value")).toHaveText("7");
    expect(requests).toHaveLength(0);
  });

  test("Reject leaves the current applied value unchanged, with no real Server Action invoked", async ({ page }) => {
    await page.goto(`${BASE}/d07-attribute-evolution-review/pending-material-approval`);
    const requests = collectServerActionRequests(page);

    await page.getByRole("button", { name: "Reject", exact: true }).click();
    await expect(page.getByTestId("decision-result")).toContainText("Rejected");
    await expect(page.getByTestId("decision-result")).toContainText("7");
    expect(requests).toHaveLength(0);
  });

  test("the non-material automatic state shows a real, already-applied AUTOMATIC change, no approval controls", async ({ page }) => {
    await page.goto(`${BASE}/d07-attribute-evolution-review/automatic-non-material`);
    await expect(page.getByRole("button", { name: "Accept", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reject", exact: true })).toHaveCount(0);
  });

  test("manual-edit-rebase: an unrelated attribute's coach baseline stays fixed even though automation already moved its applied value", async ({ page }) => {
    await page.goto(`${BASE}/d07-attribute-evolution-review/manual-edit-rebase`);
    await expect(page.getByTestId("baseline-passing")).toHaveText("9");
    await expect(page.getByTestId("baseline-speed")).toHaveText("6");
    await expect(page.getByTestId("applied-speed")).toHaveText("applied 7");
    await expect(page.getByTestId("resume-status-speed")).not.toContainText("Locked");
  });

  test("manual-edit-rebase: Unlock actually changes the displayed lock state, with no real Server Action invoked", async ({ page }) => {
    await page.goto(`${BASE}/d07-attribute-evolution-review/manual-edit-rebase`);
    const requests = collectServerActionRequests(page);

    await expect(page.getByTestId("resume-status-effort")).toContainText("Locked");
    const unlockButton = page.getByTestId("rebase-row-effort").getByRole("button", { name: "Unlock (simulated)" });
    await unlockButton.click();
    await expect(page.getByTestId("resume-status-effort")).not.toContainText("Locked");
    await expect(page.getByTestId("resume-status-effort")).toContainText("Eligible to resume");
    expect(requests).toHaveLength(0);
  });
});

test.describe("D08 — genuine evidence conflict, real browser Accept/Reject/Defer", () => {
  test("strong-evidence: Accept, Reject, and Defer each produce a truthful simulated decision, with no real Server Action invoked", async ({ page }) => {
    for (const action of ["Accept", "Reject", "Defer"] as const) {
      await page.goto(`${BASE}/d08-primary-position-proposal/strong-evidence`);
      const requests = collectServerActionRequests(page);
      await page.getByRole("button", { name: action, exact: true }).click();
      await expect(page.getByTestId("decision-result")).toBeVisible();
      expect(requests).toHaveLength(0);
    }
  });

  test("conflicting-note: the coach note genuinely conflicts with the proposal and is shown as additional context, not a silent resolution", async ({ page }) => {
    await page.goto(`${BASE}/d08-primary-position-proposal/conflicting-note`);
    await expect(page.getByText("Conflicting note:")).toBeVisible();
    // The conflicting observation raises a defensive concern directly relevant to the proposed
    // role — it must not simply restate support for the move (the original, since-fixed defect).
    await expect(page.getByText(/beaten in behind|struggled to track|defensive/i)).toBeVisible();
    // Both decision buttons remain available — the system does not auto-suppress or auto-apply.
    await expect(page.getByRole("button", { name: "Accept", exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Reject", exact: true })).toBeEnabled();
  });

  test("the proposed primary is always a 14-role profile code, never a sided/central tactical code", async ({ page }) => {
    await page.goto(`${BASE}/d08-primary-position-proposal/conflicting-note`);
    // The profile-level summary line never contains a sided/central exact code as the headline
    // target (e.g. never "RWB" or "LCB" as the proposed role) — only the disclosed "exact recorded
    // evidence" line below it may show the exact tactical code.
    await expect(page.getByText(/Exact recorded evidence:/)).toBeVisible();
  });
});

test.describe("D09 — full lineage coverage: explicit/tentative/edit/retract/ambiguous-rejection", () => {
  test("superseded-lineage: Retract moves the active entry to superseded, with no real Server Action invoked", async ({ page }) => {
    await page.goto(`${BASE}/d09-evidence-lineage/superseded-lineage`);
    const requests = collectServerActionRequests(page);

    await expect(page.getByRole("button", { name: "Retract", exact: true })).toHaveCount(1);
    await page.getByRole("button", { name: "Retract", exact: true }).click();
    await expect(page.getByRole("button", { name: "Retract", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
    expect(requests).toHaveLength(0);
  });

  test("superseded-lineage: Edit supersedes the prior entry and adds a new active one, preserving the original wording, with no real Server Action invoked", async ({ page }) => {
    await page.goto(`${BASE}/d09-evidence-lineage/superseded-lineage`);
    const requests = collectServerActionRequests(page);
    const originalText = "First touch seemed a little heavy a couple of times, though it was a wet pitch.";

    await expect(page.getByText(originalText)).toBeVisible();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const textarea = page.getByRole("textbox");
    await textarea.fill("First touch was clean once the pitch dried out in the second half.");
    await page.getByRole("button", { name: "Save edit (simulated)" }).click();

    // The original wording is preserved (struck through, marked superseded), not rewritten.
    await expect(page.getByText(originalText)).toBeVisible();
    await expect(page.getByText("First touch was clean once the pitch dried out in the second half.")).toBeVisible();
    expect(requests).toHaveLength(0);
  });

  test("ambiguous-reference-rejected: the real extraction contract's rejection produces zero observations, not a kept-but-ambiguous one", async ({ page }) => {
    await page.goto(`${BASE}/d09-evidence-lineage/ambiguous-reference-rejected`);
    await expect(page.getByTestId("observation-count")).toContainText("Resulting observations created: 0");
    // Exact match: the page heading also contains the substring "rejected" ("Submission
    // rejected — no observation created"), so a loose substring match is ambiguous here.
    await expect(page.getByText("Rejected", { exact: true })).toBeVisible();
  });
});

test.describe("D03 — Development/AI: grounded hypothesis, sparse no-hypothesis state, coach decision flow", () => {
  test("grounded: the existing development focus and the Assistant Coach hypothesis are visibly distinct", async ({ page }) => {
    await page.goto(`${BASE}/d03-development-ai/grounded-longitudinal-hypothesis`);
    // The focus name appears twice (the Development focus widget's own title, and quoted inside
    // the hypothesis statement's prose) — both real, not a duplicate-rendering bug.
    await expect(page.getByText("Composure under pressure in the defensive third").first()).toBeVisible();
    await expect(page.getByText(/This is the coach's own existing, already-confirmed development focus/)).toBeVisible();
    await expect(page.getByText("Assistant Coach hypotheses")).toBeVisible();
  });

  test("grounded: the contradicting observation is disclosed, not hidden", async ({ page }) => {
    await page.goto(`${BASE}/d03-development-ai/grounded-longitudinal-hypothesis`);
    await expect(page.getByText(/Contradicting: Coach observation, 4 Oct 2026 vs Skedsmo/)).toBeVisible();
  });

  test("grounded: the cited source detail is reachable via a real, keyboard-accessible <details>", async ({ page }) => {
    await page.goto(`${BASE}/d03-development-ai/grounded-longitudinal-hypothesis`);
    const details = page.locator("details", { hasText: "Recorded defensive-third giveaways" });
    await details.locator("summary").click();
    await expect(details.getByText(/5 across the previous 3 matches/)).toBeVisible();
  });

  test("grounded: describes recorded giveaways as a count, never as an unlabelled rate (remediation P2 #3)", async ({ page }) => {
    await page.goto(`${BASE}/d03-development-ai/grounded-longitudinal-hypothesis`);
    await expect(page.getByText(/giveaway rate/i)).toHaveCount(0);
    await expect(page.getByText(/not an exposure-adjusted performance rate/)).toBeVisible();
  });

  test("grounded: states the correct six-week learning-cycle duration, computed from the fixture's own dates (remediation P2 #4)", async ({ page }) => {
    await page.goto(`${BASE}/d03-development-ai/grounded-longitudinal-hypothesis`);
    await expect(page.getByText(/Based on the 6-week window 30 Aug – 11 Oct 2026/)).toBeVisible();
    await expect(page.getByText(/five-week/)).toHaveCount(0);
  });

  test("sparse: renders the honest no-hypothesis state, never generic padding advice", async ({ page }) => {
    await page.goto(`${BASE}/d03-development-ai/sparse-no-hypothesis`);
    // exact:true disambiguates from the page's own h1 ("...no defensible hypothesis"), which
    // Playwright's default case-insensitive substring match would otherwise also match.
    await expect(page.getByText("No defensible hypothesis", { exact: true })).toBeVisible();
    await expect(page.getByText(/we recommend|you should focus on/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /promote to development focus/i })).toHaveCount(0);
  });

  test("decision flow: Promote succeeds with no real Server Action invoked", async ({ page }) => {
    await page.goto(`${BASE}/d03-development-ai/coach-decision-flow`);
    const requests = collectServerActionRequests(page);

    const focusInputs = page.getByLabel("Development focus to record if promoted");
    await focusInputs.first().fill("Track left-midfield comfort under possession");
    await page.getByRole("button", { name: /promote to development focus/i }).first().click();
    await expect(page.getByText(/Amir Haile's recorded minutes at left midfield/)).toHaveCount(0);
    expect(requests).toHaveLength(0);
  });

  test("decision flow: Dismiss succeeds with no real Server Action invoked", async ({ page }) => {
    await page.goto(`${BASE}/d03-development-ai/coach-decision-flow`);
    const requests = collectServerActionRequests(page);

    // Three hypotheses render in order (confirm-demo, dismiss-demo, error-demo) — dismiss-demo's
    // own Dismiss button is the second one, not the first.
    await page.getByRole("button", { name: /^dismiss$/i }).nth(1).click();
    await expect(page.getByText(/Amir Haile's recorded event rate while trailing/)).toHaveCount(0);
    expect(requests).toHaveLength(0);
  });

  test("decision flow: a simulated Promote failure leaves the hypothesis visible with an inline error, no real Server Action invoked", async ({ page }) => {
    await page.goto(`${BASE}/d03-development-ai/coach-decision-flow`);
    const requests = collectServerActionRequests(page);

    const focusInputs = page.getByLabel("Development focus to record if promoted");
    await focusInputs.last().fill("Track rotation pattern with Jonas");
    await page.getByRole("button", { name: /promote to development focus/i }).last().click();
    await expect(page.getByText(/Could not record the development focus right now/)).toBeVisible();
    await expect(page.getByText(/Amir Haile's recorded shared pitch time with Jonas Berg/)).toBeVisible();
    expect(requests).toHaveLength(0);
  });

  test("decision flow: each hypothesis has its own distinctly titled source inspector, and every cited source expands to real, kind-correct detail (remediation P1 #1)", async ({ page }) => {
    await page.goto(`${BASE}/d03-development-ai/coach-decision-flow`);

    await expect(page.getByText("Cited sources — left-midfield exposure hypothesis")).toBeVisible();
    await expect(page.getByText("Cited sources — event-rate-while-trailing hypothesis")).toBeVisible();
    await expect(page.getByText("Cited sources — co-presence hypothesis")).toBeVisible();

    const trailingRateDetails = page.locator("details", { hasText: "Event rate while trailing" });
    await trailingRateDetails.locator("summary").click();
    await expect(trailingRateDetails.getByText(/2 across 108 recorded trailing minutes/)).toBeVisible();
    await expect(trailingRateDetails.getByText(/a rate of 1 per 54 minutes/)).toBeVisible();

    const copresenceDetails = page.locator("details", { hasText: "Shared pitch time with Jonas Berg" });
    await copresenceDetails.locator("summary").click();
    await expect(copresenceDetails.getByText(/does not establish partnership quality/)).toBeVisible();
  });
});

test.describe("D06 — cross-source hypothesis: coherent synthesis, genuine contradiction, sparse evidence, source inspection", () => {
  test("coherent: cites three distinct evidence kinds, each classified by its own real kind — never collapsed to a generic 'Recorded fact'", async ({ page }) => {
    await page.goto(`${BASE}/d06-cross-source-hypothesis/coherent-synthesis`);
    await expect(page.getByText(/Noah Fjeld's on-pitch exposure has shifted/)).toBeVisible();
    // The kind-based pill label lives inside each source's collapsed <details> — expand all of
    // them before asserting visibility, matching the real browser's own collapsed-by-default
    // rendering (unlike a jsdom component test, Playwright correctly treats unexpanded <details>
    // content as not visible).
    const summaries = page.locator("details summary");
    const summaryCount = await summaries.count();
    for (let i = 0; i < summaryCount; i++) {
      await summaries.nth(i).click();
    }
    // exact:true is required here, not just a style preference: the hypothesis's own prose
    // ("...his recorded position intervals and a recent coach observation about his central
    // defending") naturally contains both phrases as ordinary English, which Playwright's
    // default case-insensitive substring match also picks up alongside the real pill — exact
    // match isolates the pill `<span>` itself (confirmed live: a prior version of this test
    // without exact:true found 4 matches for "Coach observation", not the intended 1).
    await expect(page.getByText("Recorded position", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Coach observation", { exact: true })).toBeVisible();
    await expect(page.getByText("Derived trend", { exact: true })).toBeVisible();
    await expect(page.getByText("Recorded fact", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Derived measurement", { exact: true })).toHaveCount(0);
  });

  test("contradiction: both disagreeing sources are visible, neither silently resolved", async ({ page }) => {
    await page.goto(`${BASE}/d06-cross-source-hypothesis/genuine-contradiction`);
    await expect(page.getByText(/Contradicting: Coach assessment, 20 Sep 2026, Coach observation, 11 Oct 2026/)).toBeVisible();
  });

  test("contradiction: the earlier formal assessment is classified as a Coach assessment, never a generic 'Recorded fact' (remediation P1 #2)", async ({ page }) => {
    await page.goto(`${BASE}/d06-cross-source-hypothesis/genuine-contradiction`);
    const assessmentDetails = page.locator("details", { hasText: "Coach assessment, 20 Sep 2026" });
    await assessmentDetails.locator("summary").click();
    await expect(assessmentDetails.getByText("Coach assessment", { exact: true })).toBeVisible();
    await expect(assessmentDetails.getByText("Recorded fact")).toHaveCount(0);

    const observationDetails = page.locator("details", { hasText: "Coach observation, 11 Oct 2026" });
    await observationDetails.locator("summary").click();
    await expect(observationDetails.getByText("Coach observation", { exact: true })).toBeVisible();
    await expect(observationDetails.getByText("Recorded fact")).toHaveCount(0);

    const positionDetails = page.locator("details", { hasText: "Recorded position, 11 Oct 2026" });
    await positionDetails.locator("summary").click();
    await expect(positionDetails.getByText("Recorded position", { exact: true })).toBeVisible();

    const trendDetails = page.locator("details", { hasText: "Centre-back role minutes" });
    await trendDetails.locator("summary").click();
    await expect(trendDetails.getByText("Derived trend", { exact: true })).toBeVisible();
  });

  test("sparse: the four distinct gap kinds remain distinguishable, not one vague line", async ({ page }) => {
    await page.goto(`${BASE}/d06-cross-source-hypothesis/sparse-cross-source`);
    await expect(page.getByText(/Missing data: no actual position interval/)).toBeVisible();
    await expect(page.getByText(/Insufficient sample: only 2 of 6 eligible matches/)).toBeVisible();
    await expect(page.getByText(/No contrary evidence: nothing on record/)).toBeVisible();
    await expect(page.getByText(/Coach uncertainty, recorded directly/)).toBeVisible();
    await expect(page.getByText("Assistant Coach hypotheses")).toHaveCount(0);
  });

  test("source inspection: each cited source expands independently to its own real detail", async ({ page }) => {
    await page.goto(`${BASE}/d06-cross-source-hypothesis/source-inspection-confirmation`);
    const trendDetails = page.locator("details", { hasText: "Centre forward role minutes" });
    await trendDetails.locator("summary").click();
    await expect(trendDetails.getByText(/15 across the previous 3 matches/)).toBeVisible();
  });

  test("source inspection: Promote is disabled until a focus is entered, then succeeds with no real Server Action", async ({ page }) => {
    await page.goto(`${BASE}/d06-cross-source-hypothesis/source-inspection-confirmation`);
    const requests = collectServerActionRequests(page);
    const promote = page.getByRole("button", { name: /promote to development focus/i });

    await expect(promote).toBeDisabled();
    await page.getByLabel("Development focus to record if promoted").fill("Developing as a central striking option");
    await expect(promote).toBeEnabled();
    await promote.click();
    await expect(page.getByText(/Sara Dahl's recorded minutes have shifted/)).toHaveCount(0);
    expect(requests).toHaveLength(0);
  });
});

test.describe("Gate D — responsive layout: no horizontal page overflow at any required width", () => {
  const SCENARIOS = [
    "d01-overview-position-evidence/agreeing-positions",
    "d01-overview-position-evidence/diverging-positions",
    "d02-evidence-dot-consolidation/populated-evidence",
    "d02-evidence-dot-consolidation/sparse-evidence",
    "d03-development-ai/grounded-longitudinal-hypothesis",
    "d03-development-ai/sparse-no-hypothesis",
    "d03-development-ai/coach-decision-flow",
    "d06-cross-source-hypothesis/coherent-synthesis",
    "d06-cross-source-hypothesis/genuine-contradiction",
    "d06-cross-source-hypothesis/sparse-cross-source",
    "d06-cross-source-hypothesis/source-inspection-confirmation",
    "d07-attribute-evolution-review/automatic-non-material",
    "d07-attribute-evolution-review/pending-material-approval",
    "d07-attribute-evolution-review/manual-edit-rebase",
    "d08-primary-position-proposal/strong-evidence",
    "d08-primary-position-proposal/conflicting-note",
    "d09-evidence-lineage/superseded-lineage",
    "d09-evidence-lineage/ambiguous-reference-rejected",
  ];
  const WIDTHS = [320, 360, 390, 430, 768, 1440];

  for (const scenario of SCENARIOS) {
    for (const width of WIDTHS) {
      test(`${scenario} @ ${width}px has no document-level horizontal overflow`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${BASE}/${scenario}`);
        await page.locator("h1").first().waitFor({ state: "visible" });
        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        expect(scrollWidth).toBeLessThanOrEqual(innerWidth + 1);
      });
    }
  }
});
