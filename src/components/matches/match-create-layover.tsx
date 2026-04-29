import Link from "next/link";
import type { Team } from "@/generated/prisma/client";
import { MatchForm } from "@/components/matches/match-form";

export function MatchCreateLayover({ teams }: { teams: Pick<Team, "id" | "name">[] }) {
  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-[rgba(6,8,12,0.68)] backdrop-blur-sm">
      <div className="h-full w-full max-w-xl overflow-y-auto border-l app-hairline bg-[linear-gradient(180deg,rgba(17,21,29,0.98),rgba(11,14,20,0.98))] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.32)]">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
              New Match
            </p>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-zinc-50">
              Create Match
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 app-copy-soft">
              Add a match without leaving the overview. Create it here, then open the detail page
              when you want to work on selection.
            </p>
          </div>
          <Link
            className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
            href="/matches"
          >
            Close
          </Link>
        </div>

        <MatchForm teams={teams} />
      </div>
    </div>
  );
}