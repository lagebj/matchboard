import type { FixtureIdentity } from "../../shared/fixture-identity";
import { W4_NOW, W4_PLAYER_ID, W4_PLAYER_NAME } from "../../shared/w4-assistant-coach-fixture";
import { safeParseExtractionResponse, validateExtractionSemantics, EXTRACTION_CONTRACT_VERSION, type ExtractionResponse } from "@/lib/evidence/qualitative-evidence-extraction-contract";

/**
 * A11 "coach text → parsed evidence" (register row 38). Uses the REAL `extractionResponseSchema`
 * (`qualitative-evidence-extraction-contract.ts`) to validate this fixture's AI_STRUCTURED output
 * at module load — "reject before render", never a hand-waved shape. The actual extraction call
 * is never made; this is a pre-validated fixture standing in for its output.
 *
 * Independent review finding R1: the coach's note gives no temporal qualifier for the composure
 * observation at all ("today" names the match, not a half) — only the team's pressing claim is
 * explicitly scoped to the second half. `period: "SECOND_HALF"` on the composure observation was
 * therefore an unsupported fact the extraction invented, not something the coach actually said.
 * Fixed to `period: null`, mirroring the real contract's own rule for an unclear `phase`
 * (`EXTRACTION_STABLE_INSTRUCTIONS` rule 6: "Use phase GENERAL when the tactical phase is not
 * clear from the text") applied to `period` instead — never resolve an attribute the source text
 * does not actually support.
 */
export const identity: FixtureIdentity = {
  scenarioId: "A11-coach-text-and-parsed-evidence",
  fixtureId: "gate-a-w4-a11-coach-text-and-parsed-evidence",
  fixtureVersion: 2,
  fixtureSha256: "35a04f40b635247c33f6f7ebef262e0c43c3f5587e541eb00c710ba7373b9086",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: W4_NOW.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const coachNote = {
  authorLabel: "Coach, post-match note",
  occurredAtLabel: "2026-10-04, after the Fjordvik Blå match",
  text: `${W4_PLAYER_NAME} looked composed receiving the ball in deeper midfield today, though I'm not fully sure it translates to a full match at RCM. The team pressed more cohesively in the second half.`,
};

const rawExtraction: ExtractionResponse = {
  version: EXTRACTION_CONTRACT_VERSION,
  observations: [
    {
      scope: "PLAYER",
      playerRef: W4_PLAYER_ID,
      secondaryPlayerRef: null,
      phase: "BUILD_UP",
      polarity: "WORKING",
      // No period qualifier: the note never says when this happened, only that it did.
      period: null,
      statement: `${W4_PLAYER_NAME} looked composed receiving the ball in deeper midfield.`,
      explicitness: "EXPLICIT",
    },
    {
      scope: "PLAYER",
      playerRef: W4_PLAYER_ID,
      secondaryPlayerRef: null,
      phase: "GENERAL",
      polarity: "UNCERTAIN",
      period: null,
      statement: `Whether this translates to a full match at RCM for ${W4_PLAYER_NAME} is not yet clear.`,
      explicitness: "TENTATIVE",
    },
    {
      scope: "TEAM",
      playerRef: null,
      secondaryPlayerRef: null,
      phase: "PRESSING",
      polarity: "WORKING",
      period: "SECOND_HALF",
      statement: "The team pressed more cohesively in the second half.",
      explicitness: "EXPLICIT",
    },
  ],
};

const parsed = safeParseExtractionResponse(rawExtraction);
if (!parsed.success) {
  throw new Error(`A11 coach-text-and-parsed-evidence fixture failed schema validation: ${parsed.error.message}`);
}
const semantics = validateExtractionSemantics(parsed.data, new Set([W4_PLAYER_ID]));
if (!semantics.valid) {
  throw new Error(`A11 coach-text-and-parsed-evidence fixture failed semantic validation: ${semantics.reason}`);
}

export const extraction = parsed.data;
export const playerNameByRef: Record<string, string> = { [W4_PLAYER_ID]: W4_PLAYER_NAME };

export const rawRecordsForHash = { coachNote, rawExtraction };
