"use server";

import { requireCoachAccess } from "@/lib/auth";
import { getFixturesOverview } from "@/domain/fixtures/service";

export async function fetchFixturesOverview() {
  await requireCoachAccess();
  return getFixturesOverview();
}