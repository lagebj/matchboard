import type { MatchVenue, SelectionRole } from "@/generated/prisma/client";

export function formatMatchVenue(venue: MatchVenue): string {
  return venue === "HOME" ? "Home" : "Away";
}

export function formatSelectionRole(role: SelectionRole): string {
  switch (role) {
    case "CORE":
      return "Core";
    case "SUPPORT":
      return "Support";
    case "DEVELOPMENT":
      return "Development";
    case "BACKFILL":
      return "Squad Repair";
    case "CONFIDENCE_REBUILD":
      return "Confidence Rebuild";
    case "CORE_MATCH_DROP":
      return "Core Drop";
    case "REDUCED_MATCH_LOAD_DROP":
      return "Reduced Load Drop";
    case "MANUAL_OVERRIDE":
      return "Manual Override";
  }
}

// A floating role is any non-core role where the player is movement-eligible.
// BACKFILL, CONFIDENCE_REBUILD, CORE_MATCH_DROP, and REDUCED_MATCH_LOAD_DROP
// are legacy roles retained for backward compatibility with historical data.
// New generation only produces SUPPORT and DEVELOPMENT as floating roles.
export function isFloatingSelectionRole(role: SelectionRole): boolean {
  return (
    role === "SUPPORT" ||
    role === "DEVELOPMENT" ||
    role === "BACKFILL" ||
    role === "CONFIDENCE_REBUILD" ||
    role === "CORE_MATCH_DROP" ||
    role === "REDUCED_MATCH_LOAD_DROP"
  );
}