'use client'

import { acceptReducedSquadAction } from "@/app/matches/actions";

type AcceptReducedSquadFormProps = {
  matchId: string;
  playerId: string;
};

export function AcceptReducedSquadForm({ matchId, playerId }: AcceptReducedSquadFormProps) {
  async function handleAccept() {
    await acceptReducedSquadAction(matchId, playerId);
  }

  return (
    <form action={handleAccept} className="inline">
      <button
        className="rounded-full border border-[rgba(185,128,119,0.3)] bg-[rgba(185,128,119,0.12)] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-[#f0cbc5] hover:bg-[rgba(185,128,119,0.2)]"
        type="submit"
      >
        Accept reduced squad
      </button>
    </form>
  );
}