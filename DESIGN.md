# Design — PEATRIX Digital Twin

Single-screen Operate surface. The visual world is pinned by the project brief; do not extend the palette.

## Colour (exactly four + neutrals)
| Token | Value | Use |
|---|---|---|
| `--ink` | `#550000` | text, outlines, base surfaces in 3D |
| `--red` | `#A80000` | emphasis, primary action, selection, "naik" |
| `--orange` | `#CD3811` | accent: slider fill, score bars, model line |
| `--salmon` | `#FF751F` | fill only (peat body, washes). Never text. |
| `--paper` | `#FFF6EE` | page and map background |
| `--white` | `#FFFFFF` | rails, cards over map |

Tints are alpha of `--ink` (`--ink-soft` .74, `--rule` .16, `--rule-strong` .34). **No blue anywhere.** Water, TMA and canals are always **dashed lines**. Raster ramp: `#FFF6EE → #FF751F → #CD3811 → #A80000 → #550000`. Basemap tiles are fully desaturated.

## Type
Poppins only (400/500/600/700, self-hosted). Fixed scale: 11 / 12 / 13 / 14 (body) / 15 (h2) / 22 (dialog title). Tabular numerals everywhere. Indonesian number format (decimal comma, U+2212 minus).

## Layout
Three rails on desktop (292 · fluid · 348), hairline rules instead of cards; only elements floating over the map get a card with an offset soft shadow. Cross-section strip docks under the map. ≤900 px: map 44dvh on top, four tabs (Peringkat · Skenario · Layer · TMA) below; the cross-section moves into the TMA tab.

## Components
- **Badge**: 11px/600 pill, outlined; carries the data type on every layer (Pengukuran, Inversi geofisika, Prediksi ML, Simulasi, Penginderaan jauh, Peta dasar).
- **Segmented control**: active = ink fill, cream text.
- **Switch / range**: red when on; range fill orange.
- **Rank row**: position, unit chip, score with reference tick, shift arrow (red = naik prioritas, soft ink = turun).

## Motion
One authored moment: ranking rows physically reorder (FLIP, 620 ms, expo-out) while the dashed water line moves. Everything else 150–250 ms. Honors `prefers-reduced-motion`.

## Rules
Numbers come only from `data/`. Predictions are never labelled "pengukuran". No agency logos.
