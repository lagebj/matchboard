"use client";

import { useState } from "react";
import { createGroupAction } from "@/app/(app)/o/[orgSlug]/groups/actions";

const GROUP_TYPES = [
  { value: "AGE_GROUP", label: "Age group" },
  { value: "GENDER_GROUP", label: "Gender group" },
  { value: "COMPETITIVE_GROUP", label: "Competitive group" },
  { value: "CUSTOM", label: "Custom" },
];

export function CreateGroupForm({ orgSlug }: { orgSlug: string }) {
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    try {
      await createGroupAction(formData);
    } catch {
      // redirect() throws — that's expected on success
    }
    setIsPending(false);
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create group</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Groups are stable cohorts like &quot;Boys 2015&quot; that own a shared player pool, teams, and seasons.
        </p>
      </div>

      <form action={handleSubmit} className="space-y-4">
        <input type="hidden" name="orgSlug" value={orgSlug} />
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">
            Group name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            placeholder="e.g. Boys 2015"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Use a stable identity like &quot;Boys 2015&quot;, not a seasonal label like &quot;U11&quot;.
          </p>
        </div>

        <div>
          <label htmlFor="type" className="block text-sm font-medium mb-1">
            Group type
          </label>
          <select
            id="type"
            name="type"
            defaultValue="AGE_GROUP"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {GROUP_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="cohortYear" className="block text-sm font-medium mb-1">
            Cohort year (optional)
          </label>
          <input
            type="number"
            id="cohortYear"
            name="cohortYear"
            min={2000}
            max={2100}
            placeholder="e.g. 2015"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium mb-1">
            Description (optional)
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            placeholder="Brief description of this group"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <a
            href={`/o/${orgSlug}/groups`}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </a>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Creating..." : "Create group"}
          </button>
        </div>
      </form>
    </div>
  );
}