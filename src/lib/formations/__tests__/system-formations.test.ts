import { describe, expect, it } from "vitest";
import { SYSTEM_FORMATIONS } from "../system-formations";
import { canonicalPositionForCell } from "@/domain/positions/grid";
import { canonicalCompactLabel, canonicalFullLabel } from "@/domain/positions/canonical-labels";
import { deriveExactTargetRole } from "@/domain/positions/slot-target";

/**
 * Formation-contract test (ADR-0154 §10/A4): every system formation's non-FREE slot must have a
 * valid cell, a canonical target position, a roleType consistent with that position, and a
 * label/shortLabel that agrees with it — never a contradiction like the old `CB1`/`CB2`/`ST1`/
 * `ST2` numbered duplicates, or a label borrowed from the wrong row (`LW`/`RW` on an
 * attacking-mid-row cell that is really `LAM`/`RAM`).
 */
describe("SYSTEM_FORMATIONS — every non-FREE slot agrees with its canonical cell", () => {
  for (const formation of SYSTEM_FORMATIONS) {
    describe(formation.name, () => {
      for (const slot of formation.slots) {
        if (slot.roleType === "FREE") continue;

        it(`(${slot.gridX},${slot.gridY}) ${slot.roleType} resolves a non-null target`, () => {
          expect(deriveExactTargetRole(slot.roleType, slot.gridX, slot.gridY)).not.toBeNull();
        });

        it(`(${slot.gridX},${slot.gridY}) shortLabel/label agree with the canonical position`, () => {
          const position = canonicalPositionForCell(slot.gridX, slot.gridY);
          expect(position).not.toBeNull();
          expect(slot.shortLabel).toBe(canonicalCompactLabel(position!));
          expect(slot.label).toBe(canonicalFullLabel(position!));
        });
      }
    });
  }

  it("no two slots in the same formation share a gridX/gridY cell", () => {
    for (const formation of SYSTEM_FORMATIONS) {
      const seen = new Set<string>();
      for (const slot of formation.slots) {
        const key = `${slot.gridX},${slot.gridY}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });

  it("no formation uses a numbered-duplicate shortLabel (the old CB1/CB2/ST1/ST2/CM1/CM2 bug)", () => {
    for (const formation of SYSTEM_FORMATIONS) {
      for (const slot of formation.slots) {
        expect(slot.shortLabel).not.toMatch(/\d$/);
      }
    }
  });
});
