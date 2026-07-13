# Changelog

## 0.2.1 — 2026-07-13

**Fix (important): line series were rendering black/invisible.** The renderer
dispatch passes each series its colors *object*, but `drawLine()` declared a color
*string* — so any `line` series stroked with an object, canvas fell back to black,
and lines vanished on dark themes. `drawLine()` now accepts either shape. Affects
every line series (overlays, indicator lines, comparison series). Candles, area and
volume were unaffected.

## 0.2.0 — 2026-07-13

- **All nine drawing families complete (26 tools)**: added arrow, callout, flag,
  Fibonacci fan, Fibonacci time zones, Gann box, Schiff pitchfork, and XABCD /
  Elliott labeled pattern markup — all pure geometry over the existing primitive
  API (no engine change).

## 0.1.0 — 2026-07-13

Initial public release, extracted from the private platform after the benchmark gate
passed (see README table; raw artifact in the private repo's records).

- Engine: buffers, time/price scales, layered pane renderer, series passes
  (candles/line/area/volume), interaction physics, pane manager, primitive API.
- Tools: 17 drawing tools across 8 families as adapter-free geometry.
- Demo (static synthetic data) + the reproducible bench harness.

Known scope notes: the indicator UI/server, persistence, alerts, and export layers
live in private adapters by design — the engine consumes arrays and knows nothing
about servers. Public API follows semver from here; the private adapter may run
ahead of releases.
