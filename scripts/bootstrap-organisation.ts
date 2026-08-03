/**
 * Bootstrap Organisation Script
 *
 * Creates a bootstrap organisation and an OWNER membership for the
 * bootstrap user. Idempotent — safe to run multiple times.
 *
 * organisationId is non-nullable in the schema; row assignment is handled
 * by the database migration, not by this script.
 *
 * Usage:
 *   npx tsx scripts/bootstrap-organisation.ts
 *
 * Required environment variables:
 *   DATABASE_URL        — database connection
 *   BOOTSTRAP_OWNER_EMAIL — email of the user who will be the org OWNER
 *   BOOTSTRAP_ORGANIZATION_NAME — name of the bootstrap organisation
 *   BOOTSTRAP_ORGANIZATION_SLUG — URL-safe slug for the bootstrap organisation
 */

import { db } from "../src/lib/db";

const BOOTSTRAP_ORG_NAME = process.env.BOOTSTRAP_ORGANIZATION_NAME ?? "Default Club";
const BOOTSTRAP_ORG_SLUG = process.env.BOOTSTRAP_ORGANIZATION_SLUG ?? "default-club";
const BOOTSTRAP_OWNER_EMAIL = process.env.BOOTSTRAP_OWNER_EMAIL;

if (!BOOTSTRAP_OWNER_EMAIL) {
  console.error("BOOTSTRAP_OWNER_EMAIL is required.");
  process.exit(1);
}

async function main() {
  try {
    console.log("Starting bootstrap organisation migration...");
    console.log(`  Organisation: ${BOOTSTRAP_ORG_NAME} (${BOOTSTRAP_ORG_SLUG})`);
    console.log(`  Owner email: ${BOOTSTRAP_OWNER_EMAIL}`);

    const user = await db.user.findFirst({
      where: { email: BOOTSTRAP_OWNER_EMAIL },
    });

    if (!user) {
      console.error(`User with email ${BOOTSTRAP_OWNER_EMAIL} not found. Create the user first.`);
      process.exit(1);
    }

    const existingOrg = await db.organisation.findFirst({
      where: { slug: BOOTSTRAP_ORG_SLUG },
    });

    let orgId: string;

    if (existingOrg) {
      orgId = existingOrg.id;
      console.log(`  Organisation already exists: ${existingOrg.name} (${existingOrg.id})`);
    } else {
      const org = await db.organisation.create({
        data: {
          name: BOOTSTRAP_ORG_NAME,
          slug: BOOTSTRAP_ORG_SLUG,
          memberships: {
            create: {
              userId: user.id,
              role: "OWNER",
            },
          },
        },
      });
      orgId = org.id;
      console.log(`  Created organisation: ${org.name} (${org.id})`);
    }

    const existingMembership = await db.organisationMembership.findUnique({
      where: { userId_organisationId: { userId: user.id, organisationId: orgId } },
    });

    if (!existingMembership) {
      await db.organisationMembership.create({
        data: {
          userId: user.id,
          organisationId: orgId,
          role: "OWNER",
        },
      });
      console.log(`  Created OWNER membership for ${user.email}`);
    } else {
      console.log(`  Membership already exists for ${user.email} (role: ${existingMembership.role})`);
    }

    console.log("\nBootstrap organisation complete.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();