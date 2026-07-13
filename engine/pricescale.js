// ChartForge Engine — per-pane price scale (linear + log) with nice ticks.

export class PriceScale {
  /** @param {"linear"|"log"|"percent"} [mode] — percent re-bases to a reference
   * price set by the consumer (`setBase`), turning the axis into % from that bar. */
  constructor(mode = "linear") {
    this.mode = mode;
    this.base = null;                    // percent mode's reference price
    this.min = 0; this.max = 1;
    this.heightPx = 300;
    this.marginFrac = 0.08;        // breathing room top/bottom
  }
  setHeight(px) { if (px > 0) this.heightPx = px; }
  /** Autoscale to [mn,mx] with margins (log mode guards positives). */
  autoscale(mn, mx) {
    if (this.mode === "log") { mn = Math.max(mn, 1e-9); mx = Math.max(mx, mn * 1.0001); }
    const pad = (mx - mn) * this.marginFrac || Math.abs(mx) * 0.01 || 1;
    this.min = this.mode === "log" ? mn / (1 + this.marginFrac) : mn - pad;
    this.max = this.mode === "log" ? mx * (1 + this.marginFrac) : mx + pad;
    // a price floor of 0 is -100%; padding below it would put ticks at prices that
    // cannot exist, so percent mode clamps there
    if (this.mode === "percent") this.min = Math.max(this.min, 0);
  }
  setBase(p) { this.base = p; }
  _t(v) {
    if (this.mode === "log") return Math.log(Math.max(v, 1e-12));
    if (this.mode === "percent" && this.base) return (v / this.base - 1) * 100;
    return v;
  }
  _inv(u) {
    if (this.mode === "log") return Math.exp(u);
    if (this.mode === "percent" && this.base) return this.base * (1 + u / 100);
    return u;
  }
  /** price → y px (0 = top) */
  yForPrice(v) {
    const a = this._t(this.min), b = this._t(this.max);
    return this.heightPx * (1 - (this._t(v) - a) / (b - a || 1));
  }
  /** y px → price */
  priceForY(y) {
    const a = this._t(this.min), b = this._t(this.max);
    return this._inv(a + (1 - y / this.heightPx) * (b - a));
  }
  /** Nice ticks ~one per 55px. @returns {{y:number,label:string,value:number}[]} */
  ticks() {
    const target = Math.max(2, Math.floor(this.heightPx / 55));
    const out = [];
    if (this.mode === "log") {
      // decade + 2/5 sub-ticks, filtered to fit
      const lo = Math.floor(Math.log10(Math.max(this.min, 1e-12)));
      const hi = Math.ceil(Math.log10(Math.max(this.max, 1e-12)));
      for (let e = lo; e <= hi; e++) {
        for (const m of [1, 2, 5]) {
          const v = m * Math.pow(10, e);
          if (v >= this.min && v <= this.max) out.push(v);
        }
      }
      while (out.length > target * 1.6) out.splice(1, 1);
      // step ≈ v/2 at 1-2-5 spacing — without it fmtPrice defaults to 4dp ("500.0000")
      return out.map(v => ({ y: this.yForPrice(v), value: v, label: fmtPrice(v, Math.max(v / 2, 1e-4)) }));
    }
    // percent mode nices the ticks in PERCENT space, not price space — otherwise the
    // steps are round in dollars and arbitrary on the axis you are actually reading
    // ("314.7%, 729.3%, 1144.0%"). Walk percent, invert each tick back to a price.
    if (this.mode === "percent" && this.base) {
      const lo = this._t(this.min), hi = this._t(this.max);
      const step = niceStep(hi - lo, target);
      const dp = step < 1 ? 2 : step < 10 ? 1 : 0;
      for (let p = Math.ceil(lo / step) * step; p <= hi + 1e-9; p += step) {
        const v = this._inv(p);
        out.push({ y: this.yForPrice(v), value: v, label: (Math.abs(p) < 1e-9 ? 0 : p).toFixed(dp) + "%" });
      }
      return out;
    }
    const step = niceStep(this.max - this.min, target);
    const first = Math.ceil(this.min / step) * step;
    for (let v = first; v <= this.max + 1e-9; v += step)
      out.push({ y: this.yForPrice(v), value: v, label: fmtPrice(v, step) });
    return out;
  }
}

/** 1-2-2.5-5-10 step that fits ~`target` ticks across `span`. */
function niceStep(span, target) {
  const raw = (span || 1) / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  return [1, 2, 2.5, 5, 10].map(k => k * mag).find(s => span / s <= target * 1.3) || mag * 10;
}

/** @param {number} v @param {number} [step] */
export function fmtPrice(v, step = 0) {
  const dp = step >= 1 || v >= 1000 ? (v >= 10000 ? 0 : 2)
    : step >= 0.01 ? 2 : 4;
  return v >= 1e6 ? (v / 1e6).toFixed(1) + "M"
    : v >= 1e4 ? Math.round(v).toLocaleString("en-US")
    : v.toFixed(dp);
}
