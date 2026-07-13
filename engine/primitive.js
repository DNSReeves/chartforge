// ChartForge Engine — the primitive (drawing/overlay) API (IMPL_CHARTFORGE §2b).
// Every §3 drawing family and any future overlay is a plugin over this surface;
// P0 ships the contract + hit-test helpers, P2+ ships the tool families.

/**
 * @typedef {Object} Primitive
 * @property {(ctx:CanvasRenderingContext2D, vp:{ts:any,ps:any,w:number,h:number})=>void} draw
 * @property {(pt:{x:number,y:number}, vp:Object)=>boolean} [hitTest]
 * @property {()=>Object} [serialize]
 */

/** px distance from point to segment — the shared hit-test helper. */
export function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2)) : 0;
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** A trend line anchored in (barIndex, price) space — the reference primitive. */
export class TrendLine {
  constructor(i1, p1, i2, p2, { color = "#ffb74d", width = 1.5 } = {}) {
    Object.assign(this, { i1, p1, i2, p2, color, width });
  }
  draw(ctx, { ts, ps }) {
    ctx.beginPath();
    ctx.strokeStyle = this.color; ctx.lineWidth = this.width;
    ctx.moveTo(ts.xForIndex(this.i1), ps.yForPrice(this.p1));
    ctx.lineTo(ts.xForIndex(this.i2), ps.yForPrice(this.p2));
    ctx.stroke();
  }
  hitTest(pt, { ts, ps }) {
    return distToSegment(pt.x, pt.y,
      ts.xForIndex(this.i1), ps.yForPrice(this.p1),
      ts.xForIndex(this.i2), ps.yForPrice(this.p2)) < 6;
  }
  serialize() { return { type: "trendline", i1: this.i1, p1: this.p1, i2: this.i2, p2: this.p2, color: this.color }; }
}
