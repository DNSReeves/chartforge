// ChartForge Engine — series render passes (IMPL_CHARTFORGE §2b).
// THE performance core: per-style path BATCHING (one beginPath per batch),
// binary-searched viewport culling upstream, zero per-frame allocation in the
// hot loops, integer-aligned strokes. Candles collapse to 1px ticks when the
// bar width goes sub-pixel (the 30K-intraday case).

/** @typedef {import('./buffer.js').SeriesBuffer} SeriesBuffer */

export const DEFAULT_COLORS = {
  up: "#26a69a", down: "#ef5350",
  line: "#4ea1ff", area: "rgba(78,161,255,.18)",
  volUp: "rgba(38,166,154,.45)", volDown: "rgba(239,83,80,.45)",
};

/** Candlesticks: 4 batched paths (up bodies, down bodies, up wicks, down wicks). */
export function drawCandles(ctx, buf, ts, ps, colors = DEFAULT_COLORS) {
  const [a, b] = ts.range(buf.n);
  if (b < a) return;
  const bw = ts.barWidth();
  const bodyW = Math.max(1, Math.min(bw * 0.7, 40));
  const half = bodyW / 2;
  const thin = bw < 1.6;               // sub-pixel bars → 1px OHLC ticks
  const O = buf.open, H = buf.high, L = buf.low, C = buf.close;

  for (const dir of [0, 1]) {          // 0 = up, 1 = down
    // wicks
    ctx.beginPath();
    ctx.strokeStyle = dir ? colors.down : colors.up;
    ctx.lineWidth = 1;
    for (let i = a; i <= b; i++) {
      const up = C[i] >= O[i];
      if ((dir === 0) !== up) continue;
      const x = Math.round(ts.xForIndex(i)) + 0.5;
      ctx.moveTo(x, Math.round(ps.yForPrice(H[i])));
      ctx.lineTo(x, Math.round(ps.yForPrice(L[i])));
    }
    ctx.stroke();
    if (thin) continue;                // ticks only — skip bodies entirely
    // bodies
    ctx.beginPath();
    ctx.fillStyle = dir ? colors.down : colors.up;
    for (let i = a; i <= b; i++) {
      const up = C[i] >= O[i];
      if ((dir === 0) !== up) continue;
      const x = ts.xForIndex(i);
      const y1 = ps.yForPrice(up ? C[i] : O[i]);
      const y2 = ps.yForPrice(up ? O[i] : C[i]);
      ctx.rect(Math.round(x - half), Math.round(y1), Math.round(bodyW), Math.max(1, Math.round(y2 - y1)));
    }
    ctx.fill();
  }
}

/** Line on close (one path).
 * COLOR-CONTRACT (fix 2026-07-13): the RENDERERS dispatch hands every series its
 * colors OBJECT, but this took a color STRING — so a `line` series stroked with
 * an object, canvas fell back to BLACK, and every line (compare overlays AND
 * indicator series) drew invisibly on a dark theme. Accept both shapes. */
