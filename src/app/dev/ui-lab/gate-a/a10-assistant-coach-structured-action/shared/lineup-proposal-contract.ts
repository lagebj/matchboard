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
 * extended to the full negative-case checklist an independent technical review required:
 * scope, player/roster membership, slot existence, before-state fidelity, diff validity,
 * evidence existence AND evidence scope, action-kind allowlist, and stale-revision detection.
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
  | "SCOPE_MISMATCH"
  | "UNKNOWN_PLAYER"
  | "PLAYER_NOT_IN_ROSTER"
  | "UNKNOWN_SLOT"
  | "BEFORE_STATE_MISMATCH"
  | "BAD_DIFF"
  | "MISSING_EVIDENCE"
  | "UNKNOWN_EVIDENCE_REF"
  | "EVIDENCE_SCOPE_MISMATCH";

export type LineupProposalValidationContext = {
  matchId: string;
  groupId: string;
  /** The current authoritative source-context identity — compared against the proposal's own
   * `expectedRevision`, never recomputed from scratch (no second fingerprint algorithm here). */
  currentRevision: string;
  /** Every player id that is a real identity in this fixture universe at all — distinct from
   * `rosterPlayerIds` so "doesn't exist" and "exists, but not in this match's squad" are
   * distinguishable rejection codes, per the independent review's explicit requirement. */
  knownPlayerIds: ReadonlySet<string>;
  rosterPlayerIds: ReadonlySet<string>;
  validSlotIds: ReadonlySet<string>;
  /** The slot's actual current occupant in the authoritative projection — compared against
   * `proposal.before.playerId`, never assumed. */
  currentSlotPlayerId: string | null;
  evidenceCatalog: readonly LineupProposalEvidenceSource[];
};

export type LineupProposalValidationResult =
  | { valid: true; proposal: LineupSlotAssignmentProposal; applicability: "APPLICABLE" }
  | { valid: true; proposal: LineupSlotAssignmentProposal; applicability: "STALE"; expectedRevision: string; currentRevision: string }
  | { valid: false; code: LineupProposalRejectionCode; reason: string };

/**
 * Structural/scope validation only — "reject before render" for anything genuinely malformed or
 * out of scope (`12_ACTION_OWNERSHIP_AND_GUARDRAILS.md`'s rule). A stale `expectedRevision` is
 * the one case that stays `valid: true` with `applicability: "STALE"`: the coach may still inspect
 * a stale recommendation's evidence and rationale, but no Apply affordance may ever render for it
 * — enforced by the editor component reading `applicability`, never by this function alone.
 */
export function validateLineupProposal(
  proposal: LineupSlotAssignmentProposal,
  ctx: LineupProposalValidationContext,
): LineupProposalValidationResult {
  if (!proposal.proposalId || !proposal.playerId || !proposal.slotId) {
    return { valid: false, code: "MALFORMED_PAYLOAD", reason: "This proposal is missing required fields." };
  }
  if (proposal.proposalKind !== "ASSIGN_PLAYER_TO_LINEUP_SLOT") {
    return { valid: false, code: "UNSUPPORTED_ACTION_KIND", reason: "This action is not supported." };
  }
  if (proposal.matchId !== ctx.matchId || proposal.groupId !== ctx.groupId) {
    return { valid: false, code: "SCOPE_MISMATCH", reason: "This proposal belongs to another match or group." };
  }
  if (!ctx.knownPlayerIds.has(proposal.playerId)) {
    return { valid: false, code: "UNKNOWN_PLAYER", reason: "The proposed player does not exist in this fixture." };
  }
  if (!ctx.rosterPlayerIds.has(proposal.playerId)) {
    return { valid: false, code: "PLAYER_NOT_IN_ROSTER", reason: "The proposed player is not part of this match's squad." };
  }
  if (!ctx.validSlotIds.has(proposal.slotId)) {
    return { valid: false, code: "UNKNOWN_SLOT", reason: "The target slot does not exist in this match's formation." };
  }
  if (proposal.before.playerId !== ctx.currentSlotPlayerId) {
    return { valid: false, code: "BEFORE_STATE_MISMATCH", reason: "The proposal's expected current state does not match the authoritative plan." };
  }
  if (proposal.after.playerId !== proposal.playerId || proposal.before.playerId === proposal.after.playerId) {
    return { valid: false, code: "BAD_DIFF", reason: "The proposed change is invalid." };
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
