// Shared metadata helpers for policy build/verify/sync/validate/list/dry-run scripts.
//
// Policy pack metadata supports two schema versions:
//   schemaVersion 1: a single `entrypoint: string` field (legacy).
//   schemaVersion 2: a named `entrypoints: Record<string, string>` map, must include "selection".
//
// `resolveEntrypoints(metadata)` normalizes either shape to a name -> Rego package path map,
// so callers never branch on schemaVersion themselves.

export function resolveEntrypoints(metadata) {
  if (metadata.schemaVersion === 2) {
    if (metadata.entrypoints && typeof metadata.entrypoints === "object" && !Array.isArray(metadata.entrypoints)) {
      return { ...metadata.entrypoints };
    }
    return {};
  }

  if (typeof metadata.entrypoint === "string" && metadata.entrypoint.length > 0) {
    return { selection: metadata.entrypoint };
  }

  return {};
}

export function getEntrypoint(metadata, name) {
  const entrypoints = resolveEntrypoints(metadata);
  const path = entrypoints[name];
  if (!path) {
    throw new Error(`Pack '${metadata.id ?? "(unknown)"}' has no declared '${name}' entrypoint.`);
  }
  return path;
}

export function listEntrypointNames(metadata) {
  return Object.keys(resolveEntrypoints(metadata));
}

/** Build the `opa build` argv fragment covering every declared entrypoint (one -e per entry). */
export function buildEntrypointArgs(metadata) {
  const entrypoints = resolveEntrypoints(metadata);
  const names = Object.keys(entrypoints);
  if (names.length === 0) {
    throw new Error(`Pack '${metadata.id ?? "(unknown)"}' declares no entrypoints.`);
  }
  return names.flatMap((name) => ["-e", entrypoints[name]]);
}
