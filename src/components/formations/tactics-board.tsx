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
  getBoardViewBox,
  PITCH_WIDTH,
  PITCH_HEIGHT,
  type BoardOrientation,
  type AttackingDirection,
} from "@/lib/formations/board-projection";
import type { FormationSlotRoleType, BroadPosition } from "@/lib/formations/types";
import { PitchPlayerToken, PitchEmptySlot } from "@/components/touchline/pitch/pitch-player-token";

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
  /** Optional presentation data (Player.shirtNumber) — shown on the pitch token when known. */
  shirtNumber?: number | null;
};

export type TacticsBoardPositionMarker = {
  pos: string;
  x: number;
  y: number;
  isPrimary?: boolean;
};

/**
 * Restrained, non-saturated role-type treatment for the formation builder
 * (Touchline Finish & Visual Convergence follow-up,
 * `06_TACTICS_LINEUP_AND_PITCH.md §5` — supersedes the earlier saturated
 * Tailwind-500 fills). Border/text only, low-alpha background; never a
 * role-colour rainbow. `formation-builder`/`formation-preview` slot buttons
 * are the only remaining consumer — lineup/tactics/selection-preview player
 * representation uses `PitchPlayerToken`/`PitchEmptySlot` instead.
 */
export const ROLE_COLORS: Record<FormationSlotRoleType, string> = {
  GOALKEEPER: "border-[var(--warning)] bg-[var(--warning-subtle)] text-[var(--warning)]",
  DEFENDER: "border-[var(--info)] bg-[var(--info-subtle)] text-[var(--info)]",
  DEFENSIVE_MIDFIELDER: "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]",
  MIDFIELDER: "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]",
  ATTACKING_MIDFIELDER: "border-[var(--tl-c-evidence)] bg-[var(--dev-subtle)] text-[var(--tl-c-evidence)]",
  FORWARD: "border-[var(--tl-c-evidence)] bg-[var(--dev-subtle)] text-[var(--tl-c-evidence)]",
  FREE: "border-[var(--border-strong)] bg-[var(--tl-c-surface-strong)] text-[var(--text-muted)]",
};

function getAspectClass(orientation: BoardOrientation): string {
  if (orientation === "vertical") return "aspect-[68/105]";
  return "aspect-[105/68]";
}

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



const M = 2;
const HALF_W = PITCH_WIDTH / 2;
const HALF_H = PITCH_HEIGHT / 2;
const PA_W = 16.5;
const PA_H = 40.32;
const GA_W = 5.5;
const GA_H = 18.32;
const CENTER_R = 9.15;
const PENALTY_SPOT = 11;
const GOAL_W = 7.32;

