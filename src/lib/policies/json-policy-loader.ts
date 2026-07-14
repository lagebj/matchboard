import type { PolicyPack } from "./types";

export class PolicyLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyLoadError";
  }
}

export function parsePolicyPack(json: unknown): PolicyPack {
  if (typeof json !== "object" || json === null) {
    throw new PolicyLoadError("Policy must be a non-null object.");
  }

  const obj = json as Record<string, unknown>;

  if (typeof obj.id !== "string" || obj.id.trim() === "") {
    throw new PolicyLoadError("Policy pack must have a non-empty string 'id'.");
  }
  if (typeof obj.name !== "string" || obj.name.trim() === "") {
    throw new PolicyLoadError("Policy pack must have a non-empty string 'name'.");
  }
  if (typeof obj.version !== "string" || obj.version.trim() === "") {
    throw new PolicyLoadError("Policy pack must have a non-empty string 'version'.");
  }
  if (!Array.isArray(obj.rules)) {
    throw new PolicyLoadError("Policy pack must have a 'rules' array.");
  }

  const validEffects = new Set(["deny", "warning", "score_adjustment", "tag"]);
  const validOps = new Set([
    "eq", "neq", "lt", "lte", "gt", "gte",
    "in", "not_in", "exists", "not_exists", "contains",
  ]);

  const rules = obj.rules.map((rule: unknown, index: number) => {
    if (typeof rule !== "object" || rule === null) {
      throw new PolicyLoadError(`Rule at index ${index} must be an object.`);
    }

    const r = rule as Record<string, unknown>;

    if (typeof r.id !== "string" || r.id.trim() === "") {
      throw new PolicyLoadError(`Rule at index ${index} must have a non-empty string 'id'.`);
    }

    if (!validEffects.has(r.effect as string)) {
      throw new PolicyLoadError(
        `Rule '${r.id}' has invalid effect '${r.effect}'. Valid effects: ${[...validEffects].join(", ")}.`,
      );
    }

    if (typeof r.when !== "object" || r.when === null) {
      throw new PolicyLoadError(`Rule '${r.id}' must have a 'when' condition group.`);
    }

    const when = r.when as Record<string, unknown>;

    if (when.all && !Array.isArray(when.all)) {
      throw new PolicyLoadError(`Rule '${r.id}' 'all' must be an array of conditions.`);
    }
    if (when.any && !Array.isArray(when.any)) {
      throw new PolicyLoadError(`Rule '${r.id}' 'any' must be an array of conditions.`);
    }

    const conditions = [
      ...((when.all as unknown[]) ?? []),
      ...((when.any as unknown[]) ?? []),
    ];

    for (const cond of conditions) {
      if (typeof cond !== "object" || cond === null) {
        throw new PolicyLoadError(`Rule '${r.id}' has a non-object condition.`);
      }
      const c = cond as Record<string, unknown>;
      if (typeof c.field !== "string") {
        throw new PolicyLoadError(`Rule '${r.id}' condition must have a string 'field'.`);
      }
      if (!validOps.has(c.op as string)) {
        throw new PolicyLoadError(
          `Rule '${r.id}' condition has invalid operator '${c.op}'. Valid: ${[...validOps].join(", ")}.`,
        );
      }
    }

    if (r.effect === "score_adjustment" && typeof r.scoreAdjustment !== "number") {
      throw new PolicyLoadError(
        `Rule '${r.id}' with effect 'score_adjustment' must have a numeric 'scoreAdjustment'.`,
      );
    }

    if (r.effect === "warning" && (!r.warning || typeof r.warning !== "object")) {
      throw new PolicyLoadError(
        `Rule '${r.id}' with effect 'warning' must have a 'warning' object with code, severity, and message.`,
      );
    }

    return {
      id: r.id as string,
      effect: r.effect as "deny" | "warning" | "score_adjustment" | "tag",
      when: r.when as Record<string, unknown>,
      reason: r.reason as string | undefined,
      scoreAdjustment: r.scoreAdjustment as number | undefined,
      warning: r.warning as { code: string; severity: "info" | "warning" | "blocking"; message: string } | undefined,
      tag: r.tag as string | undefined,
    };
  });

  return {
    id: obj.id,
    name: obj.name,
    version: obj.version,
    description: typeof obj.description === "string" ? obj.description : undefined,
    rules,
  };
}

export function loadPolicyPackFromJson(jsonString: string): PolicyPack {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    throw new PolicyLoadError(`Invalid JSON: ${(e as Error).message}`);
  }
  return parsePolicyPack(parsed);
}

let cachedCustomPolicy: PolicyPack | null | undefined = undefined;

export function loadCustomPolicyPack(): PolicyPack | null {
  if (cachedCustomPolicy !== undefined) {
    return cachedCustomPolicy;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("path");
    const customPath = path.join(process.cwd(), "policies", "custom", "custom.policy.json");

    if (!fs.existsSync(customPath)) {
      cachedCustomPolicy = null;
      return null;
    }

    const content = fs.readFileSync(customPath, "utf-8");
    const pack = loadPolicyPackFromJson(content);
    cachedCustomPolicy = pack;
    return pack;
  } catch (e) {
    if (e instanceof PolicyLoadError) {
      console.error("[Policy] Custom policy failed to load:", e.message);
      throw e;
    }
    console.error("[Policy] Failed to load custom policy:", (e as Error).message);
    cachedCustomPolicy = null;
    return null;
  }
}

export function clearPolicyCache(): void {
  cachedCustomPolicy = undefined;
}