"use client";

/**
 * Client-side helper for `POST /api/live-match/[matchId]/realtime-ticket`. Shared by the
 * reporting coach's best-effort broadcast side-channel (`league-live-match-client.tsx`) and
 * the read-only "Follow live" viewer page — both need a fresh ticket per `RealtimeMatchClient`
 * connect/reconnect (SPEC.md §27), never a cached one.
 */
export async function fetchRealtimeTicket(matchId: string, mode: "report" | "view"): Promise<string> {
  const response = await fetch(`/api/live-match/${matchId}/realtime-ticket`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });

  if (!response.ok) {
    throw new Error(`Failed to obtain a realtime ticket (${response.status}).`);
  }

  const body = (await response.json()) as { ticket?: string };
  if (typeof body.ticket !== "string") {
    throw new Error("Realtime ticket response was malformed.");
  }

  return body.ticket;
}
