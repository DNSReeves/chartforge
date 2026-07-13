# Changelog

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
