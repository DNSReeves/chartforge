# ChartForge

**A zero-dependency, no-build-step financial charting engine for Canvas 2D — with the
drawing-tools layer the fast engines don't ship.**

TradingView's excellent Lightweight Charts deliberately ships no drawing tools, no
indicator UI, and no navigator — and most libraries that do ship them are paid or
branded. ChartForge aims at the unoccupied corner: **Lightweight-class performance plus
the drawing/tools layer, Apache-2.0, zero dependencies, plain ES modules** (edit-file →
refresh; there is no bundler and never will be).

## Measured, not asserted

The repo ships its own benchmark harness (`bench/`) comparing ChartForge to a vendored
Lightweight Charts v5 on identical seeded data. Headless-chromium results, 2026-07-13
(PC / iPad Pro 11 / iPhone 13 emulation; 10K daily candles + volume, and 30K intraday):

| metric | ChartForge | Lightweight v5 |
|---|---|---|
| pan fps (all six device×size cells) | 60.0–60.5 | 60.0–60.2 |
| first paint | **14–31 ms** | 50–87 ms |
| worst frame | 16.8 ms | 16.8 ms |

Open `bench/index.html` and press the buttons — the harness re-measures in *your*
browser. Claims that can't be reproduced don't belong in a README.

## What's inside

- `engine/` — 8 ES modules, ~32KB unminified, zero deps:
  - SoA `Float64Array` series buffers (no per-point objects)
  - index-space time scale (bar index ↔ px; timestamps only at the axis labeler —
    gaps/sessions/mixed granularity come free)
  - linear + log price scales with nice ticks
  - three stacked canvases per pane, layer-selective dirty redraw
  - per-style path batching; sub-pixel bars collapse to 1px ticks, sub-pixel lines
    decimate to per-column min/max
  - pointer-unified pan with velocity-tracked inertia, wheel/pinch anchor zoom,
    double-tap fit, tap-hold crosshair
  - a pane manager (shared time scale, synced crosshair) and a primitive API
    (`draw(ctx, viewport)` / `hitTest(pt)` / `serialize()`) for overlays and tools
- `tools/drawings.js` — the drawing families as adapter-free geometry over the
  primitive API: trend/ray/h/v lines, parallel channel, pitchfork, Gann fan, Fibonacci
  retracement/extension, rectangle, ellipse, polyline, text, measure-with-stats, and
  long/short position tools with R:R readout
- `demo/` — a static 10K-candle demo (no server, no data feed — seeded synthetic bars)
- `bench/` — the harness above (the LW v5 reference is vendored here for benching only,
  Apache-2.0, cross-vendor hash in `bench/vendor/PROVENANCE.md`)

## Quick start

```html
<div id="chart" style="height:420px"></div>
<script type="module">
  import { createChart } from "./engine/index.js";
  const chart = createChart(document.getElementById("chart"), { theme: "dark" });
  const volPane = chart.addPane(0.2);
  chart.addSeries("candles", { pane: 0 }).setData(bars);   // [{time,open,high,low,close,volume},…]
  chart.addSeries("volume", { pane: volPane }).setData(bars);
</script>
```

The engine consumes plain OHLCV arrays. Where the data comes from — your server, a
CSV, a websocket — is your adapter's business; the engine has no opinions and no
network code.

## Scope & maintenance policy (read before filing)

This is a working tool extracted from a private trading-research platform, maintained
as time permits. **Bug reports and focused PRs are welcome; the feature roadmap is
ours.** No support SLA. If maintenance cost ever exceeds its value, the repo will be
archived with honor rather than left to rot — you'll always be able to fork it.

## License

Apache-2.0 (see `LICENSE`). The benched Lightweight Charts v5 copy in `bench/vendor/`
is © TradingView, Apache-2.0, used solely as the performance reference.
