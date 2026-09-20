import "server-only";
import { db } from "@/lib/db";
import {
  Prisma,
  AiProviderConnectionStatus,
  type OrganisationAiSettings,
  type AiAdvisorCapability,
} from "@/generated/prisma/client";

/**
 * Data access for `OrganisationAiSettings` (ADR-0148 / 04_ORG_CONNECTION_FLOW.md /
 * 01_LOCKED_DECISIONS.md). AI is disabled by default: no row needs to exist for an organisation
 * with AI off — `ensureOrganisationAiSettings` only creates one lazily, always defaulting every
 * flag to `false` (the Prisma schema's own column defaults), on first real use.
 */

const CAPABILITY_FIELD = {
  ROUND_REVIEW: "roundReviewEnabled",
  LINEUP_REVIEW: "lineupReviewEnabled",
  MATCH_PREP: "matchPrepEnabled",
  POST_MATCH_REVIEW: "postMatchReviewEnabled",
  WEEKLY_TEAM_REVIEW: "weeklyTeamReviewEnabled",
} as const satisfies Record<AiAdvisorCapability, string>;

/** Shared by the job runner and domain triggers alike -- both need "is this exact capability
 * switched on for this org" and must never independently reimplement the enum->column mapping. */
export function isAiCapabilityEnabled(settings: OrganisationAiSettings, capability: AiAdvisorCapability): boolean {
  return settings[CAPABILITY_FIELD[capability]];
}

export class AiMasterEnableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiMasterEnableError";
  }
}

export async function getOrganisationAiSettings(organisationId: string): Promise<OrganisationAiSettings | null> {
  return db.organisationAiSettings.findFirst({ where: { organisationId } });
}

export async function ensureOrganisationAiSettings(organisationId: string): Promise<OrganisationAiSettings> {
  const existing = await getOrganisationAiSettings(organisationId);
  if (existing) return existing;

  try {
    return await db.organisationAiSettings.create({ data: { organisationId } });
  } catch (error) {
    // Lost a create race against a concurrent request for the same organisation — read back the
    // row the other request just created rather than erroring.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const settled = await getOrganisationAiSettings(organisationId);
      if (settled) return settled;
    }
    throw error;
  }
}

/**
 * The master AI switch. Per 04_ORG_CONNECTION_FLOW.md: "Master AI switch can turn on only with
 * an active READY connection." Turning it off is always allowed and never validated.
 */
export async function setAiMasterEnabled(organisationId: string, enabled: boolean): Promise<OrganisationAiSettings> {
  const settings = await ensureOrganisationAiSettings(organisationId);

  if (enabled) {
    if (!settings.activeConnectionId) {
      throw new AiMasterEnableError("AI Advisor cannot be enabled without an active provider connection.");
    }
    const connection = await db.aiProviderConnection.findFirst({
      where: { id: settings.activeConnectionId, organisationId },
      select: { status: true },
    });
    if (!connection || connection.status !== AiProviderConnectionStatus.READY) {
      throw new AiMasterEnableError("AI Advisor can only be enabled once the active connection is ready.");
    }
  }

  return db.organisationAiSettings.update({ where: { organisationId }, data: { enabled } });
}

/**
 * Each of the five capability toggles is independently configurable regardless of the master
 * switch's current state (04_ORG_CONNECTION_FLOW.md: "Each capability toggle remains
 * independently configurable" — execution itself additionally requires the master switch and an
 * active READY connection, enforced separately by the execution pipeline, not here).
 */
export async function setAiCapabilityEnabled(
  organisationId: string,
  capability: AiAdvisorCapability,
  enabled: boolean,
): Promise<OrganisationAiSettings> {
  await ensureOrganisationAiSettings(organisationId);
  const field = CAPABILITY_FIELD[capability];
  return db.organisationAiSettings.update({
    where: { organisationId },
    data: { [field]: enabled },
  });
}

/** Sets (or clears) the organisation's active connection pointer. Does not itself validate the
 * connection's status — callers (model-selection, disconnect, replace-key flows) decide when
 * this is appropriate to call. */
export async function setActiveConnection(
  organisationId: string,
  connectionId: string | null,
): Promise<OrganisationAiSettings> {
  await ensureOrganisationAiSettings(organisationId);
  return db.organisationAiSettings.update({
    where: { organisationId },
    data: { activeConnectionId: connectionId },
  });
}
