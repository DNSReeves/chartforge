// ChartForge Engine — a pane: three stacked canvases (grid / series / interact),
// its own PriceScale, N series, a primitive (drawing) layer. Redraw is
// layer-selective: 'grid' redraws on scale changes only; 'series' on data/scale;
// 'interact' every crosshair move — the layering is what keeps pans cheap.

import { PriceScale } from "./pricescale.js";
import { RENDERERS, DEFAULT_COLORS } from "./series.js";

const AXIS_W = 64;                     // right price-axis gutter (px)

export class Pane {
  /** @param {HTMLElement} host @param {import('./timescale.js').TimeScale} ts */
  constructor(host, ts, { heightFrac = 1, mode = "linear", theme } = {}) {
    this.host = host; this.ts = ts;
    this.heightFrac = heightFrac;
    this.ps = new PriceScale(mode);
    this.theme = theme;
    this.series = [];                  // {buf, type, colors, autoscale:true}
    this.primitives = [];              // primitive API objects (§2b extension surface)
    this.el = document.createElement("div");
    this.el.style.cssText = "position:relative;width:100%;";
    this.cv = {};
    for (const layer of ["grid", "series", "interact"]) {
      const c = document.createElement("canvas");
      c.style.cssText = "position:absolute;inset:0;width:100%;height:100%;";
      this.el.appendChild(c);
      this.cv[layer] = c;
    }
    host.appendChild(this.el);
    this.w = 0; this.h = 0; this.dpr = 1;
  }
  addSeries(buf, type = "candles", colors = null) {
    const s = { buf, type, colors: colors || this.theme?.colors || DEFAULT_COLORS };
    this.series.push(s);
    return s;
  }
  layout(w, h, dpr) {
    this.w = w; this.h = h; this.dpr = dpr;
    this.el.style.height = h + "px";
    for (const c of Object.values(this.cv)) {
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    }
    this.ps.setHeight(h);
  }
  chartWidth() { return this.w - AXIS_W; }

  _ctx(layer) {
    const ctx = this.cv[layer].getContext("2d");
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    return ctx;
  }
  autoscale() {
    let mn = Infinity, mx = -Infinity, isVol = false;
    for (const s of this.series) {
      if (s.type === "volume") { isVol = true; continue; }
      const [a, b] = this.ts.range(s.buf.n);
      const [m, M] = s.buf.minMax(a, b);
      if (m < mn) mn = m; if (M > mx) mx = M;
    }
    if (mn <= mx) this.ps.autoscale(mn, mx);
    else if (isVol) this.ps.autoscale(0, 1);
  }
  drawGrid() {
    const ctx = this._ctx("grid");
    const t = this.theme;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.fillStyle = t.bg; ctx.fillRect(0, 0, this.w, this.h);
    ctx.strokeStyle = t.grid; ctx.lineWidth = 1;
    ctx.font = t.font; ctx.fillStyle = t.text;
    ctx.textBaseline = "middle";
    for (const tick of this.ps.ticks()) {
      const y = Math.round(tick.y) + 0.5;
      if (y < 4 || y > this.h - 4) continue;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.chartWidth(), y); ctx.stroke();
      ctx.fillText(tick.label, this.chartWidth() + 8, y);
    }
    // axis divider
    ctx.beginPath(); ctx.moveTo(this.chartWidth() + 0.5, 0); ctx.lineTo(this.chartWidth() + 0.5, this.h); ctx.stroke();
  }
  drawSeries() {
    this.autoscale();
    const ctx = this._ctx("series");
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, this.chartWidth(), this.h); ctx.clip();
    for (const s of this.series) RENDERERS[s.type](ctx, s.buf, this.ts, this.ps, s.colors);
    for (const p of this.primitives) p.draw(ctx, { ts: this.ts, ps: this.ps, w: this.chartWidth(), h: this.h });
    ctx.restore();
  }
  /** Crosshair layer. @param {{x:number,y:number}|null} pt */
  drawInteract(pt) {
    const ctx = this._ctx("interact");
    ctx.clearRect(0, 0, this.w, this.h);
    if (!pt) return;
    const t = this.theme;
    ctx.strokeStyle = t.crosshair; ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    const x = Math.round(pt.x) + 0.5;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.h); ctx.stroke();
    if (pt.y != null && pt.inPane) {
      const y = Math.round(pt.y) + 0.5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.chartWidth(), y); ctx.stroke();
      ctx.setLineDash([]);
      const label = this.ps.priceForY(pt.y);
      ctx.fillStyle = t.crosshairBg;
      ctx.fillRect(this.chartWidth() + 1, y - 9, AXIS_W - 2, 18);
      ctx.fillStyle = t.crosshairText; ctx.font = t.font; ctx.textBaseline = "middle";
      ctx.fillText(label >= 1000 ? label.toFixed(0) : label.toFixed(2), this.chartWidth() + 8, y);
    }
    ctx.setLineDash([]);
  }
}
export { AXIS_W };
