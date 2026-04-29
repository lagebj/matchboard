'use client'

import { repairDropoutAction } from "@/app/matches/actions";

type RepairDropoutFormProps = {
  matchId: string;
  playerId: string;
  playerName: string;
  selectionStatus: string;
};

export function RepairDropoutForm({
  matchId,
  playerId,
  selectionStatus,
}: RepairDropoutFormProps) {
  if (selectionStatus === "FINALIZED") {
    return null;
  }

  async function handleRepair() {
    await repairDropoutAction(matchId, playerId);
  }

  return (
    <form action={handleRepair} className="inline">
      <button
        className="rounded-full border border-[rgba(185,128,119,0.3)] bg-[rgba(185,128,119,0.08)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[#f0cbc5] hover:bg-[rgba(185,128,119,0.14)]"
        type="submit"
      >
        Mark absent
      </button>
    </form>
  );
}