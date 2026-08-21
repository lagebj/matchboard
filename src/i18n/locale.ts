/**
 * Locale-neutral: this module only decides which supported locale applies to a request.
 * It never affects routing (no `[locale]` segment, no locale-prefixed URLs) — per
 * PROGRAMME.md §9, authenticated entity URLs must stay locale-neutral
 * (`/o/{orgSlug}/players/{playerId}`, not `/en/o/{orgSlug}/players/{playerId}`).
 */

export const SUPPORTED_LOCALES = ["en", "en-XA"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en";

/** `en-XA` is the Test/QA pseudo-locale: accented characters and expanded string
 * length to reveal hardcoded English and layout clipping, while remaining readable
 * (PROGRAMME.md §9). It is never served by default — only via explicit cookie/query. */
export const PSEUDO_LOCALE: SupportedLocale = "en-XA";

export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Locale precedence per PROGRAMME.md §9: explicit user preference, then saved
 * preference, then browser preference on first use, then English fallback.
 *
 * There is no per-user database preference field yet (out of scope for this packet —
 * no locale-switcher UI exists). The `NEXT_LOCALE` cookie serves both the "explicit"
 * tier (set the instant a user visits `/api/locale?locale=...`) and the "saved
 * preference" tier (persists across visits) until a real settings toggle exists.
 */
export function matchAcceptLanguage(acceptLanguageHeader: string | null): SupportedLocale {
  if (!acceptLanguageHeader) return DEFAULT_LOCALE;

  const preferredTags = acceptLanguageHeader
    .split(",")
    .map((part) => part.split(";")[0]?.trim())
    .filter((tag): tag is string => !!tag);

  for (const tag of preferredTags) {
    if (isSupportedLocale(tag)) return tag;
    const primary = tag.split("-")[0];
    if (isSupportedLocale(primary)) return primary;
  }

  return DEFAULT_LOCALE;
}
