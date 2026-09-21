'use server'

import { resolveOrganisationOwner } from "@/lib/organisations/organisation-resolver";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import {
  getOrganisationAiSettings,
  setAiMasterEnabled,
  setAiCapabilityEnabled,
  AiMasterEnableError,
} from "@/lib/ai/organisation-ai-settings";
import { db } from "@/lib/db";
import type { AiAdvisorCapability, AiProviderConnectionStatus } from "@/generated/prisma/client";
import { fromPrismaAiProviderId, AI_PROVIDER_REGISTRY, type AiProviderWireId } from "@/lib/ai/provider-registry";

/**
 * Server actions backing the Organisation Settings "AI Advisor" section
 * (04_ORG_CONNECTION_FLOW.md / 08_UI_UX_SPEC.md). All connection-lifecycle work that touches a
 * provider credential goes through the dedicated `/api/ai/connections/*` routes instead (called
 * directly from the client, since the browser-direct enrollment step in between cannot go
 * through a server action) — these actions only ever read/write local settings rows and never
 * see a credential.
 */

export type AiAdvisorSettingsSummary = {
  enabled: boolean;
  capabilities: Record<AiAdvisorCapability, boolean>;
  activeConnection: {
    id: string;
    provider: AiProviderWireId;
    providerLabel: string;
    model: string | null;
    status: AiProviderConnectionStatus;
  } | null;
  providerOptions: { id: AiProviderWireId; label: string; credentialLabel: string }[];
};

const CAPABILITIES: AiAdvisorCapability[] = [
  "ROUND_REVIEW",
  "LINEUP_REVIEW",
  "MATCH_PREP",
  "POST_MATCH_REVIEW",
  "WEEKLY_TEAM_REVIEW",
];

const CREDENTIAL_LABELS: Record<AiProviderWireId, string> = {
  openai: "API key",
  anthropic: "API key",
  google_gemini: "Gemini API key",
  mistral: "API key",
  ollama_cloud: "API key",
};

export async function getAiAdvisorSettingsAction(organisationSlug: string): Promise<AiAdvisorSettingsSummary> {
  const ctx = await resolveOrganisationOwner(organisationSlug);
  setTenantOrganisationId(ctx.organisationId);

  const settings = await getOrganisationAiSettings(ctx.organisationId);

  let activeConnection: AiAdvisorSettingsSummary["activeConnection"] = null;
  if (settings?.activeConnectionId) {
    const connection = await db.aiProviderConnection.findFirst({
      where: { id: settings.activeConnectionId, organisationId: ctx.organisationId },
      select: { id: true, provider: true, model: true, status: true },
    });
    if (connection) {
      const wireId = fromPrismaAiProviderId(connection.provider);
      activeConnection = {
        id: connection.id,
        provider: wireId,
        providerLabel: AI_PROVIDER_REGISTRY[wireId].label,
        model: connection.model,
        status: connection.status,
      };
    }
  }

  return {
    enabled: settings?.enabled ?? false,
    capabilities: {
      ROUND_REVIEW: settings?.roundReviewEnabled ?? false,
      LINEUP_REVIEW: settings?.lineupReviewEnabled ?? false,
      MATCH_PREP: settings?.matchPrepEnabled ?? false,
      POST_MATCH_REVIEW: settings?.postMatchReviewEnabled ?? false,
      WEEKLY_TEAM_REVIEW: settings?.weeklyTeamReviewEnabled ?? false,
    },
    activeConnection,
    providerOptions: (["openai", "anthropic", "google_gemini", "mistral", "ollama_cloud"] as const).map((id) => ({
      id,
      label: AI_PROVIDER_REGISTRY[id].label,
      credentialLabel: CREDENTIAL_LABELS[id],
    })),
  };
}

export async function setAiMasterEnabledAction(
  organisationSlug: string,
  enabled: boolean,
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await resolveOrganisationOwner(organisationSlug);
  setTenantOrganisationId(ctx.organisationId);

  try {
    await setAiMasterEnabled(ctx.organisationId, enabled);
    return { success: true };
  } catch (error) {
    if (error instanceof AiMasterEnableError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to update AI Advisor's master switch." };
  }
}

export async function setAiCapabilityEnabledAction(
  organisationSlug: string,
  capability: AiAdvisorCapability,
  enabled: boolean,
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await resolveOrganisationOwner(organisationSlug);
  setTenantOrganisationId(ctx.organisationId);

  if (!CAPABILITIES.includes(capability)) {
    return { success: false, error: "Unknown AI Advisor capability." };
  }

  try {
    await setAiCapabilityEnabled(ctx.organisationId, capability, enabled);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update the capability." };
  }
}
