import "dotenv/config";
import { db } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";

const SYNTHETIC_ORG_NAME = process.env.SYNTHETIC_ORG_NAME ?? "Matchboard Canary";
const SYNTHETIC_ORG_SLUG = process.env.SYNTHETIC_ORG_SLUG ?? "matchboard-canary";

async function main() {
  try {
    const existing = await db.organisation.findFirst({
      where: { isSynthetic: true },
    });

    if (existing) {
      console.log(`Synthetic organisation already exists: ${existing.name} (${existing.id})`);
      console.log("Skipping creation.");
      return;
    }

    const org = await db.organisation.create({
      data: {
        name: SYNTHETIC_ORG_NAME,
        slug: SYNTHETIC_ORG_SLUG,
        isSynthetic: true,
      },
    });

    console.log(`Created synthetic organisation: ${org.name} (${org.id})`);
    console.log("This organisation is for automation only. It contains fake data and must not contain real player or team information.");
    console.log("");
    console.log("To create a machine principal for this organisation, use the createMachinePrincipalAction server action.");
    console.log(`  organisationId: ${org.id}`);
  } catch (error) {
    console.error("Failed to create synthetic organisation:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();