"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOrganisationAction } from "./actions";

export function CreateOrganisationForm() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createOrganisationAction(name);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="flex-1">
        <label htmlFor="new-org-name" className="sr-only">
          Organisation name
        </label>
        <input
          id="new-org-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Organisation name"
          required
          disabled={isPending}
          className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2 text-sm text-zinc-100 placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--accent)]"
        />
        {error && <p className="mt-1.5 text-xs text-[var(--danger)]">{error}</p>}
      </div>
      <button
        type="submit"
        disabled={isPending || !name.trim()}
        className="shrink-0 rounded-md bg-[var(--surface-2)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface-3)] disabled:opacity-50"
      >
        {isPending ? "Creating…" : "Create organisation"}
      </button>
    </form>
  );
}
