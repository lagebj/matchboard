import type { MatchVenue, SelectionRole } from "@/generated/prisma/client";

export function formatMatchVenue(venue: MatchVenue): string {
  return venue === "HOME" ? "Home" : "Away";
}

export function formatSelectionRole(role: SelectionRole): string {
  switch (role) {
    case "CORE":
      return "Core";
    case "FLOAT":
      return "Float";
    case "SUPPORT":
      return "Support";
    case "DEVELOPMENT":
      return "Development";
    case "MANUAL":
      return "Manual";
  }
}

export function isFloatingSelectionRole(role: SelectionRole): boolean {
  return (
    role === "FLOAT" ||
    role === "SUPPORT" ||
    role === "DEVELOPMENT"
  );
}
