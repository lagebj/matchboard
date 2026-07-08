"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createEventAction } from "@/app/(app)/events/actions";

type Formation = {
  id: string;
  name: string;
  gameFormat: string;
};

const GAME_FORMAT_OPTIONS = [
  { value: "THREE_A_SIDE", label: "3-a-side" },
  { value: "FIVE_A_SIDE", label: "5-a-side" },
  { value: "SEVEN_A_SIDE", label: "7-a-side" },
  { value: "NINE_A_SIDE", label: "9-a-side" },
  { value: "ELEVEN_A_SIDE", label: "11-a-side" },
] as const;

function formatGameFormat(gf: string): string {
  return gf.replace("_", "-").toLowerCase();
}

export function CreateEventForm({ formations }: { formations: Formation[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [eventType, setEventType] = useState("CUP");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [gameFormat, setGameFormat] = useState("SEVEN_A_SIDE");
  const [defaultFormationId, setDefaultFormationId] = useState("");
  const [selectionPattern, setSelectionPattern] = useState("ALL_BALANCED");
  const [squadCount, setSquadCount] = useState(2);
  const [targetSize, setTargetSize] = useState(7);
  const [notes, setNotes] = useState("");

  const filteredFormations = formations.filter(
    (f) => f.gameFormat === gameFormat,
  );

  function handleGameFormatChange(newFormat: string) {
    setGameFormat(newFormat);
    const currentFormation = formations.find((f) => f.id === defaultFormationId);
    if (currentFormation && currentFormation.gameFormat !== newFormat) {
      setDefaultFormationId("");
    }
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createEventAction(formData);
        setError("Event was created but could not navigate. Check the events list.");
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "NEXT_REDIRECT") {
          throw err;
        }
        setError(err instanceof Error ? err.message : "Failed to create event.");
      }
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create Event</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Set up a cup, tournament, or friendly day for squad planning
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <form action={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              Event name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm bg-[var(--surface-base)] border-[var(--border-soft)] text-zinc-200 focus:border-[var(--accent-strong)] focus:ring-1 focus:ring-[var(--accent-strong)]"
              placeholder="Spring Cup 2026"
            />
          </div>

          <div>
            <label htmlFor="eventType" className="block text-sm font-medium mb-1">
              Event type
            </label>
            <select
              id="eventType"
              name="eventType"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm bg-[var(--surface-base)] border-[var(--border-soft)] text-zinc-200 focus:border-[var(--accent-strong)] focus:ring-1 focus:ring-[var(--accent-strong)]"
            >
              <option value="CUP">Cup</option>
              <option value="TOURNAMENT">Tournament</option>
              <option value="FRIENDLY_DAY">Friendly day</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="startsAt" className="block text-sm font-medium mb-1">
                Start date *
              </label>
              <input
                type="date"
                id="startsAt"
                name="startsAt"
                required
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm bg-[var(--surface-base)] border-[var(--border-soft)] text-zinc-200 focus:border-[var(--accent-strong)] focus:ring-1 focus:ring-[var(--accent-strong)]"
              />
            </div>
            <div>
              <label htmlFor="endsAt" className="block text-sm font-medium mb-1">
                End date
              </label>
              <input
                type="date"
                id="endsAt"
                name="endsAt"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm bg-[var(--surface-base)] border-[var(--border-soft)] text-zinc-200 focus:border-[var(--accent-strong)] focus:ring-1 focus:ring-[var(--accent-strong)]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="gameFormat" className="block text-sm font-medium mb-1">
              Game format
            </label>
            <select
              id="gameFormat"
              name="gameFormat"
              value={gameFormat}
              onChange={(e) => handleGameFormatChange(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm bg-[var(--surface-base)] border-[var(--border-soft)] text-zinc-200 focus:border-[var(--accent-strong)] focus:ring-1 focus:ring-[var(--accent-strong)]"
            >
              {GAME_FORMAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="defaultFormationId" className="block text-sm font-medium mb-1">
              Default formation
            </label>
            <select
              id="defaultFormationId"
              name="defaultFormationId"
              value={defaultFormationId}
              onChange={(e) => setDefaultFormationId(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm bg-[var(--surface-base)] border-[var(--border-soft)] text-zinc-200 focus:border-[var(--accent-strong)] focus:ring-1 focus:ring-[var(--accent-strong)]"
            >
              <option value="">No formation (role template)</option>
              {filteredFormations.length === 0 ? (
                <option disabled>
                  No formations available for {formatGameFormat(gameFormat)}
                </option>
              ) : (
                filteredFormations.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({formatGameFormat(f.gameFormat)})
                  </option>
                ))
              )}
            </select>
            {filteredFormations.length === 0 && (
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                No formations available for {formatGameFormat(gameFormat)}. Squad generation will use role templates instead.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="selectionPattern" className="block text-sm font-medium mb-1">
              Selection pattern
            </label>
            <select
              id="selectionPattern"
              name="selectionPattern"
              value={selectionPattern}
              onChange={(e) => setSelectionPattern(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm bg-[var(--surface-base)] border-[var(--border-soft)] text-zinc-200 focus:border-[var(--accent-strong)] focus:ring-1 focus:ring-[var(--accent-strong)]"
            >
              <option value="ALL_BALANCED">All squads balanced</option>
              <option value="ONE_COMPETITIVE_BALANCED_REMAINDER">
                One competitive squad + balanced remainder
              </option>
              <option value="MANUAL_SEED_AUTO_BALANCE">
                Manual seed + auto balance
              </option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="squadCount" className="block text-sm font-medium mb-1">
                Number of squads
              </label>
              <input
                type="number"
                id="squadCount"
                name="squadCount"
                min={2}
                max={10}
                value={squadCount}
                onChange={(e) => setSquadCount(parseInt(e.target.value) || 2)}
                className="w-full rounded-md border px-3 py-2 text-sm bg-[var(--surface-base)] border-[var(--border-soft)] text-zinc-200 focus:border-[var(--accent-strong)] focus:ring-1 focus:ring-[var(--accent-strong)]"
              />
            </div>
            <div>
              <label htmlFor="targetSize" className="block text-sm font-medium mb-1">
                Target squad size
              </label>
              <input
                type="number"
                id="targetSize"
                name="targetSize"
                min={3}
                max={18}
                value={targetSize}
                onChange={(e) => setTargetSize(parseInt(e.target.value) || 7)}
                className="w-full rounded-md border px-3 py-2 text-sm bg-[var(--surface-base)] border-[var(--border-soft)] text-zinc-200 focus:border-[var(--accent-strong)] focus:ring-1 focus:ring-[var(--accent-strong)]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium mb-1">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm bg-[var(--surface-base)] border-[var(--border-soft)] text-zinc-200 focus:border-[var(--accent-strong)] focus:ring-1 focus:ring-[var(--accent-strong)]"
              placeholder="Optional notes about the event..."
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Creating..." : "Create event"}
          </button>
          <Link
            href="/events"
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}