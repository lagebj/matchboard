/**
 * Atlas Follow-up (05_SHIRT_IDENTITY_AND_TEAM_KIT_COLOR.md): the one validated, canonical
 * "product palette" for `Team.kitColor`. A compact, deliberate set of classic kit hues —
 * not a colour picker, not stripes/patterns/home-away variants. Dependency-free (no `@/lib/db`
 * import) so both server actions and client components (the swatch selector, `TeamKitMark`) can
 * import it directly.
 *
 * This is unrelated to Settings' Appearance (System/Light/Dark) theme control — see
 * `docs/domain/touchline-atlas-provenance.md` §0.10, which confirms no app-wide accent-colour
 * picker exists and none is added here. `kitColor` is a per-team presentation value only.
 */

export type KitColorId =
  | "RED"
  | "BLUE"
  | "SKY_BLUE"
  | "NAVY"
  | "GREEN"
  | "YELLOW"
  | "ORANGE"
  | "PURPLE"
  | "MAROON"
  | "BLACK"
  | "WHITE";

export type KitColorSwatch = {
  id: KitColorId;
  label: string;
  /** Shirt fill. */
  hex: string;
  /** Automatic readable number/text colour for this fill (contract §4: "automatic readable number colour"). */
  textHex: string;
};

/**
 * Order is the preset swatch-picker order (contract §2: "a compact preset swatch palette").
 * Values are shirt-fill hex only — no stripes, sleeves, shorts, socks, patterns, sponsor or
 * manufacturer marks (all explicitly out of scope, contract §2).
 */
export const KIT_COLOR_PALETTE: readonly KitColorSwatch[] = [
  { id: "RED", label: "Red", hex: "#d5342c", textHex: "#ffffff" },
  { id: "BLUE", label: "Blue", hex: "#1d4fa8", textHex: "#ffffff" },
  { id: "SKY_BLUE", label: "Sky blue", hex: "#3aa0e0", textHex: "#0b1c2b" },
  { id: "NAVY", label: "Navy", hex: "#132a52", textHex: "#ffffff" },
  { id: "GREEN", label: "Green", hex: "#1c7a4d", textHex: "#ffffff" },
  { id: "YELLOW", label: "Yellow", hex: "#e8c521", textHex: "#1a1a1a" },
  { id: "ORANGE", label: "Orange", hex: "#d9702b", textHex: "#1a1a1a" },
  { id: "PURPLE", label: "Purple", hex: "#5b3a94", textHex: "#ffffff" },
  { id: "MAROON", label: "Maroon", hex: "#6e2136", textHex: "#ffffff" },
  { id: "BLACK", label: "Black", hex: "#1c1c1e", textHex: "#ffffff" },
  { id: "WHITE", label: "White", hex: "#f2f2f2", textHex: "#1a1a1a" },
] as const;

const KIT_COLOR_MAP: ReadonlyMap<string, KitColorSwatch> = new Map(
  KIT_COLOR_PALETTE.map((swatch) => [swatch.id, swatch]),
);

export function isValidKitColor(value: string): value is KitColorId {
  return KIT_COLOR_MAP.has(value);
}

/**
 * Resolves a stored `kitColor` value to its swatch, or `null` for unset/unrecognised values —
 * never throws. An unrecognised stored value (e.g. a since-removed palette entry) degrades to
 * the neutral default, matching contract §3 ("Default: neutral Touchline shirt when unset").
 */
export function resolveKitColorSwatch(kitColor: string | null | undefined): KitColorSwatch | null {
  if (!kitColor) return null;
  return KIT_COLOR_MAP.get(kitColor) ?? null;
}
