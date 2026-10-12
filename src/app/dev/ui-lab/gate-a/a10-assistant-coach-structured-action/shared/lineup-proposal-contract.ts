import { z } from "zod";

/**
 * A10 structured lineup-proposal contract — UI Lab-only, explicitly provisional design (register
 * row 37's own `blocking_note`: "Interactive prototype cannot prove production revalidation").
 * This is NOT a new production AI response schema; see `CURRENT_STATE_AUDIT.md` item 5 for the
 * verified absence of any real structured-proposal capability this models against.
 *
 * Reuses the evidence-grammar vocabulary A04 established (`a04-evidence-grammar/shared/
 * coverage.ts`'s `SourceRecord` shape: provenance/scope/fieldLabel/fieldValue/coverage) rather
 * than inventing an unrelated one — but as fresh A10-owned types, not an import, matching this
 * wave's own established "different concept family, no hidden coupling" principle (see this
 * file's sibling `lineup-proposal-editor.tsx` doc comment).
 *
 * Mirrors the handoff bundle's own `reference/w4-types.ts` `validateProposalShape` pattern,
 * extended across two independent technical review rounds to: scope, player/roster membership,
 * exact-slot occupancy (not a single hardcoded slot — second-round finding N1), duplicate-
 * assignment prevention, diff validity, evidence existence/scope/subject-relationship, action-kind
 * and producer allowlists, stale-revision detection, and a non-throwing runtime shape boundary for
 * genuinely unknown input (second-round finding N4).
 *
 * Validation here does **not** decide permission, eligibility, or planning-boundary outcomes —
 * those remain predeclared fixture facts/responses (`PERMISSION_DENIED`/`CONFLICT`/
 * `PLANNING_CLOSED`/`SERVER_ERROR` via `useFixtureOperation`). This module only establishes
 * whether a proposal is *structurally well-formed and in scope* — a second rules engine for
 * authorization would be exactly the "AI said player is eligible as permission proof" pattern
 * `06_STRUCTURED_PROPOSAL_AND_OPERATION_CONTRACT.md` explicitly rejects.
 */

export type EvidenceSourceKind = "RECORDED_MATCH" | "COACH_DECLARED" | "DEVELOPMENT_EVIDENCE" | "DETERMINISTIC_DERIVATION";
export type EvidenceCoverage = "COMPLETE" | "PARTIAL" | "NOT_RECORDED" | "UNKNOWN" | "NOT_APPLICABLE";

/** One concrete, inspectable source record a proposal's `evidenceRefs` may cite. */
export type LineupProposalEvidenceSource = {
  sourceId: string;
  matchId: string;
  groupId: string;
  playerId: string | null;
  kind: EvidenceSourceKind;
  /** What field this record actually holds, e.g. "RCM slot occupant". */
  fieldLabel: string;
  fieldValue: string;
  coverage: EvidenceCoverage;
  /** Which part of the proposal this source supports — never left for the reader to guess. */
  supports: string;
};

export type LineupSlotAssignmentProposal = {
  proposalId: string;
  insightId: string;
  proposalKind: "ASSIGN_PLAYER_TO_LINEUP_SLOT";
  proposedBy: "AI";
  matchId: string;
  groupId: string;
  /** Source-context identity the proposal was generated against — compared to the current
   * authoritative revision to detect staleness. Stands in for a real fingerprint
   * (`src/lib/ai/fingerprints.ts`'s `computeSourceFingerprint`, never imported here — server-only). */
  expectedRevision: string;
  slotId: string;
  playerId: string;
  before: { playerId: string | null };
  after: { playerId: string };
  evidenceRefs: readonly string[];
  rationale: string;
  limitations: readonly string[];
  expectedConsequences: readonly string[];
};

export type LineupProposalRejectionCode =
  | "MALFORMED_PAYLOAD"
  | "UNSUPPORTED_ACTION_KIND"
  | "UNSUPPORTED_PRODUCER"
  | "SCOPE_MISMATCH"
  | "UNKNOWN_PLAYER"
  | "PLAYER_NOT_IN_ROSTER"
  | "UNKNOWN_SLOT"
  | "BEFORE_STATE_MISMATCH"
  | "BAD_DIFF"
  | "DUPLICATE_ASSIGNMENT"
  | "MISSING_EVIDENCE"
  | "UNKNOWN_EVIDENCE_REF"
  | "EVIDENCE_SCOPE_MISMATCH"
  | "EVIDENCE_SUBJECT_MISMATCH";

