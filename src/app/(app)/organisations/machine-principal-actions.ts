'use server'

import { requireCoachAccess } from "@/lib/auth";
import { resolveOrganisationOwner } from "@/lib/organisations/organisation-resolver";
import {
  createMachinePrincipal,
  revokeMachinePrincipal,
  reactivateMachinePrincipal,
  rotateClientSecret,
  getMachinePrincipalsForOrganisation,
  validateScopes,
  type MachineScope,
} from "@/lib/machine-principal/machine-principal";
import {
  logMachinePrincipalCreate,
  logMachinePrincipalRevoke,
  logMachinePrincipalReactivate,
  logMachinePrincipalSecretRotate,
} from "@/lib/security/audit-log";

export async function createMachinePrincipalAction(
  organisationSlug: string,
  name: string,
  description: string | undefined,
  scopes: string[],
) {
  const coach = await requireCoachAccess();

  const ctx = await resolveOrganisationOwner(organisationSlug);

  const { valid, invalid } = validateScopes(scopes);
  if (invalid.length > 0) {
    return { success: false as const, error: `Invalid or forbidden scopes: ${invalid.join(", ")}` };
  }
  if (valid.length === 0) {
    return { success: false as const, error: "At least one valid scope is required." };
  }

  try {
    const result = await createMachinePrincipal({
      organisationId: ctx.organisationId,
      name,
      description,
      scopes: valid as MachineScope[],
    });

    logMachinePrincipalCreate(coach.email ?? "unknown", result.principal.id);

    return {
      success: true as const,
      data: {
        id: result.principal.id,
        name: result.principal.name,
        clientSecret: result.clientSecret,
        clientCredentialPrefix: result.principal.clientCredentialPrefix,
        scopes: result.principal.scopes,
        createdAt: result.principal.createdAt,
      },
    };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to create machine principal" };
  }
}

export async function revokeMachinePrincipalAction(
  organisationSlug: string,
  principalId: string,
) {
  const coach = await requireCoachAccess();

  await resolveOrganisationOwner(organisationSlug);

  try {
    await revokeMachinePrincipal(principalId);
    logMachinePrincipalRevoke(coach.email ?? "unknown", principalId);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to revoke machine principal" };
  }
}

export async function reactivateMachinePrincipalAction(
  organisationSlug: string,
  principalId: string,
) {
  const coach = await requireCoachAccess();

  await resolveOrganisationOwner(organisationSlug);

  try {
    await reactivateMachinePrincipal(principalId);
    logMachinePrincipalReactivate(coach.email ?? "unknown", principalId);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to reactivate machine principal" };
  }
}

export async function rotateMachinePrincipalSecretAction(
  organisationSlug: string,
  principalId: string,
) {
  const coach = await requireCoachAccess();

  await resolveOrganisationOwner(organisationSlug);

  try {
    const result = await rotateClientSecret(principalId);
    logMachinePrincipalSecretRotate(coach.email ?? "unknown", principalId);
    return {
      success: true as const,
      data: {
        clientSecret: result.clientSecret,
        clientCredentialPrefix: result.clientCredentialPrefix,
      },
    };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to rotate secret" };
  }
}

export async function listMachinePrincipalsAction(organisationSlug: string) {
  const coach = await requireCoachAccess();

  const ctx = await resolveOrganisationOwner(organisationSlug);

  const principals = await getMachinePrincipalsForOrganisation(ctx.organisationId);
  return { success: true as const, data: principals };
}