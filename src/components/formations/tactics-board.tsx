"use client";

import { cn } from "@/lib/cn";
import {
  WIDTH_LANE_LABELS,
  DEPTH_LANE_LABELS,
  GRID_WIDTH,
  GRID_HEIGHT,
  ROLE_TYPE_LABELS,
  getGridPositionPercent,
} from "@/lib/formations/types";
import {
  getBoardPositionPercent,
  type BoardOrientation,
  type AttackingDirection,
} from "@/lib/formations/board-projection";
import type { FormationSlotRoleType, BroadPosition } from "@/lib/formations/types";

export type TacticsBoardMode =
  | "position-profile"
  | "formation-preview"
  | "formation-builder"
  | "lineup-assignment"
  | "lineup-readonly"
  | "selection-preview";

export type TacticsBoardSize = "compact" | "standard" | "wide";

export type TacticsBoardSlot = {
  id: string;
  gridX: number;
  gridY: number;
  label: string;
  shortLabel: string;
  roleType: FormationSlotRoleType;
  acceptedPositionIds: BroadPosition[];
  sortOrder: number;
};

export type TacticsBoardAssignment = {
  id: string;
  slotId: string;
  playerId: string | null;
  locked: boolean;
  source: string;
};

export type TacticsBoardPlayer = {
  id: string;
  firstName: string;
  lastName: string | null;
  primaryPosition: string;
};

export type TacticsBoardPositionMarker = {
  pos: string;
  x: number;
  y: number;
  isPrimary?: boolean;
};

export const ROLE_COLORS: Record<FormationSlotRoleType, string> = {
  GOALKEEPER: "bg-amber-500/80 text-amber-950 border-amber-400",
  DEFENDER: "bg-sky-500/80 text-sky-950 border-sky-400",
  DEFENSIVE_MIDFIELDER: "bg-teal-500/80 text-teal-950 border-teal-400",
  MIDFIELDER: "bg-emerald-500/80 text-emerald-950 border-emerald-400",
  ATTACKING_MIDFIELDER: "bg-orange-500/80 text-orange-950 border-orange-400",
  FORWARD: "bg-red-500/80 text-red-950 border-red-400",
  FREE: "bg-zinc-500/80 text-zinc-950 border-zinc-400",
};

const SIZE_CONFIG: Record<TacticsBoardSize, { aspectClass: string }> = {
  compact: { aspectClass: "aspect-[3/2]" },
  standard: { aspectClass: "aspect-[3/2]" },
  wide: { aspectClass: "aspect-[3/2]" },
};

type PositionProfileRenderProps = {
  markers: TacticsBoardPositionMarker[];
  size: TacticsBoardSize;
};

type FormationBuilderRenderProps = {
  slots: TacticsBoardSlot[];
  canAddMore: boolean;
  readOnly: boolean;
  onAddSlot: (gridX: number, gridY: number) => void;
  onEditSlot: (slotId: string) => void;
};

type LineupRenderProps = {
  slots: TacticsBoardSlot[];
  assignments: TacticsBoardAssignment[];
  players: TacticsBoardPlayer[];
  readOnly: boolean;
  onSlotClick?: (
    assignmentId: string | null,
    slotId: string,
    playerId: string | null,
  ) => void;
};

type SelectionPreviewRenderProps = {
  slots: TacticsBoardSlot[];
  assignments: TacticsBoardAssignment[];
  players: TacticsBoardPlayer[];
};

type TacticsBoardProps = {
  orientation?: BoardOrientation;
  attackingDirection?: AttackingDirection;
  size?: TacticsBoardSize;
  className?: string;
  mode: TacticsBoardMode;
} & (
  | ({ mode: "position-profile" } & PositionProfileRenderProps)
  | ({ mode: "formation-builder" | "formation-preview" } & FormationBuilderRenderProps)
  | ({ mode: "lineup-assignment" | "lineup-readonly" } & LineupRenderProps)
  | ({ mode: "selection-preview" } & SelectionPreviewRenderProps)
);

const DOT_SIZE: Record<TacticsBoardSize, number> = {
  compact: 6,
  standard: 8,
  wide: 10,
};

const PRIMARY_DOT_SIZE: Record<TacticsBoardSize, number> = {
  compact: 8,
  standard: 10,
  wide: 13,
};

