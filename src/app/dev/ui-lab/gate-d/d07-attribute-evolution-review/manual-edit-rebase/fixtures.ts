import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { AttributeRebaseRow } from "../shared/attribute-rebase-panel";

/**
 * Gate D register D07, manual-edit-rebase state (new, 2026-11-24 — previously deferred). ADR-0160
 * §5: a manual coach edit rebases one attribute's baseline; it must not affect another
 * attribute's independent evidence progression, has no time-based automatic-resumption expiry,
 * and an explicit lock blocks automation until unlocked. Four rows demonstrate each required
 * behaviour at once rather than four separate states, since they are genuinely one coherent
 * screen a coach would see together (an attribute list), not four unrelated scenarios.
 */
export const identity: FixtureIdentity = {
  scenarioId: "GATE-D-W1-D07-REBASE",
  fixtureId: "gate-d-w1-d07-manual-edit-rebase",
  fixtureVersion: 1,
  fixtureSha256: "fe053e6d099589f937a84e8a3e47162104283152edeb1a1c08b85702d6ab14a4",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-11-24T09:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const rows: AttributeRebaseRow[] = [
  {
    attributeKey: "passing",
    attributeLabel: "Passing",
    baselineValue: 9,
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
    attributeKey: "finishing",
    attributeLabel: "Finishing",
    baselineValue: 7,
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
    baselineValue: 6,
    baselineSource: "AUTOMATIC",
    matchesSinceBaseline: 5,
    confidenceSinceBaseline: 0.73,
    locked: false,
  },
  {
    attributeKey: "workRate",
    attributeLabel: "Work rate",
    baselineValue: 8,
    baselineSource: "COACH_ESTABLISHED",
    matchesSinceBaseline: 6,
    confidenceSinceBaseline: 0.85,
    locked: true,
  },
];

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "GATE-D-W1-D07-REBASE", rows };
