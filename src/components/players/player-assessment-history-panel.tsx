"use client";

import { useState, useEffect } from "react";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";

type AssessmentChangeEntry = {
  id: string;
  targetType: string;
  attributeKey: string | null;
  targetDescription: string | null;
  beforeValue: number | null;
  afterValue: number | null;
  source: string;
  reason: string | null;
  confidence: number | null;
  createdAt: string;
};

type AssessmentHistoryPanelProps = {
  playerId: string;
};

const SOURCE_LABELS: Record<string, string> = {
  AUTOMATIC: "Evidence engine",
  MANUAL_EDIT: "Coach edit",
  MIGRATION: "Migration",
  REBASE: "Manual rebase",
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  ATTRIBUTE: "Attribute",
  GOALKEEPER: "Goalkeeper",
  POSITION: "Position",
};

export function AssessmentHistoryPanel({ playerId }: AssessmentHistoryPanelProps) {
  const [changes, setChanges] = useState<AssessmentChangeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch(`/api/players/${playerId}/assessment-history`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setChanges(data.changes ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, [playerId]);

  if (loading) {
    return (
      <Surface>
        <div className="p-4 text-sm text-muted-foreground">Loading assessment history...</div>
      </Surface>
    );
  }

  if (error) {
    return (
      <Surface>
        <div className="p-4 text-sm text-destructive">{error}</div>
      </Surface>
    );
  }

  return (
    <Surface>
      <div className="p-4">
        <SectionHeader title="Assessment history" description="Attribute changes recorded by the evidence engine or coach." />
        {changes.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-2">No assessment changes recorded.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {changes.slice(0, 20).map((change) => (
              <div
                key={change.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">
                    {change.attributeKey ?? TARGET_TYPE_LABELS[change.targetType] ?? change.targetType}
                  </span>
                  {change.targetDescription && (
                    <span className="text-xs text-muted-foreground">{change.targetDescription}</span>
                  )}
                  {change.reason && (
                    <span className="text-xs text-muted-foreground">{change.reason}</span>
                  )}
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="font-mono text-sm">
                    {change.beforeValue !== null ? Number(change.beforeValue).toFixed(0) : "—"} → {change.afterValue !== null ? Number(change.afterValue).toFixed(0) : "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {SOURCE_LABELS[change.source] ?? change.source}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(change.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
            {changes.length > 20 && (
              <p className="text-xs text-muted-foreground text-center">
                Showing 20 of {changes.length} changes
              </p>
            )}
          </div>
        )}
      </div>
    </Surface>
  );
}