/**
 * Today football-atmosphere decorative layer (ADR-0141, ADR-0142, Today Atmosphere Finish
 * follow-up). Static repository-owned WebP background image driven entirely by the
 * `--tl-today-atmosphere-image` / `--tl-today-atmosphere-opacity` theme tokens in
 * `touchline.css` — this component owns no theme branching itself. Purely decorative:
 * `aria-hidden`, no text, no interactive content, `pointer-events: none` (via the `.today-atmosphere`
 * class). Renders behind the Today heading/Live Now region only, never behind the full page.
 */
export function TodayAtmosphere() {
  return <div className="today-atmosphere" aria-hidden="true" />;
}
