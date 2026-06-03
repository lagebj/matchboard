import { db } from "@/lib/db";
import { SYSTEM_FORMATIONS } from "./system-formations";

export async function seedSystemFormations() {
  for (const formation of SYSTEM_FORMATIONS) {
    const existing = await db.formation.findFirst({
      where: {
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
        name: formation.name,
        gameFormat: formation.gameFormat,
        source: "SYSTEM",
        description: formation.description ?? null,
        isArchived: false,
        slots: {
          create: formation.slots.map((slot) => ({
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