# Changelog

## 0.3.1 — 2026-07-13

**`percent` price scale** — a third `PriceScale` mode alongside `linear` and `log`.
Set a reference price with `setBase()` and the axis re-bases to it, reading as % from
that bar (ticks label `+100.0%`; `yForPrice`/`priceForY` round-trip exactly). A
relative-performance read on a single series without touching the data.

```js
const ps = chart.panes[0].ps;
ps.mode = "percent";
ps.setBase(bars[0].close);   // axis now reads % from the first visible bar
```

**Fix: log-scale tick labels printed 4 decimals** (`500.0000`). The log branch called
`fmtPrice(v)` without a step argument, so the formatter fell through to its finest
precision. It now passes the tick spacing.

## 0.3.0 — 2026-07-13

**Four new price renderers**: `bars` (OHLC), `step`, `scatter`, and `baseline`
(shaded green above / red below the first visible close). The full set is now
candles · bars · line · step · area · scatter · baseline · volume, all switchable
through `addSeries(type)`.

## 0.2.2 — 2026-07-13

**Fix: sparse series (indicator overlays) drew shifted and short.** The engine draws by
bar INDEX, so a series with fewer points than the price series (an SMA(50) has no value
for its first 49 bars) had point 0 land on bar 0 — the line was shifted left by its
warmup and ended short of the right edge. `drawLine()` is now **gap-aware** (non-finite
values break the path instead of drawing to zero) and `SeriesBuffer.minMax()` ignores
NaN, so a consumer can align a sparse series to the shared index space by padding the
gaps with NaN.

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
