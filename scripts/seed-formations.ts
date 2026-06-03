import "dotenv/config";

import { db } from "../src/lib/db";
import { SYSTEM_FORMATIONS } from "../src/lib/formations/system-formations";

async function seed() {
  for (const formation of SYSTEM_FORMATIONS) {
    const existing = await db.formation.findFirst({
      where: {
        name: formation.name,
        gameFormat: formation.gameFormat,
        source: "SYSTEM",
        isArchived: false,
      },
      include: { slots: true },
    });

    if (existing) {
      const slotsMatch = existing.slots.length === formation.slots.length;
      if (slotsMatch) {
        console.log(`Skipping existing: ${formation.name} (${formation.gameFormat})`);
        continue;
      }

      console.log(`Updating existing: ${formation.name} (${formation.gameFormat}) - slot count changed from ${existing.slots.length} to ${formation.slots.length}`);
      await db.formationSlot.deleteMany({ where: { formationId: existing.id } });
      await db.formation.update({
        where: { id: existing.id },
        data: {
          description: formation.description ?? null,
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

    console.log(`Seeded: ${created.name} (${created.gameFormat})`);
  }

  await db.$disconnect();
  console.log("Done.");
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});