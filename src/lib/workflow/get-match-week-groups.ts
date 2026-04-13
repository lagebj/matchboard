import { SelectionStatus } from "@/generated/prisma/client";
import { formatIsoWeekLabel, getIsoWeekSortValue } from "@/lib/date-utils";

type MatchLike = {
  createdAt?: Date;
  id: string;
  startsAt: Date;
};

export type MatchWeekGroup<TMatch extends MatchLike> = {
  isFullyFinalized: boolean;
  label: string;
  matches: TMatch[];
  sortValue: number;
};

export function getMatchWeekGroups<TMatch extends MatchLike>(
  matches: TMatch[],
  latestSelectionStatusByMatchId?: Map<string, SelectionStatus | null>,
): MatchWeekGroup<TMatch>[] {
  const groups = new Map<string, MatchWeekGroup<TMatch>>();

  for (const match of matches) {
    const label = formatIsoWeekLabel(match.startsAt);
    const existingGroup = groups.get(label);

    if (existingGroup) {
      existingGroup.matches.push(match);
      continue;
    }

    groups.set(label, {
      isFullyFinalized: false,
      label,
      matches: [match],
      sortValue: getIsoWeekSortValue(match.startsAt),
    });
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      isFullyFinalized:
        group.matches.length > 0 &&
        group.matches.every(
          (match) =>
            (latestSelectionStatusByMatchId?.get(match.id) ?? null) === SelectionStatus.FINALIZED,
        ),
      matches: [...group.matches].sort((left, right) => {
        const dateDifference = left.startsAt.getTime() - right.startsAt.getTime();

        if (dateDifference !== 0) {
          return dateDifference;
        }

        return (left.createdAt?.getTime() ?? 0) - (right.createdAt?.getTime() ?? 0);
      }),
    }))
    .sort((left, right) => left.sortValue - right.sortValue);
}