const FONT_SIZE: Record<TacticsBoardSize, number> = {
  compact: 6,
  standard: 8,
  wide: 9,
};

function PitchMarkings({ orientation }: { orientation: BoardOrientation }) {
  if (orientation === "horizontal") {
    return (
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <rect
          x="1" y="8" width="98" height="84"
          rx="0.5"
          fill="none"
          stroke="var(--border-soft)"
          strokeWidth="0.4"
        />
        <line
          x1="50" y1="8" x2="50" y2="92"
          stroke="var(--border-soft)"
          strokeWidth="0.3"
        />
        <circle
          cx="50" cy="50" r="9"
          fill="none"
          stroke="var(--border-soft)"
          strokeWidth="0.3"
        />
        <circle
          cx="50" cy="50" r="0.5"
          fill="var(--border-soft)"
        />
        <rect
          x="1" y="27" width="17" height="46"
          fill="none"
          stroke="var(--border-soft)"
          strokeWidth="0.3"
          rx="0.2"
        />
        <rect
          x="1" y="37" width="7" height="26"
          fill="none"
          stroke="var(--border-soft)"
          strokeWidth="0.2"
          rx="0.2"
        />
        <circle
          cx="14" cy="50" r="0.5"
          fill="var(--border-soft)"
        />
        <rect
          x="82" y="27" width="17" height="46"
          fill="none"
          stroke="var(--border-soft)"
          strokeWidth="0.3"
          rx="0.2"
        />
        <rect
          x="92" y="37" width="7" height="26"
          fill="none"
          stroke="var(--border-soft)"
          strokeWidth="0.2"
          rx="0.2"
        />
        <circle
          cx="86" cy="50" r="0.5"
          fill="var(--border-soft)"
        />
      </svg>
    );
  }

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <rect
        x="8" y="1" width="84" height="98"
        rx="0.5"
        fill="none"
        stroke="var(--border-soft)"
        strokeWidth="0.4"
      />
      <line
        x1="8" y1="50" x2="92" y2="50"
        stroke="var(--border-soft)"
        strokeWidth="0.3"
      />
      <circle
        cx="50" cy="50" r="9"
        fill="none"
        stroke="var(--border-soft)"
        strokeWidth="0.3"
      />
      <circle
        cx="50" cy="50" r="0.5"
        fill="var(--border-soft)"
      />
      <rect
        x="27" y="76" width="46" height="23"
        fill="none"
        stroke="var(--border-soft)"
        strokeWidth="0.3"
        rx="0.2"
      />
      <rect
        x="37" y="89" width="26" height="10"
        fill="none"
        stroke="var(--border-soft)"
        strokeWidth="0.2"
        rx="0.2"
      />
      <circle
        cx="50" cy="86" r="0.5"
        fill="var(--border-soft)"
      />
      <rect
        x="27" y="1" width="46" height="23"
        fill="none"
        stroke="var(--border-soft)"
        strokeWidth="0.3"
        rx="0.2"
      />
      <rect
        x="37" y="1" width="26" height="10"
        fill="none"
        stroke="var(--border-soft)"
        strokeWidth="0.2"
        rx="0.2"
      />
      <circle
        cx="50" cy="14" r="0.5"
        fill="var(--border-soft)"
      />
    </svg>
  );
}

function PositionProfileContent({
  markers,
  size,
}: PositionProfileRenderProps & { orientation: BoardOrientation; attackingDirection: AttackingDirection }) {
  const dotR = DOT_SIZE[size] / 2;
  const primaryR = PRIMARY_DOT_SIZE[size] / 2;
  const fontSize = FONT_SIZE[size];

  return (
    <>
      {markers.map((m) => (
        <g key={m.pos}>
          <circle
            cx={m.x}
            cy={m.y}
            r={m.isPrimary ? primaryR : dotR}
            fill={m.isPrimary ? "var(--accent-strong)" : "var(--accent)"}
            opacity={m.isPrimary ? 1 : 0.45}
          />
          <text
            x={m.x}
            y={m.y + fontSize * 0.35}
            textAnchor="middle"
            fill={m.isPrimary ? "var(--surface-base)" : "var(--accent)"}
            fontSize={fontSize}
            fontWeight={m.isPrimary ? 700 : 500}
            opacity={m.isPrimary ? 1 : 0.6}
          >
            {m.pos}
          </text>
        </g>
      ))}
      {markers.length === 0 && (
        <text
          x="50"
          y="52"
          textAnchor="middle"
          fill="var(--text-muted)"
          fontSize="7"
          fontWeight="400"
        >
          No position
        </text>
      )}
    </>
  );
}

