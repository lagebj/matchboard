"use client";

/**
 * Client-side helper for `POST /api/live-match/[matchId]/realtime-ticket`. Shared by the
 * reporting coach's best-effort broadcast side-channel (`league-live-match-client.tsx`) and
 * the read-only "Follow live" viewer page — both need a fresh ticket per `RealtimeMatchClient`
 * connect/reconnect (SPEC.md §27), never a cached one.
 */

const LOG_PREFIX = "[live-match:ticket]";

export async function fetchRealtimeTicket(matchId: string, mode: "report" | "view"): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`/api/live-match/${matchId}/realtime-ticket`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} fetch failed (mode=%s, matchId=%s): %s`, mode, matchId, error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to fetch realtime ticket (mode=${mode}): network error.`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`${LOG_PREFIX} ticket endpoint returned %d (mode=%s, matchId=%s): %s`, response.status, mode, matchId, body);
    throw new Error(`Failed to obtain a realtime ticket (${response.status}).`);
  }

  const body = (await response.json()) as { ticket?: string };
  if (typeof body.ticket !== "string") {
    console.error(`${LOG_PREFIX} ticket response malformed (mode=%s, matchId=%s): %s`, mode, matchId, JSON.stringify(body));
    throw new Error("Realtime ticket response was malformed.");
  }

  return body.ticket;
}
