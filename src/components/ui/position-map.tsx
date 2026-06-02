"use client";

import { cn } from "@/lib/cn";

type PositionMapProps = {
  primaryPosition?: string | null;
  secondaryPositions?: string[];
  size?: "sm" | "md" | "lg";
  className?: string;
};

const POSITION_COORDS: Record<string, { x: number; y: number }> = {
  GK: { x: 50, y: 90 },
  CB: { x: 50, y: 72 },
  LB: { x: 15, y: 72 },
  RB: { x: 85, y: 72 },
  CM: { x: 50, y: 50 },
  DM: { x: 50, y: 60 },
  AM: { x: 50, y: 40 },
  LM: { x: 15, y: 50 },
  WM: { x: 20, y: 40 },
  LW: { x: 15, y: 35 },
  RW: { x: 85, y: 35 },
  RM: { x: 85, y: 50 },
  W: { x: 20, y: 38 },
  ST: { x: 50, y: 20 },
  CF: { x: 50, y: 22 },
};

const SIZE_MAP = {
  sm: { width: 120, height: 160, dot: 6, primary: 8, font: 7 },
  md: { width: 180, height: 240, dot: 8, primary: 10, font: 8 },
  lg: { width: 240, height: 320, dot: 10, primary: 13, font: 9 },
};

export function PositionMap({
  primaryPosition,
  secondaryPositions = [],
  size = "md",
  className,
}: PositionMapProps) {
  const dims = SIZE_MAP[size];
  const primary = primaryPosition ? POSITION_COORDS[primaryPosition] : undefined;
  const secondaries = secondaryPositions
    .filter((p) => p !== primaryPosition)
    .map((p) => ({ pos: p, ...POSITION_COORDS[p] }))
    .filter(Boolean);

  return (
    <svg
      viewBox="0 0 100 100"
      width={dims.width}
      height={dims.height}
      className={cn("select-none", className)}
      role="img"
      aria-label={
        primaryPosition
          ? `Pitch position map. Primary: ${primaryPosition}${secondaries.length > 0 ? `, secondary: ${secondaries.map((s) => s.pos).join(", ")}` : ""}`
          : "Pitch position map. No position set"
      }
    >
      {/* Pitch outline */}
      <rect
        x="2" y="2" width="96" height="96"
        rx="1"
        fill="none"
        stroke="var(--border-soft)"
        strokeWidth="0.5"
      />

      {/* Halfway line */}
      <line x1="2" y1="50" x2="98" y2="50" stroke="var(--border-soft)" strokeWidth="0.4" />

      {/* Center circle */}
      <circle cx="50" cy="50" r="12" fill="none" stroke="var(--border-soft)" strokeWidth="0.4" />
      <circle cx="50" cy="50" r="1.2" fill="var(--border-soft)" />

      {/* Top penalty area */}
      <rect x="25" y="2" width="50" height="16" fill="none" stroke="var(--border-soft)" strokeWidth="0.4" rx="0.3" />
      {/* Top goal area */}
      <rect x="35" y="2" width="30" height="7" fill="none" stroke="var(--border-soft)" strokeWidth="0.3" rx="0.2" />
      {/* Top penalty spot */}
      <circle cx="50" cy="13" r="0.8" fill="var(--border-soft)" />

      {/* Bottom penalty area */}
      <rect x="25" y="82" width="50" height="16" fill="none" stroke="var(--border-soft)" strokeWidth="0.4" rx="0.3" />
      {/* Bottom goal area */}
      <rect x="35" y="91" width="30" height="7" fill="none" stroke="var(--border-soft)" strokeWidth="0.3" rx="0.2" />
      {/* Bottom penalty spot */}
      <circle cx="50" cy="87" r="0.8" fill="var(--border-soft)" />

      {/* Corner arcs */}
      <path d="M 2 6 A 4 4 0 0 1 6 2" fill="none" stroke="var(--border-soft)" strokeWidth="0.3" />
      <path d="M 94 2 A 4 4 0 0 1 98 6" fill="none" stroke="var(--border-soft)" strokeWidth="0.3" />
      <path d="M 2 94 A 4 4 0 0 0 6 98" fill="none" stroke="var(--border-soft)" strokeWidth="0.3" />
      <path d="M 94 98 A 4 4 0 0 0 98 94" fill="none" stroke="var(--border-soft)" strokeWidth="0.3" />

      {/* Secondary position markers */}
      {secondaries.map((s) => (
        <g key={s.pos}>
          <circle
            cx={s.x}
            cy={s.y}
            r={dims.dot / 2}
            fill="var(--accent)"
            opacity="0.45"
          />
          <text
            x={s.x}
            y={s.y + dims.font * 0.35}
            textAnchor="middle"
            fill="var(--accent)"
            fontSize={dims.font}
            fontWeight="500"
            opacity="0.6"
          >
            {s.pos}
          </text>
        </g>
      ))}

      {/* Primary position marker */}
      {primary && (
        <g>
          <circle
            cx={primary.x}
            cy={primary.y}
            r={dims.primary / 2}
            fill="var(--accent-strong)"
          />
          <text
            x={primary.x}
            y={primary.y + dims.font * 0.35}
            textAnchor="middle"
            fill="var(--surface-base)"
            fontSize={dims.font}
            fontWeight="700"
          >
            {primaryPosition}
          </text>
        </g>
      )}

      {/* No position set fallback */}
      {!primaryPosition && secondaries.length === 0 && (
        <text
          x="50" y="52"
          textAnchor="middle"
          fill="var(--text-muted)"
          fontSize="7"
          fontWeight="400"
        >
          No position
        </text>
      )}
    </svg>
  );
}