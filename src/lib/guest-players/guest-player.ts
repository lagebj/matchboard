import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import {
  GUEST_PLAYER_NAME_MAX_LENGTH,
  GUEST_PLAYER_SOURCE_LABEL_MAX_LENGTH,
  GUEST_PLAYER_NOTE_MAX_LENGTH,
} from "./guest-player-constants";

// ADR-0106: GuestPlayer is a reusable, Group-owned external-player identity -- a separate domain
// identity from Player, never Season-scoped, never hard-deleted (see setGuestPlayerActive()).
// Minimum required field: name.

export { GUEST_PLAYER_NAME_MAX_LENGTH, GUEST_PLAYER_SOURCE_LABEL_MAX_LENGTH, GUEST_PLAYER_NOTE_MAX_LENGTH };

export type GuestPlayerRow = {
  id: string;
  footballGroupId: string;
  name: string;
  sourceLabel: string | null;
  note: string | null;
  active: boolean;
  deactivatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateGuestPlayerInput = {
  organisationId: string;
  footballGroupId: string;
  name: string;
  sourceLabel?: string | null;
  note?: string | null;
};

export type UpdateGuestPlayerInput = {
  name?: string;
  sourceLabel?: string | null;
  note?: string | null;
};

export type GuestPlayerValidationResult = { valid: true } | { valid: false; error: string };

function toRow(record: {
  id: string;
  footballGroupId: string;
  name: string;
  sourceLabel: string | null;
  note: string | null;
  active: boolean;
  deactivatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): GuestPlayerRow {
  return {
    id: record.id,
    footballGroupId: record.footballGroupId,
    name: record.name,
    sourceLabel: record.sourceLabel,
    note: record.note,
    active: record.active,
    deactivatedAt: record.deactivatedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function orgWhere(orgFilter: OrgFilterMode): { organisationId: string } {
  return orgFilter.filter;
}

export function validateGuestPlayerFields(fields: {
  name: string;
  sourceLabel?: string | null;
  note?: string | null;
}): GuestPlayerValidationResult {
  const name = fields.name.trim();
  if (!name) {
    return { valid: false, error: "Name is required." };
  }
  if (name.length > GUEST_PLAYER_NAME_MAX_LENGTH) {
    return { valid: false, error: `Name must be ${GUEST_PLAYER_NAME_MAX_LENGTH} characters or fewer.` };
  }

  const sourceLabel = fields.sourceLabel?.trim();
  if (sourceLabel && sourceLabel.length > GUEST_PLAYER_SOURCE_LABEL_MAX_LENGTH) {
    return { valid: false, error: `Source must be ${GUEST_PLAYER_SOURCE_LABEL_MAX_LENGTH} characters or fewer.` };
  }

  const note = fields.note?.trim();
  if (note && note.length > GUEST_PLAYER_NOTE_MAX_LENGTH) {
    return { valid: false, error: `Note must be ${GUEST_PLAYER_NOTE_MAX_LENGTH} characters or fewer.` };
  }

  return { valid: true };
}

export async function validateGuestPlayerCreation(
  input: CreateGuestPlayerInput,
): Promise<GuestPlayerValidationResult> {
  const fieldValidation = validateGuestPlayerFields(input);
  if (!fieldValidation.valid) return fieldValidation;

  const group = await db.footballGroup.findFirst({
    where: { id: input.footballGroupId, organisationId: input.organisationId },
    select: { id: true },
  });
  if (!group) {
    return { valid: false, error: "Group not found." };
  }

  return { valid: true };
}

export async function createGuestPlayer(
  input: CreateGuestPlayerInput,
): Promise<{ success: true; guestPlayer: GuestPlayerRow } | { success: false; error: string }> {
  const validation = await validateGuestPlayerCreation(input);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
    const created = await db.guestPlayer.create({
      data: {
        organisationId: input.organisationId,
        footballGroupId: input.footballGroupId,
        name: input.name.trim(),
        sourceLabel: input.sourceLabel?.trim() || null,
        note: input.note?.trim() || null,
      },
    });

    return { success: true, guestPlayer: toRow(created) };
  } catch (e) {
    return { success: false, error: `Failed to create guest player: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function updateGuestPlayer(
  guestPlayerId: string,
  input: UpdateGuestPlayerInput,
  orgFilter: OrgFilterMode,
): Promise<{ success: true; guestPlayer: GuestPlayerRow } | { success: false; error: string }> {
  const existing = await db.guestPlayer.findFirst({
    where: { id: guestPlayerId, ...orgWhere(orgFilter) },
  });
  if (!existing) {
    return { success: false, error: "Guest player not found." };
  }

  const nextName = input.name !== undefined ? input.name : existing.name;
  const nextSourceLabel = input.sourceLabel !== undefined ? input.sourceLabel : existing.sourceLabel;
  const nextNote = input.note !== undefined ? input.note : existing.note;

  const fieldValidation = validateGuestPlayerFields({
    name: nextName,
    sourceLabel: nextSourceLabel,
    note: nextNote,
  });
  if (!fieldValidation.valid) {
    return { success: false, error: fieldValidation.error };
  }

  try {
    const updated = await db.guestPlayer.update({
      where: { id: guestPlayerId },
      data: {
        ...(input.name !== undefined && { name: input.name.trim() }),
        ...(input.sourceLabel !== undefined && { sourceLabel: input.sourceLabel?.trim() || null }),
        ...(input.note !== undefined && { note: input.note?.trim() || null }),
      },
    });

    return { success: true, guestPlayer: toRow(updated) };
  } catch (e) {
    return { success: false, error: `Failed to update guest player: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function setGuestPlayerActive(
  guestPlayerId: string,
  active: boolean,
  orgFilter: OrgFilterMode,
): Promise<{ success: true; guestPlayer: GuestPlayerRow } | { success: false; error: string }> {
  const existing = await db.guestPlayer.findFirst({
    where: { id: guestPlayerId, ...orgWhere(orgFilter) },
  });
  if (!existing) {
    return { success: false, error: "Guest player not found." };
  }

  if (existing.active === active) {
    return { success: true, guestPlayer: toRow(existing) };
  }

  try {
    const updated = await db.guestPlayer.update({
      where: { id: guestPlayerId },
      data: {
        active,
        deactivatedAt: active ? null : new Date(),
      },
    });

    return { success: true, guestPlayer: toRow(updated) };
  } catch (e) {
    return { success: false, error: `Failed to update guest player status: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function getGroupGuestPlayers(
  footballGroupId: string,
  orgFilter: OrgFilterMode,
  options?: { includeInactive?: boolean },
): Promise<GuestPlayerRow[]> {
  const guestPlayers = await db.guestPlayer.findMany({
    where: {
      footballGroupId,
      ...orgWhere(orgFilter),
      ...(options?.includeInactive ? {} : { active: true }),
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return guestPlayers.map(toRow);
}

export async function getGuestPlayerById(
  guestPlayerId: string,
  orgFilter: OrgFilterMode,
): Promise<GuestPlayerRow | null> {
  const guestPlayer = await db.guestPlayer.findFirst({
    where: { id: guestPlayerId, ...orgWhere(orgFilter) },
  });
  return guestPlayer ? toRow(guestPlayer) : null;
}