function FormationBuilderContent({
  slots,
  canAddMore,
  readOnly,
  onAddSlot,
  onEditSlot,
  orientation,
  attackingDirection,
}: FormationBuilderRenderProps & { orientation: BoardOrientation; attackingDirection: AttackingDirection }) {
  const slotMap = new Map<string, TacticsBoardSlot>();
  for (const slot of slots) {
    slotMap.set(`${slot.gridX},${slot.gridY}`, slot);
  }

  const projectionOpts = { orientation, attackingDirection };

  return (
    <>
      {Array.from({ length: GRID_HEIGHT }, (_, y) =>
        Array.from({ length: GRID_WIDTH }, (_, x) => {
          const key = `${x},${y}`;
          const slot = slotMap.get(key);

          if (orientation === "horizontal") {
            const boardPos = getBoardPositionPercent(x, y, projectionOpts);

            if (slot) {
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => !readOnly && onEditSlot(slot.id)}
                  className={cn(
                    "absolute z-10 flex flex-col items-center justify-center rounded-lg border-2 px-1 py-0.5 text-xs font-semibold transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/55 min-w-[3rem]",
                    ROLE_COLORS[slot.roleType],
                    readOnly && "cursor-default hover:scale-100",
                  )}
                  style={{
                    left: `${boardPos.x}%`,
                    top: `${boardPos.y}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                  aria-label={`${slot.shortLabel}: ${slot.label} (${ROLE_TYPE_LABELS[slot.roleType]})`}
                >
                  <span className="text-[10px] leading-tight font-bold">
                    {slot.shortLabel}
                  </span>
                  <span className="text-[8px] leading-none opacity-70">
                    {ROLE_TYPE_LABELS[slot.roleType].split(" ")[0]}
                  </span>
                </button>
              );
            }

            if (readOnly) return null;

            return (
              <button
                key={key}
                type="button"
                onClick={() => canAddMore ? onAddSlot(x, y) : undefined}
                disabled={!canAddMore}
                className={cn(
                  "absolute z-5 flex items-center justify-center rounded-full border-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-base)]/50 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:border-[var(--accent)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/55 w-8 h-8",
                  !canAddMore && "opacity-30 cursor-not-allowed",
                )}
                style={{
                  left: `${boardPos.x}%`,
                  top: `${boardPos.y}%`,
                  transform: "translate(-50%, -50%)",
                }}
                aria-label={`Add slot at ${WIDTH_LANE_LABELS[x]}, ${DEPTH_LANE_LABELS[y]}`}
              >
                <span className="text-lg leading-none">+</span>
              </button>
            );
          }

          const { x: xPct, y: yPct } = getGridPositionPercent(x, y);

          if (slot) {
            return (
              <button
                key={key}
                type="button"
                onClick={() => !readOnly && onEditSlot(slot.id)}
                className={cn(
                  "absolute z-10 flex flex-col items-center justify-center rounded-lg border-2 px-1 py-0.5 text-xs font-semibold transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/55 min-w-[3rem]",
                  ROLE_COLORS[slot.roleType],
                  readOnly && "cursor-default hover:scale-100",
                )}
                style={{
                  left: `${xPct}%`,
                  top: `${yPct}%`,
                  transform: "translate(-50%, -50%)",
                }}
                aria-label={`${slot.shortLabel}: ${slot.label} (${ROLE_TYPE_LABELS[slot.roleType]})`}
              >
                <span className="text-[10px] leading-tight font-bold">
                  {slot.shortLabel}
                </span>
                <span className="text-[8px] leading-none opacity-70">
                  {ROLE_TYPE_LABELS[slot.roleType].split(" ")[0]}
                </span>
              </button>
            );
          }

          if (readOnly) return null;

          return (
            <button
              key={key}
              type="button"
              onClick={() => canAddMore ? onAddSlot(x, y) : undefined}
              disabled={!canAddMore}
              className={cn(
                "absolute z-5 flex items-center justify-center rounded-full border-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-base)]/50 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:border-[var(--accent)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/55 w-8 h-8",
                !canAddMore && "opacity-30 cursor-not-allowed",
              )}
              style={{
                left: `${xPct}%`,
                top: `${yPct}%`,
                transform: "translate(-50%, -50%)",
              }}
              aria-label={`Add slot at ${WIDTH_LANE_LABELS[x]}, ${DEPTH_LANE_LABELS[y]}`}
            >
              <span className="text-lg leading-none">+</span>
            </button>
          );
        }),
      )}
    </>
  );
}

function LineupContent({
  slots,
  assignments,
  players,
  readOnly,
  onSlotClick,
  orientation,
  attackingDirection,
}: LineupRenderProps & { orientation: BoardOrientation; attackingDirection: AttackingDirection }) {
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const assignmentMap = new Map(assignments.map((a) => [a.slotId, a]));
  const projectionOpts = { orientation, attackingDirection };

  return (
    <>
      {slots.map((slot) => {
        const assignment = assignmentMap.get(slot.id);
        const player = assignment?.playerId
          ? playerMap.get(assignment.playerId)
          : null;
        const boardPos = getBoardPositionPercent(slot.gridX, slot.gridY, projectionOpts);

        return (
          <button
            key={slot.id}
            type="button"
            onClick={() => {
              if (!readOnly && onSlotClick) {
                onSlotClick(
                  assignment?.id ?? null,
                  slot.id,
                  assignment?.playerId ?? null,
                );
              }
            }}
            className={cn(
              "absolute z-10 flex flex-col items-center justify-center rounded-lg border-2 px-1 py-0.5 text-xs font-semibold transition-transform min-w-[3.5rem]",
              player
                ? "bg-[var(--accent)]/20 border-[var(--accent)] text-zinc-100 hover:scale-105 cursor-pointer"
                : cn("border-2 cursor-pointer hover:scale-105", ROLE_COLORS[slot.roleType], "opacity-60 hover:opacity-80"),
              assignment?.locked && "ring-1 ring-[var(--accent)]",
              readOnly && "cursor-default hover:scale-100",
            )}
            style={{
              left: `${boardPos.x}%`,
              top: `${boardPos.y}%`,
              transform: "translate(-50%, -50%)",
            }}
            aria-label={
              player
                ? `${player.firstName} ${player.lastName ?? ""} - ${slot.shortLabel}`
                : `${slot.shortLabel}: ${slot.label} (tap to assign)`
            }
          >
            {player ? (
              <>
                <span className="text-[10px] leading-tight font-bold truncate max-w-full">
                  {player.firstName}
                  {player.lastName ? ` ${player.lastName.charAt(0)}.` : ""}
                </span>
                <span className="text-[8px] leading-none opacity-70">
                  {slot.shortLabel}
                </span>
              </>
            ) : (
              <>
                <span className="text-[10px] leading-tight font-bold">
                  {slot.shortLabel}
                </span>
                <span className="text-[8px] leading-none opacity-70">
                  {ROLE_TYPE_LABELS[slot.roleType].split(" ")[0]}
                </span>
              </>
            )}
          </button>
        );
      })}
    </>
  );
}

function SelectionPreviewContent({
  slots,
  assignments,
  players,
  orientation,
  attackingDirection,
}: SelectionPreviewRenderProps & { orientation: BoardOrientation; attackingDirection: AttackingDirection }) {
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const assignmentMap = new Map(assignments.map((a) => [a.slotId, a]));
  const projectionOpts = { orientation, attackingDirection };

  return (
    <>
      {slots.map((slot) => {
        const assignment = assignmentMap.get(slot.id);
        const player = assignment?.playerId
          ? playerMap.get(assignment.playerId)
          : null;
        const boardPos = getBoardPositionPercent(slot.gridX, slot.gridY, projectionOpts);
        const roleColor = ROLE_COLORS[slot.roleType] ?? ROLE_COLORS.FREE;

        return (
          <div
            key={slot.id}
            className={cn(
              "absolute z-10 flex flex-col items-center justify-center rounded-lg border-2 px-1 py-0.5 text-xs font-semibold min-w-[3rem] max-w-[5rem] cursor-default",
              slot.roleType && player
                ? roleColor
                : "border-dashed border-[var(--border-soft)] bg-[var(--surface-base)]/50 text-[var(--text-muted)]",
            )}
            style={{
              left: `${boardPos.x}%`,
              top: `${boardPos.y}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <span className="text-[10px] leading-tight font-bold">
              {slot.shortLabel}
            </span>
            {player ? (
              <span className="text-[9px] leading-none truncate max-w-full">
                {player.firstName}
                {player.lastName ? ` ${player.lastName.charAt(0)}.` : ""}
              </span>
            ) : (
              <span className="text-[8px] leading-none opacity-50">
                Empty
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}

export function TacticsBoard(props: TacticsBoardProps) {
  const orientation = props.orientation ?? "horizontal";
  const attackingDirection = props.attackingDirection ?? "left-to-right";
  const size = props.size ?? "standard";
  const sizeConfig = SIZE_CONFIG[size];

  if (props.mode === "position-profile") {
    const { markers } = props;
    return (
      <div className={cn("pitch-frame rounded-xl overflow-hidden border border-[var(--border-pitch)]", props.className)}>
        <div
          data-testid="pitch-surface"
          className={cn("pitch-surface relative w-full", sizeConfig.aspectClass, "bg-[var(--surface-tactical)]")}
        >
          <PitchMarkings orientation={orientation} />
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={
              markers.find((m) => m.isPrimary)
                ? `Pitch position map. Primary: ${markers.find((m) => m.isPrimary)?.pos}${markers.filter((m) => !m.isPrimary).length > 0 ? `, secondary: ${markers.filter((m) => !m.isPrimary).map((m) => m.pos).join(", ")}` : ""}`
                : "Pitch position map. No position set"
            }
          >
            <PositionProfileContent
              markers={markers}
              size={size}
              orientation={orientation}
              attackingDirection={attackingDirection}
            />
          </svg>
        </div>
      </div>
    );
  }

  if (props.mode === "formation-builder" || props.mode === "formation-preview") {
    const { slots, canAddMore, readOnly, onAddSlot, onEditSlot } = props;
    const isReadOnly = props.mode === "formation-preview" ? true : readOnly;

    return (
      <div className={cn("pitch-frame rounded-xl overflow-hidden border border-[var(--border-pitch)]", props.className)}>
        <div
          data-testid="pitch-surface"
          className={cn("pitch-surface relative w-full", sizeConfig.aspectClass, "bg-[var(--surface-tactical)]")}
        >
          <PitchMarkings orientation={orientation} />
          <FormationBuilderContent
            slots={slots}
            canAddMore={canAddMore}
            readOnly={isReadOnly}
            onAddSlot={onAddSlot}
            onEditSlot={onEditSlot}
            orientation={orientation}
            attackingDirection={attackingDirection}
          />
        </div>
      </div>
    );
  }

  if (props.mode === "lineup-assignment" || props.mode === "lineup-readonly") {
    const { slots, assignments, players, readOnly, onSlotClick } = props;
    const isReadOnly = props.mode === "lineup-readonly" ? true : readOnly;

    return (
      <div className={cn("pitch-frame rounded-xl overflow-hidden border border-[var(--border-pitch)]", props.className)}>
        <div
          data-testid="pitch-surface"
          className={cn("pitch-surface relative w-full", sizeConfig.aspectClass, "bg-[var(--surface-tactical)]")}
        >
          <PitchMarkings orientation={orientation} />
          <LineupContent
            slots={slots}
            assignments={assignments}
            players={players}
            readOnly={isReadOnly}
            onSlotClick={onSlotClick}
            orientation={orientation}
            attackingDirection={attackingDirection}
          />
        </div>
      </div>
    );
  }

  if (props.mode === "selection-preview") {
    const { slots, assignments, players } = props;

    return (
      <div className={cn("pitch-frame rounded-xl overflow-hidden border border-[var(--border-pitch)]", props.className)}>
        <div
          data-testid="pitch-surface"
          className={cn("pitch-surface relative w-full", sizeConfig.aspectClass, "bg-[var(--surface-tactical)]")}
        >
          <PitchMarkings orientation={orientation} />
          <SelectionPreviewContent
            slots={slots}
            assignments={assignments}
            players={players}
            orientation={orientation}
            attackingDirection={attackingDirection}
          />
        </div>
      </div>
    );
  }

  return null;
}