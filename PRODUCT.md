# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Static HTML/CSS/JS, no build step (user's choice). MapLibre GL JS + Three.js vendored locally. Deployed to Vercel via GitHub as a static folder.

## Users
Competition judges (EGSA EIC 2026 final) who scan a QR code on their phone during a 10-minute pitch, and the two-person UGM team who capture 1920×1080 screenshots and a 60–90 s backup video on desktop. Indonesian language.

## Product Purpose
Interactive proof-of-concept digital twin of peatland KHG.61.12.02 (Kubu Raya, West Kalimantan). It shows that peat thickness + uncertainty + water-table simulation change which areas get fire-mitigation priority (Peta A) and where to survey next (Peta B). Success: a judge understands Reveal–Simulate–Prioritize within a minute and sees rankings respond to scenarios.

## Positioning
Priority ranking that includes peat thickness and prediction uncertainty, computed from real public data (63 cores, AEM flight lines, station water-table records), with every layer labelled by data type.

## Operating Context
Opened from a QR in a PDF deck; 4 storyboard states are screenshotted for slide 8; an auto-running Demo Mode is screen-recorded.

## Capabilities and Constraints
- No backend, no tracking, no cookies. All data from static JSON/PNG in `data/`.
- Scenarios precomputed: dasar, sekat, defisit (30%), sekat_defisit. Rain-deficit slider interpolates between dasar and 30% and is labelled as interpolation.
- Never show numbers not from data files; never call predictions "pengukuran"; no agency logos.
- Units A–H are k-means clusters, not official village boundaries.

## Brand Commitments
Name PEATRIX. Font Poppins. Exactly four colours: #550000 text, #A80000 emphasis, #CD3811 accent, #FF751F fill only; background white/cream #FFF6EE. No blue anywhere; water/TMA/canals are drawn dashed. Raster ramp #FFF6EE → #FF751F → #CD3811 → #A80000 → #550000.

## Evidence on Hand
`data/` (copied from PEATRIX_DATA/12_WEB): 16 raster layers (png+json), units, canals, cores, AEM lines, settlements, scenarios, station time series, validation metrics. Limitations in PEATRIX_DATA/00_RINGKASAN_HASIL.md.

## Product Principles
1. Honest labelling: every layer carries its data-type badge.
2. The ranking change is the story; the map supports it.
3. Works on a judge's phone first try.
4. Relative scenario comparison, not absolute forecasts.
