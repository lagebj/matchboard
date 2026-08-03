import { notFound } from "next/navigation";
import { getFormationById } from "@/app/(app)/rules/formation-actions";
import { FormationsBuilderClient } from "@/components/formations/formations-builder";
import { requireActorContext } from "@/lib/auth/actor-context";
import type { GameFormat } from "@/generated/prisma/client";
import type { FormationSlotRoleType, BroadPosition } from "@/lib/formations/types";

type EditFormationPageProps = {
  params: Promise<{
    orgSlug: string;
    formationId: string;
  }>;
  searchParams: Promise<{
    returnTo?: string;
  }>;
};

export default async function EditFormationPage({ params, searchParams }: EditFormationPageProps) {
  const { orgSlug, formationId } = await params;
  const { returnTo } = await searchParams;

  await requireActorContext(orgSlug);

  const formation = await getFormationById(formationId);

  if (!formation || formation.source === "SYSTEM") {
    notFound();
  }

  const initialData = {
    name: formation.name,
    gameFormat: formation.gameFormat as GameFormat,
    slots: formation.slots.map((s) => ({
      id: s.id,
      gridX: s.gridX,
      gridY: s.gridY,
      label: s.label,
      shortLabel: s.shortLabel,
      roleType: s.roleType as FormationSlotRoleType,
      acceptedPositionIds: s.acceptedPositionIds as BroadPosition[],
      sortOrder: s.sortOrder,
    })),
  };

  return (
    <FormationsBuilderClient
      formationId={formationId}
      initialData={initialData}
      returnTo={returnTo || "/formations"}
    />
  );
}