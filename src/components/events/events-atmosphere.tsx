/**
 * Events football-atmosphere decorative layer (Matchboard Events Operating Surface bundle,
 * `02_ATMOSPHERE_ASSET_AND_BLEND_CONTRACT.md`). Static repository-owned WebP background image
 * driven entirely by the `--tl-events-atmosphere-image` / `--tl-events-atmosphere-opacity` theme
 * tokens in `touchline.css` — mirrors `TodayAtmosphere`'s pattern exactly (this component owns no
 * theme branching itself). Purely decorative: `aria-hidden`, no text, no interactive content,
 * `pointer-events: none` (via the `.events-atmosphere` class). Renders behind the Events route's
 * page header + Next Event hero only, never behind the full page or inside any Event card.
 */
export function EventsAtmosphere() {
  return <div className="events-atmosphere" aria-hidden="true" />;
}
