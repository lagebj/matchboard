'use server'

import { revalidatePath } from "next/cache";
import { clearAllDraftSelections } from "@/lib/selection/clear-draft-selection";

export async function clearAllDraftsAction(formData: FormData) {
  const planningPeriodId = formData.get("planningPeriodId");
  if (typeof planningPeriodId !== "string" || !planningPeriodId) {
    throw new Error("Planning period ID is required.");
  }

  await clearAllDraftSelections(planningPeriodId);

  revalidatePath("/");
  revalidatePath("/rounds");
}