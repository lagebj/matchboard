import { notFound } from "next/navigation";
import { getFormationById } from "@/app/(app)/rules/formation-actions";
import { FormationsBuilderClient } from "@/components/formations/formations-builder";
import type { GameFormat } from "@/generated/prisma/client";
import type { FormationSlotRoleType, BroadPosition } from "@/lib/formations/types";

type NewFormationPageProps = {
  searchParams: Promise<{
    gameFormat?: string;
    returnTo?: string;
    duplicateFrom?: string;
  }>;
};

export default async function NewFormationPage({ searchParams }: NewFormationPageProps) {
  const { gameFormat, returnTo, duplicateFrom } = await searchParams;

  let initialData: { name: string; gameFormat: GameFormat; slots: { id?: string; gridX: number; gridY: number; label: string; shortLabel: string; roleType: FormationSlotRoleType; acceptedPositionIds: BroadPosition[]; sortOrder: number }[] } | undefined;

  if (duplicateFrom) {
    const source = await getFormationById(duplicateFrom);
    if (!source) notFound();
    initialData = {
      name: `${source.name} (copy)`,
      gameFormat: source.gameFormat as GameFormat,
      slots: source.slots.map((s) => ({
        gridX: s.gridX,
        gridY: s.gridY,
        label: s.label,
        shortLabel: s.shortLabel,
        roleType: s.roleType as FormationSlotRoleType,
        acceptedPositionIds: s.acceptedPositionIds as BroadPosition[],
        sortOrder: s.sortOrder,
      })),
    };
  }

  return (
    <FormationsBuilderClient
      gameFormat={initialData?.gameFormat ?? (gameFormat as GameFormat | undefined)}
      returnTo={returnTo || "/formations"}
      initialData={initialData}
    />
  );
}