import type { FixtureIdentity } from "../../shared/fixture-identity";
import { W4_NOW, W4_PLAYER_ID, W4_PLAYER_NAME } from "../../shared/w4-assistant-coach-fixture";
import { safeParseExtractionResponse, validateExtractionSemantics, EXTRACTION_CONTRACT_VERSION, type ExtractionResponse } from "@/lib/evidence/qualitative-evidence-extraction-contract";

/**
 * A11 "coach text → parsed evidence" (register row 38). Uses the REAL `extractionResponseSchema`
 * (`qualitative-evidence-extraction-contract.ts`) to validate this fixture's AI_STRUCTURED output
 * at module load — "reject before render", never a hand-waved shape. The actual extraction call
 * is never made; this is a pre-validated fixture standing in for its output.
 *
 * Independent review finding R1 (round 1): the coach's note gives no temporal qualifier for the
 * composure observation at all ("today" names the match, not a half) — only the team's pressing
 * claim is explicitly scoped to the second half. `period: "SECOND_HALF"` on the composure
 * observation was therefore an unsupported fact the extraction invented. Fixed to `period: null`.
 *
 * Independent review finding A11-F1 (round 2): the SAME observation still used `phase: "BUILD_UP"`
 * — but the note only says Tobias "looked composed receiving the ball in deeper midfield", never
 * naming a tactical phase. "Deeper midfield" describes POSITION, not PHASE; build-up, progression,
 * and even a defensive-transition recovery pass can all involve receiving the ball in deep
 * midfield, so the phase is not determinable from this statement alone. Per the real contract's
 * own rule (`EXTRACTION_STABLE_INSTRUCTIONS` rule 6: "Use phase GENERAL when the tactical phase is
 * not clear from the text"), fixed to `phase: "GENERAL"`.
 */
export const identity: FixtureIdentity = {
  scenarioId: "A11-coach-text-and-parsed-evidence",
  fixtureId: "gate-a-w4-a11-coach-text-and-parsed-evidence",
  fixtureVersion: 3,
  fixtureSha256: "bf55ce359ad4bae716465e5f0b3be4d6ed68c48ff19a143ed7d70ad4d205f781",
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
      // GENERAL, not BUILD_UP: "deeper midfield" names a position, not a tactical phase — the
      // note does not say whether this was build-up, progression, or a transition recovery.
      phase: "GENERAL",
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