/**
 * Second-round finding N1: a single `currentSlotPlayerId` field let a proposal targeting any slot
 * validate against one hardcoded slot's occupant (RCM's empty state). `slotOccupants` is indexed
 * by the real `slotId` so every proposal is checked against the occupant of the exact slot it
 * actually names. Callers build this from the SAME `matchW3PlanningPitchAssignments` projection
 * the editor renders the pitch from (`lineup-proposal-fixture.ts`) — never a second, independently
 * authored list, so validation, preview, and simulated application can never silently diverge.
 */
export type LineupProposalValidationContext = {
  matchId: string;
  groupId: string;
  /** The current authoritative source-context identity — compared against the proposal's own
   * `expectedRevision`, never recomputed from scratch (no second fingerprint algorithm here). */
  currentRevision: string;
  /** Every player id that is a real identity in this fixture universe at all — distinct from
   * `rosterPlayerIds` so "doesn't exist" and "exists, but not in this match's squad" are
   * distinguishable rejection codes, per the first review round's explicit requirement. */
  knownPlayerIds: ReadonlySet<string>;
  rosterPlayerIds: ReadonlySet<string>;
  /** Every real slot id -> its current authoritative occupant (`null` if unfilled). Absence of a
   * key is treated identically to an unfilled slot, but every slot this match's formation defines
   * should have an explicit entry — see `lineup-proposal-fixture.ts`. */
  slotOccupants: ReadonlyMap<string, string | null>;
  evidenceCatalog: readonly LineupProposalEvidenceSource[];
};

export type LineupProposalValidationResult =
  | { valid: true; proposal: LineupSlotAssignmentProposal; applicability: "APPLICABLE" }
  | { valid: true; proposal: LineupSlotAssignmentProposal; applicability: "STALE"; expectedRevision: string; currentRevision: string }
  | { valid: false; code: LineupProposalRejectionCode; reason: string };

/**
 * Second-round finding N4: the previous signature accepted `LineupSlotAssignmentProposal` directly
 * — a compile-time-only guarantee. A genuinely malformed runtime payload (missing `before`, wrong
 * field types, extra fields) could reach semantic checks and throw (e.g. reading
 * `proposal.before.playerId` off an object with no `before`). This schema is the one runtime shape
 * boundary every proposal crosses before any semantic check runs; `.strict()` on every level
 * rejects unexpected fields rather than silently ignoring them. `proposalKind`/`proposedBy` are
 * deliberately plain nonempty strings here (not `z.literal`), so an unsupported value still reaches
 * the SAME distinct `UNSUPPORTED_ACTION_KIND`/`UNSUPPORTED_PRODUCER` semantic codes the first
 * review round already established — a genuinely malformed shape (wrong type, missing field) is
 * the only thing that resolves to the generic `MALFORMED_PAYLOAD`.
 */
const proposalShapeSchema = z
  .object({
    proposalId: z.string().min(1),
    insightId: z.string().min(1),
    proposalKind: z.string().min(1),
    proposedBy: z.string().min(1),
    matchId: z.string().min(1),
    groupId: z.string().min(1),
    expectedRevision: z.string().min(1),
    slotId: z.string().min(1),
    playerId: z.string().min(1),
    before: z.object({ playerId: z.string().min(1).nullable() }).strict(),
    after: z.object({ playerId: z.string().min(1) }).strict(),
    evidenceRefs: z.array(z.string().min(1)),
    rationale: z.string().min(1),
    limitations: z.array(z.string()),
    expectedConsequences: z.array(z.string()),
  })
  .strict();

type ProposalShape = z.infer<typeof proposalShapeSchema>;

/**
 * Structural/scope validation only — "reject before render" for anything genuinely malformed or
 * out of scope (`12_ACTION_OWNERSHIP_AND_GUARDRAILS.md`'s rule). A stale `expectedRevision` is
 * the one case that stays `valid: true` with `applicability: "STALE"`: the coach may still inspect
 * a stale recommendation's evidence and rationale, but no Apply affordance may ever render for it
 * — enforced by the editor component reading `applicability`, never by this function alone.
 *
 * Accepts `unknown` (second-round finding N4) — never throws; every malformed input, including
 * `null`/`undefined`/a string/an array/a missing nested object, resolves to a typed
 * `{ valid: false, code, reason }` via `proposalShapeSchema.safeParse`.
 */
export function validateLineupProposal(raw: unknown, ctx: LineupProposalValidationContext): LineupProposalValidationResult {
  const shape = proposalShapeSchema.safeParse(raw);
  if (!shape.success) {
    const firstIssue = shape.error.issues[0];
    const path = firstIssue?.path.join(".") || "(root)";
    return { valid: false, code: "MALFORMED_PAYLOAD", reason: `This proposal is malformed at "${path}": ${firstIssue?.message ?? "invalid shape"}.` };
  }
  return validateProposalSemantics(shape.data, ctx);
}

