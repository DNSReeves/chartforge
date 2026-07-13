// ChartForge Engine — interaction physics (IMPL_CHARTFORGE §2b).
// Unified pointer events (mouse+touch), drag-pan with INERTIA (velocity tracker
// + exponential decay), wheel + pinch anchor-zoom, double-tap fit, tap-hold
// crosshair on touch. All input is RAF-coalesced; every gesture cancels cleanly.

export class Interaction {
  /** @param {HTMLElement} el capture element (the chart body)
   *  @param {import('./timescale.js').TimeScale} ts
   *  @param {{requestDraw:(layers:string)=>void, onCrosshair:(pt:any)=>void,
   *           barCount:()=>number, fit:()=>void}} hooks */
  constructor(el, ts, hooks) {
    this.el = el; this.ts = ts; this.hooks = hooks;
    this.pointers = new Map();
    this.vel = 0; this.lastX = 0; this.lastT = 0;
    this.inertiaRAF = 0;
    this.pinchDist = 0;
    this.holdTimer = 0;
    this.crosshairLocked = false;
    this.lastTap = 0;
    el.style.touchAction = "none";
    el.addEventListener("pointerdown", this.down, { passive: false });
    el.addEventListener("pointermove", this.move, { passive: false });
    el.addEventListener("pointerup", this.up, { passive: false });
    el.addEventListener("pointercancel", this.up, { passive: false });
    el.addEventListener("pointerleave", this.leave, { passive: true });
    el.addEventListener("wheel", this.wheel, { passive: false });
  }

  _stopInertia() { if (this.inertiaRAF) { cancelAnimationFrame(this.inertiaRAF); this.inertiaRAF = 0; } }

  down = (e) => {
    e.preventDefault();
    this.el.setPointerCapture?.(e.pointerId);
    this._stopInertia();
    this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (this.pointers.size === 1) {
      this.lastX = e.offsetX; this.lastT = performance.now(); this.vel = 0;
      // double-tap → fit
      const now = performance.now();
      if (now - this.lastTap < 300) { this.hooks.fit(); this.lastTap = 0; return; }
      this.lastTap = now;
      // touch: tap-hold locks the crosshair instead of panning
      if (e.pointerType === "touch") {
        this.holdTimer = setTimeout(() => {
          this.crosshairLocked = true;
          this.hooks.onCrosshair({ x: e.offsetX, y: e.offsetY });
        }, 350);
      }
    } else if (this.pointers.size === 2) {
      clearTimeout(this.holdTimer);
      const [p1, p2] = [...this.pointers.values()];
      this.pinchDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    }
  };

  move = (e) => {
    if (this.pointers.has(e.pointerId)) {
      this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      if (this.pointers.size === 2) {                       // pinch zoom
        e.preventDefault();
        const [p1, p2] = [...this.pointers.values()];
        const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        if (this.pinchDist > 0 && d > 0) {
          const anchor = (p1.x + p2.x) / 2;
          this.ts.zoom(d / this.pinchDist, anchor);
          this.ts.clamp(this.hooks.barCount());
          this.hooks.requestDraw("scale");
        }
        this.pinchDist = d;
        return;
      }
      if (this.crosshairLocked) { this.hooks.onCrosshair({ x: e.offsetX, y: e.offsetY }); return; }
      // drag pan
      e.preventDefault();
      clearTimeout(this.holdTimer);
      const now = performance.now();
      const dx = e.offsetX - this.lastX;
      const dt = Math.max(1, now - this.lastT);
      this.vel = 0.8 * this.vel + 0.2 * (dx / dt);          // px/ms, smoothed
      this.lastX = e.offsetX; this.lastT = now;
      this.ts.panPx(dx);
      this.ts.clamp(this.hooks.barCount());
      this.hooks.requestDraw("scale");
    } else if (e.pointerType === "mouse") {
      this.hooks.onCrosshair({ x: e.offsetX, y: e.offsetY });   // hover crosshair
    }
  };

  up = (e) => {
    clearTimeout(this.holdTimer);
    this.pointers.delete(e.pointerId);
    if (this.crosshairLocked && this.pointers.size === 0) {
      this.crosshairLocked = false;
      this.hooks.onCrosshair(null);
      return;
    }
    if (this.pointers.size === 0 && Math.abs(this.vel) > 0.05) this._inertia();
    this.pinchDist = 0;
  };

  leave = () => { if (!this.crosshairLocked && this.pointers.size === 0) this.hooks.onCrosshair(null); };

  _inertia() {
    // exponential decay: v *= exp(-dt/tau); stop under 0.02 px/ms
    const tau = 325;
    let last = performance.now();
    const step = (now) => {
      const dt = now - last; last = now;
      this.vel *= Math.exp(-dt / tau);
      if (Math.abs(this.vel) < 0.02) { this.inertiaRAF = 0; return; }
      this.ts.panPx(this.vel * dt);
      this.ts.clamp(this.hooks.barCount());
      this.hooks.requestDraw("scale");
      this.inertiaRAF = requestAnimationFrame(step);
    };
    this.inertiaRAF = requestAnimationFrame(step);
  }

  wheel = (e) => {
    e.preventDefault();
    this._stopInertia();
    if (e.ctrlKey || Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
      const factor = Math.exp(-e.deltaY * 0.0018);          // trackpad-smooth
      this.ts.zoom(factor, e.offsetX);
    } else {
      this.ts.panPx(-e.deltaX);
    }
    this.ts.clamp(this.hooks.barCount());
    this.hooks.requestDraw("scale");
  };
}
