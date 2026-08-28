import { db } from "@/lib/db";
import { getTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { SYSTEM_FORMATIONS } from "./system-formations";

export async function seedSystemFormations() {
  // The tenantRLS extension (db.ts) only injects organisationId into a create's top-level
  // `data`, never into nested relation writes (`slots: { create: [...] }`) -- FormationSlot
  // also requires organisationId, so it must be passed explicitly here or every nested slot
  // create fails its NOT NULL constraint. See ADR-0057's "Prisma where-clause injection".
  const organisationId = getTenantOrganisationId();
  if (!organisationId) {
    throw new Error("seedSystemFormations() requires tenant context (setTenantOrganisationId) to be set.");
  }

  for (const formation of SYSTEM_FORMATIONS) {
    const existing = await db.formation.findFirst({
      where: {
        organisationId,
        name: formation.name,
        gameFormat: formation.gameFormat,
        source: "SYSTEM",
        isArchived: false,
      },
    });

    if (existing) {
      continue;
    }

    const created = await db.formation.create({
      data: {
        organisationId,
        name: formation.name,
        gameFormat: formation.gameFormat,
        source: "SYSTEM",
        description: formation.description ?? null,
        isArchived: false,
        slots: {
          create: formation.slots.map((slot) => ({
            organisationId,
            gridX: slot.gridX,
            gridY: slot.gridY,
            label: slot.label,
            shortLabel: slot.shortLabel,
            roleType: slot.roleType,
            acceptedPositionIds: slot.acceptedPositionIds,
            sortOrder: slot.sortOrder,
          })),
        },
      },
    });

    console.log(`Seeded system formation: ${created.name} (${created.gameFormat})`);
  }
}