function validateProposalSemantics(shaped: ProposalShape, ctx: LineupProposalValidationContext): LineupProposalValidationResult {
  if (shaped.proposalKind !== "ASSIGN_PLAYER_TO_LINEUP_SLOT") {
    return { valid: false, code: "UNSUPPORTED_ACTION_KIND", reason: "This action is not supported." };
  }
  if (shaped.proposedBy !== "AI") {
    return { valid: false, code: "UNSUPPORTED_PRODUCER", reason: "This proposal's producer is not recognised." };
  }
  // From here, proposalKind/proposedBy are known-good literals — safe to treat as the exported type.
  const proposal = shaped as unknown as LineupSlotAssignmentProposal;

  if (proposal.matchId !== ctx.matchId || proposal.groupId !== ctx.groupId) {
    return { valid: false, code: "SCOPE_MISMATCH", reason: "This proposal belongs to another match or group." };
  }
  if (!ctx.knownPlayerIds.has(proposal.playerId)) {
    return { valid: false, code: "UNKNOWN_PLAYER", reason: "The proposed player does not exist in this fixture." };
  }
  if (!ctx.rosterPlayerIds.has(proposal.playerId)) {
    return { valid: false, code: "PLAYER_NOT_IN_ROSTER", reason: "The proposed player is not part of this match's squad." };
  }
  if (!ctx.slotOccupants.has(proposal.slotId)) {
    return { valid: false, code: "UNKNOWN_SLOT", reason: "The target slot does not exist in this match's formation." };
  }

  // N1: resolve the occupant of the EXACT slot the proposal names, never a single fixed slot.
  const targetSlotOccupant = ctx.slotOccupants.get(proposal.slotId) ?? null;
  if (proposal.before.playerId !== targetSlotOccupant) {
    return { valid: false, code: "BEFORE_STATE_MISMATCH", reason: "The proposal's expected current state does not match the authoritative plan." };
  }
  if (proposal.after.playerId !== proposal.playerId || proposal.before.playerId === proposal.after.playerId) {
    return { valid: false, code: "BAD_DIFF", reason: "The proposed change is invalid." };
  }

  // The proposed player must not already occupy a DIFFERENT slot — this candidate only models a
  // plain assignment into an empty slot, never a silent two-slot duplication or an (unmodelled)
  // relocation. A relocation would need its own explicitly typed proposal kind.
  for (const [slotId, occupantId] of ctx.slotOccupants) {
    if (slotId !== proposal.slotId && occupantId === proposal.playerId) {
      return { valid: false, code: "DUPLICATE_ASSIGNMENT", reason: "The proposed player already occupies a different tactical slot." };
    }
  }

  if (proposal.evidenceRefs.length === 0) {
    return { valid: false, code: "MISSING_EVIDENCE", reason: "The proposal lacks verifiable evidence." };
  }
  const evidenceById = new Map(ctx.evidenceCatalog.map((e) => [e.sourceId, e]));
  for (const ref of proposal.evidenceRefs) {
    const source = evidenceById.get(ref);
    if (!source) {
      return { valid: false, code: "UNKNOWN_EVIDENCE_REF", reason: "The proposal cites evidence that does not exist." };
    }
    if (source.matchId !== proposal.matchId || source.groupId !== proposal.groupId) {
      return { valid: false, code: "EVIDENCE_SCOPE_MISMATCH", reason: "The proposal cites evidence from another match or group." };
    }
    // Player-specific evidence (playerId !== null) must concern the SAME player the proposal is
    // about — match-level evidence (playerId === null) has no subject to mismatch.
    if (source.playerId !== null && source.playerId !== proposal.playerId) {
      return { valid: false, code: "EVIDENCE_SUBJECT_MISMATCH", reason: "The proposal cites evidence about a different player." };
    }
  }

  if (proposal.expectedRevision !== ctx.currentRevision) {
    return { valid: true, proposal, applicability: "STALE", expectedRevision: proposal.expectedRevision, currentRevision: ctx.currentRevision };
  }
  return { valid: true, proposal, applicability: "APPLICABLE" };
}

/** Resolves a proposal's `evidenceRefs` into their full inspectable source records — used by the
 * editor's evidence inspector, never a raw string count alone. */
export function resolveProposalEvidence(
  proposal: LineupSlotAssignmentProposal,
  catalog: readonly LineupProposalEvidenceSource[],
): LineupProposalEvidenceSource[] {
  const byId = new Map(catalog.map((e) => [e.sourceId, e]));
  return proposal.evidenceRefs.map((ref) => byId.get(ref)).filter((e): e is LineupProposalEvidenceSource => Boolean(e));
}
