# Gate B W5 — Information Ownership Matrix (B08)

Applies the task brief's §4 ownership table and §10 duplication-audit categories
(**Canonical owner** / **Contextual preview** / **Necessary shared identity** / **Redundant
duplication**) to the real, current Match Details AFTER + Post-Match Report composition, verified
by reading every component's full body (not inferred from names). This document classifies
**current production** (unchanged by this wave — no production route, component, or data loader was
modified), which B08's own candidate composition then preserves, cites as "necessary shared
identity," or corrects within its own candidate pages (per task brief §10).

**As implemented:** B08-AFTER's candidate (`src/app/dev/ui-lab/gate-b/b08-information-ownership/
after/page.tsx`) applies the §3 correction below exactly as prescribed — its own report-status
widget is a status pill + single link only, with the full detail staying owned exclusively by a
dedicated After-match status surface, and a visible on-page disclosure noting the intentional
difference from today's live production (see `VISUAL_VS_CURRENT.md`). Every other verdict in this
document (§1, §2, §4-§9) is reproduced unchanged in the candidate, exactly as recommended — none of
them required a compositional change. Directly asserted by `after/__tests__/page.test.tsx`
(`INTERACTION_AND_STATE_AUDIT.md`).

## 1. Match story (timeline) — Overview vs. Events tab

- **Canonical owner:** Events tab (`MatchEventsPanel` → `MatchTimelineList` against the full
  `data.timeline`, no limit).
- **Contextual preview:** AfterMatchOverview's "Match story" widget renders the **same**
  `MatchTimelineList` component with `limit={10}`, and — only when `data.timeline.length > 10` — a
  real `Link` to the Events tab ("Show all N events →").
- **Verdict: legitimate contextual preview, not redundant duplication.** Confirmed by reading the
  component: it is a real bounded excerpt with a real route to the full owner, exactly matching
  task brief rule 1 ("Overview is curated, not exhaustive"). No correction needed. B08's AFTER
  candidate should reproduce this pattern unchanged.

## 2. Goals/assists/observations counts — Overview "Key figures" vs. Stats tab

- **Overview's "Key figures"** (`MetricStrip`): six-to-eight single numbers — Goals (as the
  score), Players used, Assists (a total count), Substitutions, Position changes, Observations,
  optionally Environment/Match fit. No per-player attribution anywhere in this widget.
- **Stats tab** (`MatchStatsPanel`): per-scorer and per-assist-provider **lists**
  (`AggregateList`, name + count, plus an explicit "Unattributed" row), attendance
  present/no-show counts, and the observations total.
- **Verdict: necessary shared identity + legitimate split, not redundant.** The two surfaces
  report overlapping *topics* (goals, assists, observations) but at genuinely different grains —
  Overview is a scoreboard-style rollup (aggregate counts only, no names), Stats is the
  canonical per-player attribution owner. No player name or per-player count is duplicated. This
  matches task brief rule 7 ("repetition must serve a different purpose") — the purpose here is a
  glanceable summary vs. the full attributed breakdown. No correction needed.

## 3. Report status + continue/view-report entry point — Overview vs. "After match" tab

**This is the flagship finding of this audit — a real, verified redundant-duplication candidate on
current production, not a hypothetical.**

- **AfterMatchOverview** (bottom row, 3 widgets) includes its own **"Post-match report" widget**:
  a status label (`reportStatusLabel()`: "Locked" / "Needs work" / "Not started") and a button —
  "View full report" (locked) or "Continue report" (not locked) — linking to `postMatchHref`
  (`/post-match`). The same row's sibling "Team reflection" widget separately shows
  "Recorded"/"Not recorded" plus the reflection rating pills when recorded.
- **`MatchAfterMatchPanel`** ("After match" tab) — its own doc comment states its job exactly:
  *"Compact report status, integrity status, reflection/observation summary and deep link to
  `/post-match`. An entry/summary surface, never a clone of the report editor."* It renders: an
  unresolved-live-action integrity banner, a goal-attribution-gap banner, and a "Report status"
  surface with four summary rows (**Team reflection: Complete/Not recorded**, Football
  observations count, Timing review status, Out-of-range events count) and the same
  "Continue report"/"View full report" button to the same `/post-match` href.
- **Overlap, verified field-by-field:** both widgets independently (a) state whether team
  reflection exists, (b) provide a button with the same two labels to the same destination. The
  "After match" tab is strictly a superset in content (it adds the two integrity banners, timing
  review, out-of-range events — none of which Overview shows at all) and is explicitly documented
  as the canonical "report status" owner. Overview's own separate widget duplicates exactly the
  two facts the After-match tab already owns (reflection status, report-continuation CTA) with no
  added information of its own.
- **Verdict: redundant duplication under task brief rule 1/7 — the same navigational job (report
  status + CTA) is implemented twice on the same AFTER surface with no distinct purpose for the
  second copy.** Recommended correction for B08's own candidate composition (not a change to
  production in this wave, per §12 "Production safety boundaries" — recorded here as a verified
  finding to carry into the candidate, and as a disclosed production dependency, not silently
  fixed in `main`): Overview's bottom-row "Post-match report" widget becomes a **lighter**
  identity-only pointer (status pill + link, matching the ownership table's "Report completeness
  and integrity → Post-Match Report; preview in AFTER: status + actionable warning"), while the
  full status/integrity detail (reflection complete, observations, timing, out-of-range, the two
  banners) stays owned exclusively by the "After match" tab — i.e. Overview stops repeating facts
  the dedicated tab already owns, keeping only enough to tell the coach *that* something needs
  attention, not *what*. This is a UI-Lab-candidate-level correction (§10: "eliminated within the
  proposed candidate composition"), not a claim that production itself is being changed.

## 4. Team reflection content — Overview's "Team reflection" widget vs. "After match" tab vs. Report Debrief tab

- **Overview**: shows the four rating pills (Effort/Cohesion/Positional shape/Recovery) when a
  `TeamReflection` row exists — read-only.
- **After match tab**: shows only whether reflection "Complete"/"Not recorded" (one word, no
  ratings) — already a bounded preview relative to Overview, not a duplicate of Overview's own
  pill detail.
- **Post-Match Report's Debrief tab** (`PostMatchDebrief`): the actual editable (DRAFT) or
  read-only (COMPLETED) source document the ratings above are mapped *from*
  (`map-to-canonical.ts`, ADR-0152 §3) — the canonical owner.
- **Verdict: legitimate three-tier preview, not redundant.** Debrief tab owns the editable source;
  Overview previews it as rating pills; After-match tab previews it as a single completeness word.
  Each tier adds strictly less detail than the one before it. No correction needed.

## 5. Coaching-intent review + Assistant Coach — Overview only

- Single owner: AfterMatchOverview's "Coaching intent review" widget (stated intent category/note,
  read from the match's own stored coaching intent — Class 1 Fact) plus the embedded, real,
  unmodified `CompletedMatchAdvisorPanel`/`AdvisorPanelReviewing`/`AdvisorPanelUnavailable` (Class
  4 Assistant Coach hypothesis, ADR-0152/0157). Not duplicated anywhere else in Match Details or
  the Report. **Verdict: necessary shared identity / single owner, no action needed.** B08-AFTER
  should reuse this widget's real component composition unchanged — B07 already did exactly this
  and the evidence-source footer already keeps Class 1 and Class 4 visually distinguishable.

## 6. "What this match added" — Overview only

Single owner, `WhatThisMatchAddedPanel`, gated on real computed material change (new observations,
new opponent encounter, first-time canonical positions) per ADR-0157 C6. Not duplicated.
**Verdict: no action needed.**

## 7. Plan vs. reality / Match flow — Overview only, each its own dedicated panel

`PlanVsRealityPanel` and `MatchFlowPanel` are each single-owner, self-fetching (`PlanVsRealityPanel`
takes only `matchId`/`teamId` — it loads its own data) or derived directly from
`data.timeline` (`MatchFlowPanel`). Not duplicated against Events/Stats — `MatchFlowPanel` reads
the same canonical timeline array, but its own job (chronological score/momentum-free "flow"
narrative) is a materially different presentation from the raw event list, matching ADR-0157 C6's
explicit "factual score/event 'Match flow' chronology (no momentum invention)" scope. **Verdict:
necessary shared identity (same source array, different presentation purpose) — no action needed.**

## 8. Final lineup (read-only) — Overview only (AFTER); Overview only (BEFORE, as the live planning pitch)

Single real component (`MatchTacticsPanel`) in both lifecycle states, `planningEditable={false}`
in AFTER. Not duplicated on the Tactics tab, which (per ADR-0147 §7) owns only coaching-intent/
match-format controls plus its *own* read-only formation summary — a distinct, smaller artifact,
not the pitch renderer itself. **Verdict: no action needed**, consistent with ADR-0147 §7's own
"neither forks nor duplicates the pitch renderer" statement, re-confirmed here against the real
AFTER-side component tree.

## 9. Report Timeline tab vs. Match Details Events tab

Both render the literal same `MatchTimelineList` component, fed the same
`get-match-detail-after-data.ts`-sourced `data.timeline` array (ADR-0147 §3: "reused verbatim" read
model). **Verdict: necessary shared identity, not duplication** — it is the same canonical fact
shown in both the match's own record and the report's own reconciliation view, which the task
brief's own ownership table explicitly allows ("a result shown in the match header and a result
shown within report reconciliation is justified").

## Summary disposition for B08's candidate composition

| Pair | Verdict | Action in B08 candidate |
|---|---|---|
| Overview Match story (§1) | Contextual preview | Reproduce unchanged |
| Overview Key figures vs. Stats (§2) | Necessary split | Reproduce unchanged |
| **Overview report-status widget vs. After-match tab (§3)** | **Redundant duplication** | **Lighten Overview's widget to status+link only; keep full detail on After-match tab exclusively** |
| Team reflection 3-tier preview (§4) | Legitimate tiered preview | Reproduce unchanged |
| Coaching intent / Assistant Coach (§5) | Single owner | Reuse real component unchanged |
| What this match added (§6) | Single owner | Reuse unchanged |
| Plan vs reality / Match flow (§7) | Necessary shared identity | Reuse unchanged |
| Final lineup (§8) | Single owner | Reuse unchanged |
| Report Timeline vs. Events (§9) | Necessary shared identity | Reuse unchanged |

Only §3 requires an actual compositional change inside the B08 candidate pages; every other pair
on this surface already satisfies "no competing ownership" (the task brief's actual acceptance
criterion — not zero repetition).
