"use client";

import { useMemo, useState } from "react";
import {
  computeRotationGraphLayout,
  ROTATION_GRAPH_NODE_RADIUS,
  type RotationGraphPathInput,
  type RotationGraphRole,
  type RotationGraphTeam,
} from "@/lib/rules/rotation-graph-layout";

const ROLE_COLORS: Record<RotationGraphRole, string> = {
  SUPPORT: "#38bdf8",
  DEVELOPMENT: "#34d399",
  BACKFILL: "#a78bfa",
};

const ROLE_LABELS: Record<RotationGraphRole, string> = {
  SUPPORT: "Support",
  DEVELOPMENT: "Development",
  BACKFILL: "Squad repair",
};

type RotationPathGraphProps = {
  teams: RotationGraphTeam[];
  paths: RotationGraphPathInput[];
};

// Visual complement to the accessible rotation-path card list already rendered on /rules — the
// cards remain the accessible, screen-reader-friendly source of truth for path detail; this
// diagram is a supplementary at-a-glance view of the movement network (platform-integrity-
// programme Phase 12, current-state-remediation A-017).
export function RotationPathGraph({ teams, paths }: RotationPathGraphProps) {
  const layout = useMemo(() => computeRotationGraphLayout(teams, paths), [teams, paths]);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  if (layout.nodes.length === 0) {
    return null;
  }

  const hoveredEdge = layout.edges.find((edge) => edge.id === hoveredEdgeId) ?? null;

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <svg
        viewBox={`0 0 ${layout.viewBoxSize} ${layout.viewBoxSize}`}
        role="img"
        aria-label="Rotation path network diagram — team-to-team movement paths by role. See the list below for full detail."
        className="mx-auto h-auto w-full max-w-sm"
      >
        <defs>
          {(Object.entries(ROLE_COLORS) as [RotationGraphRole, string][]).map(([role, color]) => (
            <marker
              key={role}
              id={`rotation-arrow-${role}`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill={color} />
            </marker>
          ))}
        </defs>

        {layout.edges.map((edge) => (
          <path
            key={edge.id}
            d={edge.path}
            fill="none"
            stroke={ROLE_COLORS[edge.role]}
            strokeWidth={edge.id === hoveredEdgeId ? 2.5 : 1.5}
            strokeOpacity={hoveredEdgeId && edge.id !== hoveredEdgeId ? 0.25 : 0.85}
            markerEnd={`url(#rotation-arrow-${edge.role})`}
            className="cursor-pointer"
            onMouseEnter={() => setHoveredEdgeId(edge.id)}
            onMouseLeave={() => setHoveredEdgeId(null)}
          >
            <title>{`${ROLE_LABELS[edge.role]}: ${edge.fromName} → ${edge.toName} — ${edge.purpose}`}</title>
          </path>
        ))}

        {layout.nodes.map((node) => (
          <g key={node.id}>
            <circle
              cx={node.x}
              cy={node.y}
              r={ROTATION_GRAPH_NODE_RADIUS}
              fill="#27272a"
              stroke="#52525b"
              strokeWidth={1}
            >
              <title>{node.name}</title>
            </circle>
            <text x={node.x} y={node.y} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="#d4d4d8">
              {truncateLabel(node.name)}
            </text>
          </g>
        ))}
      </svg>

      <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] text-zinc-500">
        {(Object.entries(ROLE_LABELS) as [RotationGraphRole, string][]).map(([role, label]) => (
          <span key={role} className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ROLE_COLORS[role] }} />
            {label}
          </span>
        ))}
      </div>

      <p className="min-h-[1.25rem] text-center text-[10px] text-zinc-400">
        {hoveredEdge
          ? `${hoveredEdge.fromName} → ${hoveredEdge.toName} · ${ROLE_LABELS[hoveredEdge.role]}${
              hoveredEdge.priority != null ? ` · priority ${hoveredEdge.priority}` : ""
            }`
          : "Hover a path to see its role and priority."}
      </p>
    </div>
  );
}

function truncateLabel(name: string): string {
  return name.length > 10 ? `${name.slice(0, 9)}…` : name;
}