export function drawLine(ctx, buf, ts, ps, colors = DEFAULT_COLORS, width = 1.6) {
  const color = typeof colors === "string" ? colors
              : (colors && colors.line) || DEFAULT_COLORS.line;
  const [a, b] = ts.range(buf.n);
  if (b < a) return;
  const C = buf.close;
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  // decimate: at sub-pixel density plot min/max per pixel column to keep shape
  const bw = ts.barWidth();
  if (bw >= 0.5) {
    // GAP-AWARE (2026-07-13): a series may be SPARSE against the shared index space
    // (an SMA(50) has no value for its first 49 bars). Non-finite points break the
    // path instead of drawing a line to zero — and, critically, the series can now be
    // ALIGNED to the price bars, so it ends where the price ends.
    let pen = false;
    for (let i = a; i <= b; i++) {
      const v = C[i];
      if (!Number.isFinite(v)) { pen = false; continue; }
      const x = ts.xForIndex(i), y = ps.yForPrice(v);
      pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      pen = true;
    }
  } else {
    const perPx = 1 / bw;
    for (let x = 0; x < ts.widthPx; x++) {
      const i0 = Math.max(a, Math.floor(ts.indexForX(x))), i1 = Math.min(b, Math.floor(i0 + perPx));
      let mn = Infinity, mx = -Infinity;
      for (let i = i0; i <= i1; i++) { const v = C[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
      if (mn > mx) continue;
      const ymn = ps.yForPrice(mn), ymx = ps.yForPrice(mx);
      x === 0 ? ctx.moveTo(x, ymx) : ctx.lineTo(x, ymx);
      if (ymn !== ymx) ctx.lineTo(x, ymn);
    }
  }
  ctx.stroke();
}

/** Area = line + gradient fill to the bottom. */
export function drawArea(ctx, buf, ts, ps, colors = DEFAULT_COLORS) {
  const [a, b] = ts.range(buf.n);
  if (b < a) return;
  const C = buf.close;
  ctx.beginPath();
  ctx.moveTo(ts.xForIndex(a), ps.yForPrice(C[a]));
  for (let i = a + 1; i <= b; i++) ctx.lineTo(ts.xForIndex(i), ps.yForPrice(C[i]));
  ctx.lineTo(ts.xForIndex(b), ps.heightPx);
  ctx.lineTo(ts.xForIndex(a), ps.heightPx);
  ctx.closePath();
  ctx.fillStyle = colors.area;
  ctx.fill();
  drawLine(ctx, buf, ts, ps, colors.line);
}

/** Volume histogram: two batched fills keyed to candle direction. */
export function drawVolume(ctx, buf, ts, ps, colors = DEFAULT_COLORS) {
  const [a, b] = ts.range(buf.n);
  if (b < a) return;
  const bw = ts.barWidth();
  const bodyW = Math.max(1, Math.min(bw * 0.7, 40));
  const half = bodyW / 2;
  const V = buf.volume, O = buf.open, C = buf.close;
  const h = ps.heightPx;
  const vmax = buf.maxVolume(a, b);
  for (const dir of [0, 1]) {
    ctx.beginPath();
    ctx.fillStyle = dir ? colors.volDown : colors.volUp;
    for (let i = a; i <= b; i++) {
      if ((dir === 0) !== (C[i] >= O[i])) continue;
      const x = ts.xForIndex(i);
      const bh = (V[i] / vmax) * h * 0.92;
      ctx.rect(Math.round(x - half), Math.round(h - bh), Math.round(bodyW), Math.round(bh));
    }
    ctx.fill();
  }
}

/** OHLC bars (open tick left, close tick right) — the classic Western bar. */
export function drawBars(ctx, buf, ts, ps, colors = DEFAULT_COLORS) {
  const [a, b] = ts.range(buf.n);
  if (b < a) return;
  const O = buf.open, H = buf.high, L = buf.low, C = buf.close;
  const tick = Math.max(1, Math.min(ts.barWidth() * 0.35, 12));
  for (const dir of [0, 1]) {
    ctx.beginPath();
    ctx.strokeStyle = dir ? colors.down : colors.up;
    ctx.lineWidth = 1;
    for (let i = a; i <= b; i++) {
      const up = C[i] >= O[i];
      if ((dir === 0) !== up) continue;
      const x = Math.round(ts.xForIndex(i)) + 0.5;
      ctx.moveTo(x, Math.round(ps.yForPrice(H[i])));
      ctx.lineTo(x, Math.round(ps.yForPrice(L[i])));
      const yo = Math.round(ps.yForPrice(O[i])) + 0.5;
      ctx.moveTo(x - tick, yo); ctx.lineTo(x, yo);
      const yc = Math.round(ps.yForPrice(C[i])) + 0.5;
      ctx.moveTo(x, yc); ctx.lineTo(x + tick, yc);
    }
    ctx.stroke();
  }
}

/** Step line (close held until the next bar) — the "how it actually traded" view. */
export function drawStep(ctx, buf, ts, ps, colors = DEFAULT_COLORS) {
  const [a, b] = ts.range(buf.n);
  if (b < a) return;
  const C = buf.close;
  const color = typeof colors === "string" ? colors : (colors && colors.line) || DEFAULT_COLORS.line;
  ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 1.6;
  let pen = false;
  for (let i = a; i <= b; i++) {
    const v = C[i];
    if (!Number.isFinite(v)) { pen = false; continue; }
    const x0 = ts.xForIndex(i) - ts.barWidth() / 2, x1 = x0 + ts.barWidth(), y = ps.yForPrice(v);
    if (!pen) { ctx.moveTo(x0, y); pen = true; } else { ctx.lineTo(x0, y); }
    ctx.lineTo(x1, y);
  }
  ctx.stroke();
}

/** Scatter (one dot per close) — sparse/irregular data, or a de-cluttered view. */
export function drawScatter(ctx, buf, ts, ps, colors = DEFAULT_COLORS) {
  const [a, b] = ts.range(buf.n);
  if (b < a) return;
  const C = buf.close;
  const color = typeof colors === "string" ? colors : (colors && colors.line) || DEFAULT_COLORS.line;
  const r = Math.max(1, Math.min(ts.barWidth() * 0.22, 3.5));
  ctx.beginPath(); ctx.fillStyle = color;
  for (let i = a; i <= b; i++) {
    const v = C[i];
    if (!Number.isFinite(v)) continue;
    ctx.moveTo(ts.xForIndex(i) + r, ps.yForPrice(v));
    ctx.arc(ts.xForIndex(i), ps.yForPrice(v), r, 0, Math.PI * 2);
  }
  ctx.fill();
}

/** Baseline: green above the first visible close, red below (relative-performance read). */
export function drawBaseline(ctx, buf, ts, ps, colors = DEFAULT_COLORS) {
  const [a, b] = ts.range(buf.n);
  if (b < a) return;
  const C = buf.close;
  const base = C[a];
  const yBase = ps.yForPrice(base);
  for (const above of [true, false]) {
    ctx.beginPath();
    ctx.moveTo(ts.xForIndex(a), yBase);
    for (let i = a; i <= b; i++) {
      const v = Number.isFinite(C[i]) ? C[i] : base;
      const y = ps.yForPrice(v);
      ctx.lineTo(ts.xForIndex(i), above ? Math.min(y, yBase) : Math.max(y, yBase));
    }
    ctx.lineTo(ts.xForIndex(b), yBase);
    ctx.closePath();
    ctx.fillStyle = above ? "rgba(38,166,154,.25)" : "rgba(239,83,80,.25)";
    ctx.fill();
  }
  drawLine(ctx, buf, ts, ps, colors);
  ctx.beginPath(); ctx.strokeStyle = "rgba(138,148,166,.6)"; ctx.setLineDash([4, 4]);
  ctx.moveTo(0, yBase); ctx.lineTo(ts.widthPx, yBase); ctx.stroke(); ctx.setLineDash([]);
}

export const RENDERERS = { candles: drawCandles, bars: drawBars, line: drawLine, step: drawStep,
                           area: drawArea, scatter: drawScatter, baseline: drawBaseline,
                           volume: drawVolume };
