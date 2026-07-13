// ChartForge Engine — the chart: pane stack + shared TimeScale + time axis +
// RAF-batched, layer-selective draw scheduling (IMPL_CHARTFORGE §2b, P0).
//
// Public surface (deliberately Lightweight-shaped so the bench compares apples):
//   const chart = createChart(container, options)
//   const s = chart.addSeries("candles"|"line"|"area", {pane:0})
//   s.setData(bars) / s.update(bar)
//   chart.addPane(heightFrac) · chart.fit() · chart.remove()

import { SeriesBuffer } from "./buffer.js";
import { TimeScale } from "./timescale.js";
import { Pane, AXIS_W } from "./pane.js";
import { Interaction } from "./interact.js";

const THEMES = {
  dark: { bg: "#0e1116", grid: "rgba(138,148,166,.14)", text: "#8a94a6",
          font: "11px -apple-system, system-ui, sans-serif",
          crosshair: "rgba(138,148,166,.75)", crosshairBg: "#2a3140", crosshairText: "#d7dde6",
          axisBg: "#0e1116" },
  light: { bg: "#ffffff", grid: "rgba(60,70,90,.12)", text: "#66707f",
           font: "11px -apple-system, system-ui, sans-serif",
           crosshair: "rgba(60,70,90,.6)", crosshairBg: "#e7ebf1", crosshairText: "#1d2430",
           axisBg: "#ffffff" },
};
const TIME_AXIS_H = 26;

export class Chart {
  constructor(container, { theme = "dark", initialBars = 150 } = {}) {
    this.container = container;
    this.theme = THEMES[theme] || THEMES.dark;
    this.initialBars = initialBars;
    this.ts = new TimeScale();
    this.panes = [];
    this.el = document.createElement("div");
    this.el.style.cssText = "position:relative;width:100%;height:100%;display:flex;flex-direction:column;overflow:hidden;";
    container.appendChild(this.el);
    this.paneHost = document.createElement("div");
    this.paneHost.style.cssText = "flex:1;min-height:0;position:relative;";
    this.el.appendChild(this.paneHost);
    this.axisCv = document.createElement("canvas");
    this.axisCv.style.cssText = `height:${TIME_AXIS_H}px;width:100%;flex:none;`;
    this.el.appendChild(this.axisCv);

    this._dirty = { grid: true, series: true, interact: false };
    this._raf = 0;
    this._crosshair = null;
    this._mainBuf = null;

    this.addPane(1);                                   // main pane
    this.interaction = new Interaction(this.paneHost, this.ts, {
      requestDraw: (k) => this.requestDraw(k),
      onCrosshair: (pt) => { this._crosshair = pt; this.requestDraw("interact"); },
      barCount: () => (this._mainBuf ? this._mainBuf.n : 0),
      fit: () => this.fit(),
    });
    this._ro = new ResizeObserver(() => this._layout());
    this._ro.observe(this.el);
    this.ts.onChange(() => { /* zoom/pan → full redraw of grid+series */ });
    this._layout();
  }

  addPane(heightFrac = 0.25) {
    const pane = new Pane(this.paneHost, this.ts, { heightFrac, theme: this.theme });
    this.panes.push(pane);
    this._layout();
    return this.panes.length - 1;
  }

  /** @param {"candles"|"line"|"area"|"volume"} type */
  addSeries(type = "candles", { pane = 0, colors = null } = {}) {
    const buf = new SeriesBuffer();
    const p = this.panes[pane];
    p.addSeries(buf, type, colors);
    if (!this._mainBuf && type !== "volume") this._mainBuf = buf;
    const chart = this;
    return {
      buffer: buf,
      setData(bars) {
        buf.setData(bars);
        if (buf === chart._mainBuf) chart.ts.fit(buf.n, chart.initialBars);
        chart.requestDraw("scale");
      },
      update(bar) { buf.update(bar); chart.requestDraw("series"); },
    };
  }

  fit() {
    if (this._mainBuf) this.ts.fit(this._mainBuf.n, this.initialBars);
    this.requestDraw("scale");
  }

  /** layers: 'scale' (grid+series), 'series', 'interact' */
  requestDraw(layers = "scale") {
    if (layers === "scale") { this._dirty.grid = true; this._dirty.series = true; }
    else if (layers === "series") this._dirty.series = true;
    this._dirty.interact = true;
    if (!this._raf) this._raf = requestAnimationFrame(() => this._draw());
  }

  _layout() {
    const w = this.el.clientWidth || 600;
    const h = (this.el.clientHeight || 400) - TIME_AXIS_H;
    if (w < 40 || h < 40) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.dpr = dpr;
    const total = this.panes.reduce((s, p) => s + p.heightFrac, 0) || 1;
    for (const p of this.panes) p.layout(w, Math.round(h * p.heightFrac / total), dpr);
    this.ts.setWidth(w - AXIS_W);
    this.axisCv.width = Math.round(w * dpr); this.axisCv.height = Math.round(TIME_AXIS_H * dpr);
    this.requestDraw("scale");
  }

  _drawTimeAxis() {
    const ctx = this.axisCv.getContext("2d");
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const w = this.el.clientWidth, t = this.theme;
    ctx.clearRect(0, 0, w, TIME_AXIS_H);
    ctx.fillStyle = t.axisBg; ctx.fillRect(0, 0, w, TIME_AXIS_H);
    ctx.strokeStyle = t.grid;
    ctx.beginPath(); ctx.moveTo(0, 0.5); ctx.lineTo(w, 0.5); ctx.stroke();
    if (!this._mainBuf || !this._mainBuf.n) return;
    ctx.fillStyle = t.text; ctx.font = t.font; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const tick of this.ts.ticks(this._mainBuf.time, this._mainBuf.n)) {
      if (tick.x > 0 && tick.x < w - AXIS_W) ctx.fillText(tick.label, tick.x, TIME_AXIS_H / 2 + 1);
    }
    ctx.textAlign = "left";
  }

  _draw() {
    this._raf = 0;
    const d = this._dirty;
    for (const p of this.panes) {
      if (d.grid) { p.autoscale(); p.drawGrid(); }
      if (d.series) p.drawSeries();
    }
    if (d.grid) this._drawTimeAxis();
    if (d.interact) {
      // crosshair: x shared across panes; y only in the pane under the pointer
      let yOffset = 0;
      for (const p of this.panes) {
        const pt = this._crosshair
          ? { x: this._crosshair.x, y: this._crosshair.y - yOffset,
              inPane: this._crosshair.y >= yOffset && this._crosshair.y < yOffset + p.h }
          : null;
        p.drawInteract(pt && pt.x <= p.chartWidth() ? pt : null);
        yOffset += p.h;
      }
    }
    this._dirty = { grid: false, series: false, interact: false };
  }

  remove() {
    this._ro.disconnect();
    this.el.remove();
  }
}

/** @param {HTMLElement} container */
export function createChart(container, options) { return new Chart(container, options); }
export { THEMES, TIME_AXIS_H };
