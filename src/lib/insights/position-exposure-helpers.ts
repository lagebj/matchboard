export function incrementCount(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}

export function topPosition(record: Record<string, number>): string | null {
  const entries = Object.entries(record);
  if (entries.length === 0) return null;
  return entries.sort((a, b) => b[1] - a[1])[0]![0];
}

export function formatEvidenceCompleteness(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}
