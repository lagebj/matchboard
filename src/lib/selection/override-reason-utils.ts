import { OverrideReasonCategory as PrismaOverrideReasonCategory } from "@/generated/prisma/client";
import type { OverrideReasonCategory } from "@/lib/selection/types";

export function formatOverrideReason(category: OverrideReasonCategory, detail?: string | null): string {
  if (detail) return `${category}: ${detail}`;
  return category;
}

export function toPrismaCategory(category: OverrideReasonCategory): PrismaOverrideReasonCategory {
  return PrismaOverrideReasonCategory[category.toUpperCase() as keyof typeof PrismaOverrideReasonCategory];
}