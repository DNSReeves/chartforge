// ChartForge Engine — SoA series buffer (IMPL_CHARTFORGE §2b, P0 2026-07-13).
// Column-oriented Float64Arrays so a full-viewport candle pass is a tight loop
// with zero per-point objects. Grows by doubling; never shrinks during a session.

/** @typedef {{time:number,open:number,high:number,low:number,close:number,volume?:number}} Bar */

export class SeriesBuffer {
  /** @param {number} [capacity] */
  constructor(capacity = 1024) {
    this.n = 0;
    this._alloc(capacity);
  }
  _alloc(cap) {
    this.cap = cap;
    this.time = new Float64Array(cap);
    this.open = new Float64Array(cap);
    this.high = new Float64Array(cap);
    this.low = new Float64Array(cap);
    this.close = new Float64Array(cap);
    this.volume = new Float64Array(cap);
  }
  _grow() {
    const old = { t: this.time, o: this.open, h: this.high, l: this.low, c: this.close, v: this.volume };
    this._alloc(this.cap * 2);
    this.time.set(old.t); this.open.set(old.o); this.high.set(old.h);
    this.low.set(old.l); this.close.set(old.c); this.volume.set(old.v);
  }
  /** Append one bar (time must be strictly increasing). @param {Bar} b */
  push(b) {
    if (this.n === this.cap) this._grow();
    const i = this.n++;
    this.time[i] = b.time; this.open[i] = b.open; this.high[i] = b.high;
    this.low[i] = b.low; this.close[i] = b.close; this.volume[i] = b.volume || 0;
  }
  /** Bulk load (replaces contents). @param {Bar[]} bars */
  setData(bars) {
    if (bars.length > this.cap) this._alloc(1 << Math.ceil(Math.log2(bars.length)));
    this.n = bars.length;
    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      this.time[i] = b.time; this.open[i] = b.open; this.high[i] = b.high;
      this.low[i] = b.low; this.close[i] = b.close; this.volume[i] = b.volume || 0;
    }
  }
  /** Update-or-append the last bar (live ticks). @param {Bar} b */
  update(b) {
    if (this.n && this.time[this.n - 1] === b.time) {
      const i = this.n - 1;
      this.open[i] = b.open; this.high[i] = b.high; this.low[i] = b.low;
      this.close[i] = b.close; this.volume[i] = b.volume || 0;
    } else this.push(b);
  }
  /** Binary search: greatest index with time <= t (or -1). @param {number} t */
  indexAtTime(t) {
    let lo = 0, hi = this.n - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.time[mid] <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return ans;
  }
  /** min/max of price columns over [i0,i1] inclusive (viewport autoscale). */
  minMax(i0, i1) {
    let mn = Infinity, mx = -Infinity;
    const lo = this.low, hi = this.high;
    for (let i = Math.max(0, i0); i <= Math.min(this.n - 1, i1); i++) {
      if (lo[i] < mn) mn = lo[i];
      if (hi[i] > mx) mx = hi[i];
    }
    return mn <= mx ? [mn, mx] : [0, 1];
  }
  /** max of volume over [i0,i1] (histogram pane autoscale). */
  maxVolume(i0, i1) {
    let mx = 0;
    const v = this.volume;
    for (let i = Math.max(0, i0); i <= Math.min(this.n - 1, i1); i++) if (v[i] > mx) mx = v[i];
    return mx || 1;
  }
}
