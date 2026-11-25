import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { AttributeRebaseRow } from "../shared/attribute-rebase-panel";

/**
 * Gate D register D07, manual-edit-rebase state (new, 2026-11-24 — previously deferred; corrected
 * 2026-11-25). ADR-0160 §5: a manual coach edit rebases one attribute's baseline; it must not
 * affect another attribute's independent evidence progression, has no time-based automatic-
 * resumption expiry, and an explicit lock blocks automation until unlocked. Four rows demonstrate
 * each required behaviour at once rather than four separate states, since they are genuinely one
 * coherent screen a coach would see together (an attribute list), not four unrelated scenarios.
 *
 * Attribute keys corrected 2026-11-25: `finishing`/`workRate` are not valid
 * `RatingAttributeKey` values (`src/lib/ratings/player-rating.ts`'s real 12-attribute domain) —
 * replaced with `oneVOneAttacking`/`effort`, labelled with their real production display strings
 * (`src/components/players/player-attributes-panel.tsx`'s `RATING_LABELS`). The `speed` row's
 * `baselineSource` was also corrected from `"AUTOMATIC"` (invalid — ADR-0160 §4's materiality
 * baseline is always coach-established/approved, never automatic) to a genuine demonstration of
 * `coachBaselineValue` (6) staying fixed while `currentAppliedValue` (7) moves via one legitimate
 * automatic step — proving automation can shift the applied value without silently redefining the
 * approval baseline.
 */
export const identity: FixtureIdentity = {
  scenarioId: "GATE-D-W1-D07-REBASE",
  fixtureId: "gate-d-w1-d07-manual-edit-rebase",
  fixtureVersion: 2,
  fixtureSha256: "28c32eee09c3b0fb2c01c628ef4e9346c1119fc6e80fffacee60545f864030ea",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-11-24T09:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const rows: AttributeRebaseRow[] = [
  {
    attributeKey: "passing",
    attributeLabel: "Passing",
    coachBaselineValue: 9,
    currentAppliedValue: 9,
    baselineSource: "MANUAL_EDIT",
    manualEdit: {
      preEditValue: 7,
      preEditSource: "AUTOMATIC",
      editedAt: "2026-11-10T19:00:00.000Z",
      editedBy: "Coach A",
    },
    matchesSinceBaseline: 2,
    confidenceSinceBaseline: 0.65,
    locked: false,
  },
  {
    attributeKey: "oneVOneAttacking",
    attributeLabel: "1v1 Att.",
    coachBaselineValue: 7,
    currentAppliedValue: 7,
    baselineSource: "MANUAL_EDIT",
    manualEdit: {
      preEditValue: 5,
      preEditSource: "AUTOMATIC",
      editedAt: "2026-10-20T19:00:00.000Z",
      editedBy: "Coach A",
    },
    matchesSinceBaseline: 4,
    confidenceSinceBaseline: 0.81,
    locked: false,
  },
  {
    attributeKey: "speed",
    attributeLabel: "Speed",
    coachBaselineValue: 6,
    currentAppliedValue: 7,
    baselineSource: "COACH_ESTABLISHED",
    matchesSinceBaseline: 5,
    confidenceSinceBaseline: 0.73,
    locked: false,
  },
  {
    attributeKey: "effort",
    attributeLabel: "Effort",
    coachBaselineValue: 8,
    currentAppliedValue: 8,
    baselineSource: "COACH_ESTABLISHED",
    matchesSinceBaseline: 6,
    confidenceSinceBaseline: 0.85,
    locked: true,
  },
];

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "GATE-D-W1-D07-REBASE", rows };
