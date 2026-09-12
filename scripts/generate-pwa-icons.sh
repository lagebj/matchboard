#!/bin/sh
# Regenerate Matchboard's PWA icon assets from the canonical brand mark.
#
# This is a reproducibility/documentation script — it is NOT wired into the
# build or `npm run validate`. The committed PNGs/ICO it produces are the
# deliverable. Re-run it only when the brand mark or brand colour changes.
#
# Touchline treatment (ADR-0136 Phase 8, `11_BRAND_ICON_AND_PWA_CONTRACT.md`):
# same mark (public/brand/logo.svg), unchanged geometry — only a colour-only
# derivative, explicitly allowed by that contract ("background color change;
# foreground color change" are Allowed; "redraw; reshape; new symbol" are
# not). Background changes from the pre-Touchline brand green (#144937) to
# the Touchline accent (--tl-accent, #C7F54A); the mark changes from white to
# near-black (--tl-accent-on-fill dark value, #101500) to match "existing
# mark in near-black" on an accent/lime launcher background, per that
# contract's §2. This is the one place ADR-0136 touches a value
# docs/product/brand-strategy.md's "final logo/app icon" gate would otherwise
# require separate owner approval for outside ordinary programme work — that
# approval is ADR-0136's own Accepted status and explicit Phase 8 scope
# ("Create minor icon variants from existing mark"), not a fresh decision
# made here; the mark geometry and product name are unchanged.
#
# Fixes one additional, previously-unaddressed defect of the same class
# ADR-0123 already fixed for apple-icon.png: src/app/favicon.ico was a
# transparent PNG-in-ICO with a plain black mark, nearly invisible against a
# dark browser tab bar. Now opaque, matching every other icon here.
#
# Requires ImageMagick (`convert`) with an SVG delegate.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOUCHLINE_ACCENT="#C7F54A"  # --tl-accent (dark theme), src/app/touchline.css
TOUCHLINE_MARK="#101500"    # --tl-accent-on-fill (dark theme), src/app/touchline.css
SRC_SVG="$ROOT/public/brand/logo.svg"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# logo.svg fills with currentColor -> recolour to near-black, rasterise
# large, trim the SVG's own built-in padding so scaling below is measured
# against the mark.
sed "s/currentColor/${TOUCHLINE_MARK}/g" "$SRC_SVG" > "$TMP/logo-mark.svg"
convert -background none "$TMP/logo-mark.svg" -resize 1024x1024 PNG32:"$TMP/logo-mark.png"
convert "$TMP/logo-mark.png" -trim +repage PNG32:"$TMP/mark.png"

# render <size> <mark-percent> <out>
render() {
  size="$1"; pct="$2"; out="$3"
  inner=$(( size * pct / 100 ))
  convert -size "${size}x${size}" "xc:${TOUCHLINE_ACCENT}" \
    \( "$TMP/mark.png" -resize "${inner}x${inner}" \) \
    -gravity center -compose over -composite \
    -background "${TOUCHLINE_ACCENT}" -flatten \
    -alpha remove -alpha off \
    -strip PNG24:"$out"
  echo "  $(identify -format '%f  %wx%h  %[channels]' "$out")"
}

echo "Regenerating PWA icons (Touchline accent ${TOUCHLINE_ACCENT} / mark ${TOUCHLINE_MARK}):"
# apple / favicon PNGs: mark ~72-78% to match the existing visual weight
render 180 72 "$ROOT/src/app/apple-icon.png"
render  32 78 "$ROOT/src/app/icon.png"
# maskable: mark ~56% so it stays inside the centre-80% mask-safe area
render 192 56 "$ROOT/public/brand/maskable-192.png"
render 512 56 "$ROOT/public/brand/maskable-512.png"
# purpose:any android launcher icons: same treatment, full-bleed mark weight
render 192 78 "$ROOT/public/brand/android-chrome-192x192.png"
render 512 78 "$ROOT/public/brand/android-chrome-512x512.png"

# favicon.ico: single 16x16 frame, matching the existing file's own format —
# opaque now, correcting the transparent-background defect described above.
render 16 78 "$TMP/favicon-16.png"
convert "$TMP/favicon-16.png" "$ROOT/src/app/favicon.ico"
echo "  $(identify -format '%f  %wx%h' "$ROOT/src/app/favicon.ico")"

echo "Done."
