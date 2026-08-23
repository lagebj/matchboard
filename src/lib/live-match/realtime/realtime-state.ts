/**
 * Client-side realtime version tracking (SPEC.md §6). The MatchSession actor owns a
 * monotonically increasing version; each connected client tracks the last version it
 * applied and uses this comparison to decide whether an incoming version-carrying callback
 * is a duplicate, the next expected update, or evidence of a missed update requiring
 * snapshot recovery.
 *
 * Pure logic, no I/O — SPEC.md §6 is explicit the browser must not attempt clever conflict
 * merging; ordering is the MatchSession actor's responsibility alone.
 */

export type VersionComparisonResult = "duplicate" | "apply" | "gap";

export function compareIncomingVersion(lastAppliedVersion: number, incomingVersion: number): VersionComparisonResult {
  if (incomingVersion <= lastAppliedVersion) {
    return "duplicate";
  }
  if (incomingVersion === lastAppliedVersion + 1) {
    return "apply";
  }
  return "gap";
}

/**
 * Minimal mutable tracker for a single connection's applied version. Kept as a small class
 * (rather than free functions threading state) because `RealtimeMatchClient` (SPEC.md §27)
 * owns exactly one of these per connection and mutates it as callbacks arrive.
 */
export class RealtimeVersionTracker {
  private lastAppliedVersion = 0;

  get current(): number {
    return this.lastAppliedVersion;
  }

  /** Resets to a snapshot's version (SPEC.md §25) — used on attach/reconnect/forced resync. */
  resetTo(version: number): void {
    this.lastAppliedVersion = version;
  }

  /**
   * Evaluates an incoming version-carrying callback against the current state. Only
   * advances `current` when the result is `"apply"` — callers must request a fresh
   * snapshot themselves on `"gap"` (SPEC.md §6) rather than this tracker silently jumping
   * ahead, since that would hide missed intermediate state from the caller.
   */
  evaluate(incomingVersion: number): VersionComparisonResult {
    const result = compareIncomingVersion(this.lastAppliedVersion, incomingVersion);
    if (result === "apply") {
      this.lastAppliedVersion = incomingVersion;
    }
    return result;
  }
}
