#!/bin/sh
# Regenerate Matchboard's PWA icon assets from the canonical brand mark.
#
# This is a reproducibility/documentation script — it is NOT wired into the
# build or `npm run validate`. The committed PNGs it produces are the
# deliverable. Re-run it only when the brand mark or brand colour changes
# (an owner-approved brand decision — see docs/product/brand-strategy.md).
#
# Corrective regen only (ADR-0123): same mark (public/brand/logo.svg), same
# brand green. It fixes two concrete defects:
#   1. src/app/apple-icon.png was a transparent PNG with a dark mark; iOS
#      composites home-screen icons onto black, so the mark was near-invisible.
#      -> now an OPAQUE brand-green field with a white mark.
#   2. The manifest declared the full-bleed android-chrome-* PNGs "maskable",
#      but their mark runs to the edges and clips on circular Android masks.
#      -> dedicated maskable-{192,512}.png with the mark inside the safe area.
#
# Requires ImageMagick (`convert`) with an SVG delegate.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRAND_GREEN="#144937"     # sampled from public/brand/android-chrome-512x512.png
SRC_SVG="$ROOT/public/brand/logo.svg"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# logo.svg fills with currentColor -> recolour to white, rasterise large, trim
# the SVG's own built-in padding so scaling below is measured against the mark.
sed 's/currentColor/#FFFFFF/g' "$SRC_SVG" > "$TMP/logo-white.svg"
convert -background none "$TMP/logo-white.svg" -resize 1024x1024 PNG32:"$TMP/logo-white.png"
convert "$TMP/logo-white.png" -trim +repage PNG32:"$TMP/mark.png"

# render <size> <mark-percent> <out>
render() {
  size="$1"; pct="$2"; out="$3"
  inner=$(( size * pct / 100 ))
  convert -size "${size}x${size}" "xc:${BRAND_GREEN}" \
    \( "$TMP/mark.png" -resize "${inner}x${inner}" \) \
    -gravity center -compose over -composite \
    -background "${BRAND_GREEN}" -flatten \
    -alpha remove -alpha off \
    -strip PNG24:"$out"
  echo "  $(identify -format '%f  %wx%h  %[channels]' "$out")"
}

echo "Regenerating PWA icons ($BRAND_GREEN):"
# apple / favicon: mark ~72-78% to match the visual weight of the existing android-chrome-* art
render 180 72 "$ROOT/src/app/apple-icon.png"
render  32 78 "$ROOT/src/app/icon.png"
# maskable: mark ~56% so it stays inside the centre-80% mask-safe area
render 192 56 "$ROOT/public/brand/maskable-192.png"
render 512 56 "$ROOT/public/brand/maskable-512.png"
echo "Done. android-chrome-{192,512}.png are left unchanged (already correct for purpose:any)."
