'use server'

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { buildPathWithSearch } from "@/lib/build-path-with-search";
import { getRules } from "@/lib/rules/get-rules";

function readText(formData: FormData, fieldName: string): string {
  const value = formData.get(fieldName);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function readCheckbox(formData: FormData, fieldName: string): boolean {
  return formData.get(fieldName) === "on";
}

function readRequiredInteger(formData: FormData, fieldName: string): number {
  const value = readText(formData, fieldName);
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw new Error(`${fieldName} must be a whole number greater than or equal to 0.`);
  }

  return parsedValue;
}

export async function saveRulesAction(formData: FormData) {
  try {
    const rules = await getRules();

    await db.ruleConfig.update({
      where: { id: rules.id },
      data: {
        allowCoreMatchDrop: readCheckbox(formData, "allowCoreMatchDrop"),
        maxCoreMatchDropsPerPlayer: readRequiredInteger(formData, "maxCoreMatchDropsPerPlayer"),
        maxTotalFloatMatches: readRequiredInteger(formData, "maxTotalFloatMatches"),
        preventConsecutiveFloat: readCheckbox(formData, "preventConsecutiveFloat"),
        minDaysBetweenAnyMatches: readRequiredInteger(formData, "minDaysBetweenAnyMatches"),
        blockCoreMatchIfFloatingWithinDays: readRequiredInteger(
          formData,
          "blockCoreMatchIfFloatingWithinDays",
        ),
        preferPositionBalance: readCheckbox(formData, "preferPositionBalance"),
        preferLowRecentLoad: readCheckbox(formData, "preferLowRecentLoad"),
        preferLowerFloatCount: readCheckbox(formData, "preferLowerFloatCount"),
      },
    });
  } catch (error) {
    redirect(
      buildPathWithSearch("/rules", {
        error: error instanceof Error ? error.message : "Could not save the rule configuration.",
      }),
    );
  }

  revalidatePath("/rules");
  redirect(
    buildPathWithSearch("/rules", {
      saved: true,
    }),
  );
}
