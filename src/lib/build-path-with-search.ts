export function buildPathWithSearch(
  pathname: string,
  entries: Record<string, boolean | number | string | null | undefined>,
): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(entries)) {
    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === "boolean") {
      if (value) {
        searchParams.set(key, "1");
      }

      continue;
    }

    const stringValue = String(value).trim();

    if (stringValue) {
      searchParams.set(key, stringValue);
    }
  }

  const queryString = searchParams.toString();

  return queryString ? `${pathname}?${queryString}` : pathname;
}