function HorizontalPitchMarkings() {
  const paTop = HALF_H - PA_H / 2;
  const gaTop = HALF_H - GA_H / 2;
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`0 0 ${PITCH_WIDTH} ${PITCH_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <rect x={M} y={M} width={PITCH_WIDTH - 2 * M} height={PITCH_HEIGHT - 2 * M}
        rx="0.5" fill="none" stroke="var(--tl-pitch-line)" strokeWidth="0.4" />
      <line x1={HALF_W} y1={M} x2={HALF_W} y2={PITCH_HEIGHT - M}
        stroke="var(--tl-pitch-line)" strokeWidth="0.3" />
      <circle cx={HALF_W} cy={HALF_H} r={CENTER_R}
        fill="none" stroke="var(--tl-pitch-line)" strokeWidth="0.3" />
      <circle cx={HALF_W} cy={HALF_H} r="0.6" fill="var(--tl-pitch-line)" />
      <rect x={M} y={paTop} width={PA_W} height={PA_H}
        fill="none" stroke="var(--tl-pitch-line)" strokeWidth="0.3" rx="0.2" />
      <rect x={M} y={gaTop} width={GA_W} height={GA_H}
        fill="none" stroke="var(--tl-pitch-line)" strokeWidth="0.2" rx="0.2" />
      <circle cx={M + PENALTY_SPOT} cy={HALF_H} r="0.6" fill="var(--tl-pitch-line)" />
      <rect x={PITCH_WIDTH - M - PA_W} y={paTop} width={PA_W} height={PA_H}
        fill="none" stroke="var(--tl-pitch-line)" strokeWidth="0.3" rx="0.2" />
      <rect x={PITCH_WIDTH - M - GA_W} y={gaTop} width={GA_W} height={GA_H}
        fill="none" stroke="var(--tl-pitch-line)" strokeWidth="0.2" rx="0.2" />
      <circle cx={PITCH_WIDTH - M - PENALTY_SPOT} cy={HALF_H} r="0.6" fill="var(--tl-pitch-line)" />
      <line x1={M + PA_W} y1={HALF_H - CENTER_R} x2={M + PA_W} y2={HALF_H + CENTER_R}
        stroke="var(--tl-pitch-line)" strokeWidth="0.2" />
      <line x1={PITCH_WIDTH - M - PA_W} y1={HALF_H - CENTER_R} x2={PITCH_WIDTH - M - PA_W} y2={HALF_H + CENTER_R}
        stroke="var(--tl-pitch-line)" strokeWidth="0.2" />
      <rect x={M - 0.3} y={HALF_H - GOAL_W / 2} width={0.3} height={GOAL_W}
        fill="none" stroke="var(--tl-pitch-line)" strokeWidth="0.3" />
      <rect x={PITCH_WIDTH - M} y={HALF_H - GOAL_W / 2} width={0.3} height={GOAL_W}
        fill="none" stroke="var(--tl-pitch-line)" strokeWidth="0.3" />
    </svg>
  );
}

function VerticalPitchMarkings() {
  const paLeft = HALF_H - PA_H / 2;
  const gaLeft = HALF_H - GA_H / 2;
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`0 0 ${PITCH_HEIGHT} ${PITCH_WIDTH}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <rect x={M} y={M} width={PITCH_HEIGHT - 2 * M} height={PITCH_WIDTH - 2 * M}
        rx="0.5" fill="none" stroke="var(--tl-pitch-line)" strokeWidth="0.4" />
      <line x1={M} y1={HALF_W} x2={PITCH_HEIGHT - M} y2={HALF_W}
        stroke="var(--tl-pitch-line)" strokeWidth="0.3" />
      <circle cx={HALF_H} cy={HALF_W} r={CENTER_R}
        fill="none" stroke="var(--tl-pitch-line)" strokeWidth="0.3" />
      <circle cx={HALF_H} cy={HALF_W} r="0.6" fill="var(--tl-pitch-line)" />
      <rect x={paLeft} y={PITCH_WIDTH - M - PA_W} width={PA_H} height={PA_W}
        fill="none" stroke="var(--tl-pitch-line)" strokeWidth="0.3" rx="0.2" />
      <rect x={gaLeft} y={PITCH_WIDTH - M - GA_W} width={GA_H} height={GA_W}
        fill="none" stroke="var(--tl-pitch-line)" strokeWidth="0.2" rx="0.2" />
      <circle cx={HALF_H} cy={PITCH_WIDTH - M - PENALTY_SPOT} r="0.6" fill="var(--tl-pitch-line)" />
      <rect x={paLeft} y={M} width={PA_H} height={PA_W}
        fill="none" stroke="var(--tl-pitch-line)" strokeWidth="0.3" rx="0.2" />
      <rect x={gaLeft} y={M} width={GA_H} height={GA_W}
        fill="none" stroke="var(--tl-pitch-line)" strokeWidth="0.2" rx="0.2" />
      <circle cx={HALF_H} cy={M + PENALTY_SPOT} r="0.6" fill="var(--tl-pitch-line)" />
      <rect x={HALF_H - GOAL_W / 2} y={PITCH_WIDTH - M} width={GOAL_W} height={0.3}
        fill="none" stroke="var(--tl-pitch-line)" strokeWidth="0.3" />
      <rect x={HALF_H - GOAL_W / 2} y={M - 0.3} width={GOAL_W} height={0.3}
        fill="none" stroke="var(--tl-pitch-line)" strokeWidth="0.3" />
    </svg>
  );
}

function PitchMarkings({ orientation }: { orientation: BoardOrientation }) {
  if (orientation === "horizontal") {
    return <HorizontalPitchMarkings />;
  }
  return <VerticalPitchMarkings />;
}

function pctToViewBox(pctX: number, pctY: number, orientation: BoardOrientation): { x: number; y: number } {
  if (orientation === "vertical") {
    return { x: pctX / 100 * PITCH_HEIGHT, y: pctY / 100 * PITCH_WIDTH };
  }
  return { x: pctX / 100 * PITCH_WIDTH, y: pctY / 100 * PITCH_HEIGHT };
}

const DOT_SIZE_SCALED: Record<TacticsBoardSize, number> = {
  compact: 4,
  standard: 5.5,
  wide: 7,
};

const PRIMARY_DOT_SIZE_SCALED: Record<TacticsBoardSize, number> = {
  compact: 5.5,
  standard: 7,
  wide: 9,
};

const FONT_SIZE_SCALED: Record<TacticsBoardSize, number> = {
  compact: 4,
  standard: 5.5,
  wide: 6,
};

