// Pure layout for the rotation-path network diagram on /rules (platform-integrity-programme
// Phase 12, current-state-remediation A-017). No graph library dependency — a simple circular
// layout is enough for the team counts this app deals with, and keeps this testable without
// React or a browser.

export type RotationGraphTeam = {
  id: string;
  name: string;
};

export type RotationGraphRole = "SUPPORT" | "DEVELOPMENT" | "BACKFILL";

const ROTATION_GRAPH_ROLES = new Set<RotationGraphRole>(["SUPPORT", "DEVELOPMENT", "BACKFILL"]);

function isRotationGraphRole(role: string): role is RotationGraphRole {
  return ROTATION_GRAPH_ROLES.has(role as RotationGraphRole);
}

export type RotationGraphPathInput = {
  id: string;
  fromTeamId: string;
  fromTeamName: string;
  toTeamId: string;
  toTeamName: string;
  // Widened beyond RotationGraphRole because RotationPath.role is typed as the full
  // SelectionRole Prisma enum even though app-level generation only ever writes SUPPORT,
  // DEVELOPMENT, or BACKFILL to this table (see AGENTS.md "RotationPath authority"). Any other
  // value is defensively skipped rather than assumed away.
  role: string;
  purpose: string;
  priority: number | null;
};

export type RotationGraphNode = {
  id: string;
  name: string;
  x: number;
  y: number;
};

export type RotationGraphEdge = {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  role: RotationGraphRole;
  purpose: string;
  priority: number | null;
  path: string;
};

export type RotationGraphLayout = {
  nodes: RotationGraphNode[];
  edges: RotationGraphEdge[];
  viewBoxSize: number;
};

export const ROTATION_GRAPH_VIEW_BOX_SIZE = 320;
export const ROTATION_GRAPH_NODE_RADIUS = 22;

export function computeRotationGraphLayout(
  teams: RotationGraphTeam[],
  paths: RotationGraphPathInput[],
): RotationGraphLayout {
  const center = ROTATION_GRAPH_VIEW_BOX_SIZE / 2;
  const radius = ROTATION_GRAPH_VIEW_BOX_SIZE * 0.38;
  const count = teams.length;

  const positionById = new Map<string, { x: number; y: number }>();
  const nodes: RotationGraphNode[] = teams.map((team, index) => {
    const angle = count === 0 ? 0 : (2 * Math.PI * index) / count - Math.PI / 2;
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);
    positionById.set(team.id, { x, y });
    return { id: team.id, name: team.name, x, y };
  });

  // Reciprocal or parallel paths between the same pair of teams would otherwise render as
  // overlapping straight lines. Spread them across a curvature range keyed by the unordered
  // pair, so A->B and B->A (and multiple paths in the same direction) each get a distinct arc.
  const pairKey = (a: string, b: string) => [a, b].sort().join("::");
  const pairTotals = new Map<string, number>();
  for (const path of paths) {
    if (path.fromTeamId === path.toTeamId) continue;
    if (!isRotationGraphRole(path.role)) continue;
    const key = pairKey(path.fromTeamId, path.toTeamId);
    pairTotals.set(key, (pairTotals.get(key) ?? 0) + 1);
  }
  const pairSeen = new Map<string, number>();

  const edges: RotationGraphEdge[] = [];
  for (const path of paths) {
    if (path.fromTeamId === path.toTeamId) continue;
    if (!isRotationGraphRole(path.role)) continue;

    const from = positionById.get(path.fromTeamId);
    const to = positionById.get(path.toTeamId);
    if (!from || !to) continue;

    const key = pairKey(path.fromTeamId, path.toTeamId);
    const seenIndex = pairSeen.get(key) ?? 0;
    pairSeen.set(key, seenIndex + 1);
    const total = pairTotals.get(key) ?? 1;
    const curvature = total > 1 ? (seenIndex - (total - 1) / 2) * 0.4 : 0;

    edges.push({
      id: path.id,
      fromId: path.fromTeamId,
      fromName: path.fromTeamName,
      toId: path.toTeamId,
      toName: path.toTeamName,
      role: path.role,
      purpose: path.purpose,
      priority: path.priority,
      path: buildEdgePath(from, to, curvature),
    });
  }

  return { nodes, edges, viewBoxSize: ROTATION_GRAPH_VIEW_BOX_SIZE };
}

function buildEdgePath(from: { x: number; y: number }, to: { x: number; y: number }, curvature: number): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.sqrt(dx * dx + dy * dy) || 1;
  const unitX = dx / distance;
  const unitY = dy / distance;

  // Trim endpoints to the node circle boundary so arrowheads land on the edge, not the center.
  const startX = from.x + unitX * ROTATION_GRAPH_NODE_RADIUS;
  const startY = from.y + unitY * ROTATION_GRAPH_NODE_RADIUS;
  const endX = to.x - unitX * ROTATION_GRAPH_NODE_RADIUS;
  const endY = to.y - unitY * ROTATION_GRAPH_NODE_RADIUS;

  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  const normalX = -unitY;
  const normalY = unitX;
  const offset = curvature * distance;
  const controlX = midX + normalX * offset;
  const controlY = midY + normalY * offset;

  return `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;
}
