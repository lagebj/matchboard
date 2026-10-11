import type { FixtureIdentity } from "../../shared/fixture-identity";
import { W4_NOW, W4_PLAYER_ID, W4_PLAYER_NAME } from "../../shared/w4-assistant-coach-fixture";
import { safeParseExtractionResponse, validateExtractionSemantics, EXTRACTION_CONTRACT_VERSION, type ExtractionResponse } from "@/lib/evidence/qualitative-evidence-extraction-contract";

/**
 * A11 "coach text → parsed evidence" (register row 38). Uses the REAL `extractionResponseSchema`
 * (`qualitative-evidence-extraction-contract.ts`) to validate this fixture's AI_STRUCTURED output
 * at module load — "reject before render", never a hand-waved shape. The actual extraction call
 * is never made; this is a pre-validated fixture standing in for its output.
 */
export const identity: FixtureIdentity = {
  scenarioId: "A11-coach-text-and-parsed-evidence",
  fixtureId: "gate-a-w4-a11-coach-text-and-parsed-evidence",
  fixtureVersion: 1,
  fixtureSha256: "1780504e3e9ed457b239d7b9c498985bc10ca279ad4655174558dadc43f2fc8c",
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
      period: "SECOND_HALF",
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
