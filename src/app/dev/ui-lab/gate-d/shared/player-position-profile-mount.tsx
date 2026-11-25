"use client";

import { PlayerPositionProfile } from "@/components/players/player-position-profile";

type PlayerWithPositions = {
  id: string;
  primaryPosition: string | null;
  secondaryPosition: string | null;
  tertiaryPosition: string | null;
};

type SelectOption = { label: string; value: string };

/**
 * Gate D UI Lab mount for the real, unmodified `PlayerPositionProfile`. Its
 * `updateFieldAction` prop is a plain function, not a `"use server"` Server Action — a Server
 * Component passing a plain function to a Client Component crashes React Server Components
 * serialization in a real build/capture (confirmed live by Gate C W3's C07-ON fixture; invisible
 * to jsdom component tests, which never cross the real server/client boundary). The simulated
 * handler is therefore constructed here, inside the already-`"use client"` boundary, never
 * received as a prop from a server `page.tsx`. It resolves successfully without writing
 * anything — this fixture's player id is synthetic and has no real database row.
 */
export function PlayerPositionProfileMount({
  player,
  positionOptions,
  optionalPositionOptions,
}: {
  player: PlayerWithPositions;
  positionOptions: ReadonlyArray<SelectOption>;
  optionalPositionOptions: ReadonlyArray<SelectOption>;
}) {
  const simulatedUpdateFieldAction = async (_playerId: string, _field: string, _value: string) => {
    return { success: true };
  };

  return (
    <PlayerPositionProfile
      player={player}
      positionOptions={positionOptions}
      optionalPositionOptions={optionalPositionOptions}
      updateFieldAction={simulatedUpdateFieldAction}
    />
  );
}
