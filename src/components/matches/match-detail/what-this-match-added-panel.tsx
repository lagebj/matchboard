import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { buildWhatThisMatchAddedRows, type WhatThisMatchAddedInput } from "@/lib/matches/completed-match-story";

/**
 * Completed Match "What this match added" (`08_COMPLETED_MATCH.md`): a short list of concrete,
 * computed evidence-base changes, or nothing at all when none genuinely qualify. Never a
 * player-ability claim from one match's correlation; never padded to avoid an empty section --
 * omitting the whole panel when `rows` is empty is the honest behaviour the spec asks for.
 */
export function WhatThisMatchAddedPanel({ input }: { input: WhatThisMatchAddedInput }) {
  const rows = buildWhatThisMatchAddedRows(input);
  if (rows.length === 0) return null;

  return (
    <Surface padding="md">
      <SectionHeader title="What this match added" description="Concrete, computed changes to the team's recorded evidence base." />
      <ul className="mt-2 flex flex-col gap-1.5">
        {rows.map((row) => (
          <li key={row.id} className="flex items-start gap-2 text-[13px] text-[var(--foreground)]">
            <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--text-muted)]" />
            <span>{row.label}</span>
          </li>
        ))}
      </ul>
    </Surface>
  );
}
