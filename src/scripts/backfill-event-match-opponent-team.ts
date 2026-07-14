import "dotenv/config";
import { db } from "@/lib/db";
import { normalizeOpponentName, cleanOpponentDisplayName } from "@/lib/opponents/opponent-team";

async function backfillEventMatchOpponentTeam() {
  console.log("Backfilling EventMatch.opponentTeamId from opponentName strings...");

  const eventMatches = await db.eventMatch.findMany({
    where: {
      opponentTeamId: null,
      opponentName: { not: "" },
    },
    select: { id: true, opponentName: true },
  });

  console.log(`Found ${eventMatches.length} event matches without opponentTeamId.`);

  let created = 0;
  let linked = 0;
  let skipped = 0;

  for (const em of eventMatches) {
    const normalizedName = normalizeOpponentName(em.opponentName);
    if (!normalizedName) {
      skipped++;
      continue;
    }

    const existing = await db.opponentTeam.findUnique({
      where: { normalizedName },
    });

    let opponentTeamId: string;
    if (existing) {
      opponentTeamId = existing.id;
      linked++;
    } else {
      const displayName = cleanOpponentDisplayName(em.opponentName);
      const created_team = await db.opponentTeam.create({
        data: { displayName, normalizedName },
      });
      opponentTeamId = created_team.id;
      created++;
    }

    await db.eventMatch.update({
      where: { id: em.id },
      data: { opponentTeamId },
    });
  }

  console.log(`Done. Created ${created} new opponent teams, linked ${linked} existing, skipped ${skipped}.`);
}

backfillEventMatchOpponentTeam()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());