function PositionProfileContent({
  markers,
  size,
  orientation,
}: PositionProfileRenderProps & { orientation: BoardOrientation; attackingDirection: AttackingDirection }) {
  const dotR = DOT_SIZE_SCALED[size] / 2;
  const primaryR = PRIMARY_DOT_SIZE_SCALED[size] / 2;
  const fontSize = FONT_SIZE_SCALED[size];
  const noPosPos = orientation === "vertical"
    ? { x: PITCH_HEIGHT / 2, y: PITCH_WIDTH / 2 }
    : { x: PITCH_WIDTH / 2, y: PITCH_HEIGHT / 2 };

  return (
    <>
      {markers.map((m) => {
        const svgPos = pctToViewBox(m.x, m.y, orientation);
        return (
          <g key={m.pos}>
            <circle
              cx={svgPos.x}
              cy={svgPos.y}
              r={m.isPrimary ? primaryR : dotR}
              fill={m.isPrimary ? "var(--accent-strong)" : "var(--accent)"}
              opacity={m.isPrimary ? 1 : 0.45}
            />
            <text
              x={svgPos.x}
              y={svgPos.y + fontSize * 0.35}
              textAnchor="middle"
              fill={m.isPrimary ? "var(--surface-base)" : "var(--accent)"}
              fontSize={fontSize}
              fontWeight={m.isPrimary ? 700 : 500}
              opacity={m.isPrimary ? 1 : 0.6}
            >
              {m.pos}
            </text>
          </g>
        );
      })}
      {markers.length === 0 && (
        <text
          x={noPosPos.x}
          y={noPosPos.y}
          textAnchor="middle"
          fill="var(--text-muted)"
          fontSize={fontSize}
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
                  "absolute z-5 flex items-center justify-center rounded-full border-2 border-dashed border-[var(--tl-pitch-border)] bg-transparent text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/55 w-8 h-8",
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
  size,
}: LineupRenderProps & {
  orientation: BoardOrientation;
  attackingDirection: AttackingDirection;
  size: TacticsBoardSize;
}) {
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const assignmentMap = new Map(assignments.map((a) => [a.slotId, a]));
  const projectionOpts = { orientation, attackingDirection };
  const compact = size === "compact";

  return (
    <>
      {slots.map((slot) => {
        const assignment = assignmentMap.get(slot.id);
        const player = assignment?.playerId
          ? playerMap.get(assignment.playerId)
          : null;
        const boardPos = getBoardPositionPercent(slot.gridX, slot.gridY, projectionOpts);
        const canEdit = !readOnly && onSlotClick;
        const handleClick = () =>
          onSlotClick?.(assignment?.id ?? null, slot.id, assignment?.playerId ?? null);

        return (
          <div
            key={slot.id}
            className="absolute z-10"
            style={{
              left: `${boardPos.x}%`,
              top: `${boardPos.y}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            {player ? (
              <PitchPlayerToken
                name={`${player.firstName}${player.lastName ? ` ${player.lastName.charAt(0)}.` : ""}`}
                role={slot.shortLabel}
                number={player.shirtNumber ?? null}
                locked={assignment?.locked ?? false}
                selected={false}
                compact={compact}
                onClick={canEdit ? handleClick : undefined}
              />
            ) : (
              <PitchEmptySlot
                role={slot.shortLabel}
                editable={Boolean(canEdit)}
                onClick={canEdit ? handleClick : undefined}
                compact={compact}
              />
            )}
          </div>
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
  size,
}: SelectionPreviewRenderProps & {
  orientation: BoardOrientation;
  attackingDirection: AttackingDirection;
  size: TacticsBoardSize;
}) {
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const assignmentMap = new Map(assignments.map((a) => [a.slotId, a]));
  const projectionOpts = { orientation, attackingDirection };
  const compact = size === "compact";

  return (
    <>
      {slots.map((slot) => {
        const assignment = assignmentMap.get(slot.id);
        const player = assignment?.playerId
          ? playerMap.get(assignment.playerId)
          : null;
        const boardPos = getBoardPositionPercent(slot.gridX, slot.gridY, projectionOpts);

        return (
          <div
            key={slot.id}
            className="absolute z-10"
            style={{
              left: `${boardPos.x}%`,
              top: `${boardPos.y}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            {player ? (
              <PitchPlayerToken
                name={`${player.firstName}${player.lastName ? ` ${player.lastName.charAt(0)}.` : ""}`}
                role={slot.shortLabel}
                number={player.shirtNumber ?? null}
                compact={compact}
              />
            ) : (
              <PitchEmptySlot role={slot.shortLabel} compact={compact} />
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
  const aspectClass = getAspectClass(orientation);
  const viewBox = getBoardViewBox({ orientation });

  if (props.mode === "position-profile") {
    const { markers } = props;
    return (
      <div className={cn("pitch-frame overflow-hidden", props.className)}>
        <div
          data-testid="pitch-surface"
          className={cn("pitch-surface tl-pitch-surface relative w-full", aspectClass)}
        >
          <PitchMarkings orientation={orientation} />
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox={viewBox}
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
      <div className={cn("pitch-frame overflow-hidden", props.className)}>
        <div
          data-testid="pitch-surface"
          className={cn("pitch-surface tl-pitch-surface relative w-full", aspectClass)}
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
      <div className={cn("pitch-frame overflow-hidden", props.className)}>
        <div
          data-testid="pitch-surface"
          className={cn("pitch-surface tl-pitch-surface relative w-full", aspectClass)}
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
            size={size}
          />
        </div>
      </div>
    );
  }

  if (props.mode === "selection-preview") {
    const { slots, assignments, players } = props;

    return (
      <div className={cn("pitch-frame overflow-hidden", props.className)}>
        <div
          data-testid="pitch-surface"
          className={cn("pitch-surface tl-pitch-surface relative w-full", aspectClass)}
        >
          <PitchMarkings orientation={orientation} />
          <SelectionPreviewContent
            slots={slots}
            assignments={assignments}
            players={players}
            orientation={orientation}
            attackingDirection={attackingDirection}
            size={size}
          />
        </div>
      </div>
    );
  }

  return null;
}