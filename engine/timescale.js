// ChartForge Engine — index-space time scale (IMPL_CHARTFORGE §2b).
// Bar INDEX ↔ pixels; real timestamps appear only in the axis labeler — the
// trick that makes gaps/sessions/mixed granularity cheap. Fractional indices
// are legal (smooth pan); bar width is derived, not stored.

export class TimeScale {
  constructor() {
    /** @type {number} leftmost visible bar index (fractional) */
    this.i0 = 0;
    /** @type {number} rightmost visible bar index (fractional) */
    this.i1 = 100;
    this.widthPx = 600;
    this.rightOffset = 5;          // bars of empty space right of the last bar
    this.minBars = 5;
    this.maxBars = 50000;
    this._listeners = [];
  }
  onChange(fn) { this._listeners.push(fn); }
  _emit() { for (const fn of this._listeners) fn(this); }

  visibleBars() { return this.i1 - this.i0; }
  barWidth() { return this.widthPx / this.visibleBars(); }

  /** @param {number} i fractional bar index → x px (center of bar) */
  xForIndex(i) { return (i - this.i0 + 0.5) * this.barWidth(); }
  /** @param {number} x px → fractional bar index */
  indexForX(x) { return this.i0 + x / this.barWidth() - 0.5; }

  setWidth(px) { if (px > 0 && px !== this.widthPx) { this.widthPx = px; this._emit(); } }

  /** Show the last `count` bars of an n-bar series (initial fit). */
  fit(n, count = 150) {
    const c = Math.min(Math.max(count, this.minBars), Math.max(n + this.rightOffset, this.minBars));
    this.i1 = n - 1 + this.rightOffset;
    this.i0 = this.i1 - c;
    this._emit();
  }
  /** Pan by pixel delta (drag). */
  panPx(dx) {
    const dBars = dx / this.barWidth();
    this.i0 -= dBars; this.i1 -= dBars;
    this._emit();
  }
  /** Zoom by factor around anchor x px (wheel/pinch). factor>1 = zoom in. */
  zoom(factor, anchorX) {
    const span = this.visibleBars();
    let newSpan = span / factor;
    newSpan = Math.min(Math.max(newSpan, this.minBars), this.maxBars);
    const anchorI = this.indexForX(anchorX);
    const frac = (anchorX / this.widthPx);
    this.i0 = anchorI - frac * newSpan + 0.5;
    this.i1 = this.i0 + newSpan;
    this._emit();
  }
  /** Clamp so at least a sliver of data stays visible. @param {number} n bar count */
  clamp(n) {
    const span = this.visibleBars();
    const minI = -span * 0.85, maxI = n - 1 + span * 0.85;
    if (this.i0 < minI) { this.i0 = minI; this.i1 = minI + span; }
    if (this.i1 > maxI) { this.i1 = maxI; this.i0 = maxI - span; }
  }
  /** Visible integer index range [a,b] clamped to the buffer. */
  range(n) {
    return [Math.max(0, Math.floor(this.i0)), Math.min(n - 1, Math.ceil(this.i1))];
  }

  /** Axis ticks: ~one per 90px, labels from the buffer's real timestamps.
   * @param {Float64Array} times @param {number} n
   * @returns {{x:number,label:string}[]} */
  ticks(times, n) {
    const out = [];
    const step = Math.max(1, Math.round(this.visibleBars() / (this.widthPx / 90)));
    const [a, b] = this.range(n);
    let lastY = null;
    for (let i = a - (a % step); i <= b; i += step) {
      if (i < 0 || i >= n) continue;
      const d = new Date(times[i] * 1000);
      const y = d.getUTCFullYear();
      const spanDays = (times[Math.min(n - 1, b)] - times[Math.max(0, a)]) / 86400;
      let label;
      if (spanDays > 900) { label = String(y); }
      else if (spanDays > 40) {
        label = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
        if (y !== lastY) { label += " ’" + String(y).slice(2); lastY = y; }
      } else if (spanDays > 2) {
        label = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
      } else {
        label = d.toISOString().slice(11, 16);
      }
      out.push({ x: this.xForIndex(i), label });
    }
    return out;
  }
}
