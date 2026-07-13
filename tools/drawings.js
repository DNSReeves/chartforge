// ChartForge — drawing tools (adapter-free geometry over the primitive API).
// ALL NINE families, 26 tools. Anchors live in (barIndex, price) space.
import { distToSegment } from "../engine/primitive.js";

// ── drawing tool geometry (families F1/F2/F4/F5/F6/F8/F9 — §3b) ─────────────
// Anchors live in (barIndex, price) space; drawings survive pan/zoom/resample-free.
export function mkTool(kind, a, b, opts = {}) {
  return { kind, a, b, c: opts.c || null, text: opts.text || "", color: opts.color || "#ffb74d", id: opts.id || null };
}

export function drawTool(t, ctx, vp) {
  const { ts, ps, w, h } = vp;
  const X = (i) => ts.xForIndex(i), Y = (p) => ps.yForPrice(p);
  const x1 = X(t.a.i), y1 = Y(t.a.p);
  const x2 = t.b ? X(t.b.i) : x1, y2 = t.b ? Y(t.b.p) : y1;
  ctx.strokeStyle = t.color; ctx.fillStyle = t.color; ctx.lineWidth = 1.5;
  ctx.font = "11px system-ui"; ctx.textBaseline = "bottom";
  const line = (ax, ay, bx, by) => { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); };
  switch (t.kind) {
    case "trend": line(x1, y1, x2, y2); break;
    case "ray": {
      const dx = x2 - x1, dy = y2 - y1;
      const k = dx !== 0 ? (w + 100 - x1) / dx : 0;
      line(x1, y1, dx ? x1 + dx * Math.max(k, 1) : x1, dx ? y1 + dy * Math.max(k, 1) : h);
      break;
    }
    case "hline":
      line(0, y1, w, y1);
      ctx.fillText(t.text || fmt(t.a.p), 6, y1 - 3);
      break;
    case "vline": line(x1, 0, x1, h); break;
    case "channel": {                        // parallel channel: a→b + offset via c
      line(x1, y1, x2, y2);
      const off = t.c ? Y(t.c.p) - Y(t.a.p) : -40;
      line(x1, y1 + off, x2, y2 + off);
      ctx.globalAlpha = 0.08;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.lineTo(x2, y2 + off); ctx.lineTo(x1, y1 + off); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case "pitchfork": {                      // standard: median from a through mid(b,c), parallels at b,c
      const cx = t.c ? X(t.c.i) : x2, cy = t.c ? Y(t.c.p) : y2;
      const mx = (x2 + cx) / 2, my = (y2 + cy) / 2;
      const dx = mx - x1, dy = my - y1;
      const ext = dx !== 0 ? (w - x1) / dx : 1;
      line(x1, y1, x1 + dx * ext, y1 + dy * ext);
      line(x2, y2, x2 + dx * ext, y2 + dy * ext);
      line(cx, cy, cx + dx * ext, cy + dy * ext);
      break;
    }
    case "gannfan": {                        // rays at 1/1..1/8 & 8/1 slope ratios
      const dx = x2 - x1, dy = y2 - y1;
      for (const r of [8, 4, 3, 2, 1, 1 / 2, 1 / 3, 1 / 4, 1 / 8]) {
        ctx.globalAlpha = r === 1 ? 1 : 0.45;
        line(x1, y1, x1 + dx * 3, y1 + dy * r * 3);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "fib": case "fibext": {             // retracement / extension levels
      const levels = t.kind === "fib" ? [0, .236, .382, .5, .618, .786, 1]
                                      : [0, .618, 1, 1.272, 1.618, 2.618];
      const p1 = t.a.p, p2 = t.b ? t.b.p : p1;
      for (const lv of levels) {
        const p = p2 - (p2 - p1) * lv;
        const y = Y(p);
        ctx.globalAlpha = lv === 0 || lv === 1 ? 0.9 : 0.5;
        line(Math.min(x1, x2), y, Math.max(x1, x2) + 60, y);
        ctx.fillText(`${(lv * 100).toFixed(1)}% ${fmt(p)}`, Math.max(x1, x2) + 64, y + 4);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "rect": case "measure": {
      ctx.globalAlpha = 0.10;
      ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      ctx.globalAlpha = 1;
      ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      if (t.kind === "measure" && t.b) {     // §3 brush+stats: Δ%, bars
        const dp = (t.b.p / t.a.p - 1) * 100;
        const bars = Math.abs(Math.round(t.b.i - t.a.i));
        ctx.fillText(`${dp >= 0 ? "+" : ""}${dp.toFixed(2)}% · ${bars} bars`,
                     Math.min(x1, x2) + 4, Math.min(y1, y2) - 4);
      }
      break;
    }
    case "ellipse": {
      ctx.beginPath();
      ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2);
      ctx.globalAlpha = 0.10; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
      break;
    }
    case "polyline": {
      const pts = t.pts || [];
      if (pts.length < 2) break;
      ctx.beginPath(); ctx.moveTo(X(pts[0].i), Y(pts[0].p));
      for (let k = 1; k < pts.length; k++) ctx.lineTo(X(pts[k].i), Y(pts[k].p));
      ctx.stroke();
      break;
    }
    case "text":
      ctx.font = "12px system-ui";
      ctx.fillText(t.text || "note", x1, y1);
      break;
    case "arrow": {
      line(x1, y1, x2, y2);
      const ang = Math.atan2(y2 - y1, x2 - x1);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - 10 * Math.cos(ang - 0.4), y2 - 10 * Math.sin(ang - 0.4));
      ctx.lineTo(x2 - 10 * Math.cos(ang + 0.4), y2 - 10 * Math.sin(ang + 0.4));
      ctx.closePath(); ctx.fill();
      break;
    }
    case "callout": {                        // text + leader line
      line(x1, y1, x2, y2);
      ctx.font = "12px system-ui";
      const msg = t.text || "note";
      const tw = ctx.measureText(msg).width;
      ctx.globalAlpha = 0.85; ctx.fillStyle = "#1f2530";
      ctx.fillRect(x2 - 4, y2 - 16, tw + 8, 20);
      ctx.globalAlpha = 1; ctx.fillStyle = t.color;
      ctx.fillText(msg, x2, y2);
      break;
    }
    case "flag":
      ctx.font = "14px system-ui";
      ctx.fillText("⚑", x1 - 4, y1);
      break;
    case "fibfan": {                         // rays through fib fractions of the a→b move
      for (const lv of [0.382, 0.5, 0.618]) {
        const fy = y1 + (y2 - y1) * lv;
        const dx = x2 - x1, dy = fy - y1;
        ctx.globalAlpha = 0.6;
        line(x1, y1, x1 + dx * 4, y1 + dy * 4);
        ctx.fillText(String(lv), x2 + 4, fy);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "fibtz": {                          // fib time zones: verticals at 1,2,3,5,8,13,21… bars
      const span = Math.max(1, Math.round((t.b ? t.b.i : t.a.i + 5) - t.a.i));
      let f1 = 1, f2 = 1;
      ctx.globalAlpha = 0.5;
      for (let k = 0; k < 10; k++) {
        const x = X(t.a.i + f1 * span);
        if (x > w) break;
        line(x, 0, x, h);
        [f1, f2] = [f2, f1 + f2];
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "gannbox": {                        // rect + fib splits both axes
      const L = Math.min(x1, x2), R = Math.max(x1, x2), T2 = Math.min(y1, y2), B = Math.max(y1, y2);
      ctx.strokeRect(L, T2, R - L, B - T2);
      ctx.globalAlpha = 0.4;
      for (const f of [0.25, 0.382, 0.5, 0.618, 0.75]) {
        line(L, T2 + (B - T2) * f, R, T2 + (B - T2) * f);
        line(L + (R - L) * f, T2, L + (R - L) * f, B);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "schiff": {                         // schiff pitchfork: median origin = midpoint(a,b)
      const cx = t.c ? X(t.c.i) : x2, cy = t.c ? Y(t.c.p) : y2;
      const ox = (x1 + x2) / 2, oy = (y1 + y2) / 2;
      const mx = (x2 + cx) / 2, my = (y2 + cy) / 2;
      const dx = mx - ox, dy = my - oy;
      const ext = dx !== 0 ? (w - ox) / dx : 1;
      line(ox, oy, ox + dx * ext, oy + dy * ext);
      line(x2, y2, x2 + dx * ext, y2 + dy * ext);
      line(cx, cy, cx + dx * ext, cy + dy * ext);
      break;
    }
    case "xabcd": case "elliott": {          // pattern markup: labeled polyline
      const pts = t.pts || [];
      if (!pts.length) break;
      const labels = t.kind === "xabcd" ? ["X", "A", "B", "C", "D"] : ["1", "2", "3", "4", "5"];
      ctx.beginPath(); ctx.moveTo(X(pts[0].i), Y(pts[0].p));
      for (let k = 1; k < pts.length; k++) ctx.lineTo(X(pts[k].i), Y(pts[k].p));
      ctx.stroke();
      ctx.font = "11px system-ui";
      pts.forEach((pt2, k) => ctx.fillText(labels[k] || String(k + 1), X(pt2.i) + 4, Y(pt2.p) - 4));
      break;
    }
    case "long": case "short": {             // F9 position: entry→target/stop + R:R
      const entry = t.a.p, target = t.b ? t.b.p : entry * (t.kind === "long" ? 1.05 : 0.95);
      const stop = t.c ? t.c.p : entry * (t.kind === "long" ? 0.97 : 1.03);
      const xL = Math.min(x1, x2), xR = Math.max(x1, x2, x1 + 90);
      const yE = Y(entry), yT = Y(target), yS = Y(stop);
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = "#26a69a"; ctx.fillRect(xL, Math.min(yE, yT), xR - xL, Math.abs(yT - yE));
      ctx.fillStyle = "#ef5350"; ctx.fillRect(xL, Math.min(yE, yS), xR - xL, Math.abs(yS - yE));
      ctx.globalAlpha = 1; ctx.fillStyle = t.color;
      const rr = Math.abs(target - entry) / Math.max(1e-9, Math.abs(entry - stop));
      ctx.fillText(`${t.kind.toUpperCase()} R:R ${rr.toFixed(2)} · e ${fmt(entry)} t ${fmt(target)} s ${fmt(stop)}`,
                   xL + 4, Math.min(yE, yT) - 4);
      break;
    }
  }
}

export function hitTool(t, pt, vp) {
  const { ts, ps } = vp;
  const x1 = ts.xForIndex(t.a.i), y1 = ps.yForPrice(t.a.p);
  const x2 = t.b ? ts.xForIndex(t.b.i) : x1, y2 = t.b ? ps.yForPrice(t.b.p) : y1;
  if (t.kind === "hline") return Math.abs(pt.y - y1) < 6;
  if (t.kind === "vline") return Math.abs(pt.x - x1) < 6;
  if (["rect", "measure", "ellipse", "long", "short"].includes(t.kind))
    return pt.x > Math.min(x1, x2) - 6 && pt.x < Math.max(x1, x2) + 6 &&
           pt.y > Math.min(y1, y2) - 6 && pt.y < Math.max(y1, y2) + 6;
  return distToSegment(pt.x, pt.y, x1, y1, x2, y2) < 7;
}

export const fmt = (v) => v >= 1000 ? Math.round(v).toLocaleString() : v >= 10 ? v.toFixed(2) : v.toFixed(4);
export const TOOLS = [["✋", null, "pan"], ["╱", "trend", "trend line"], ["→", "ray", "ray"],
  ["―", "hline", "h-line (🔔-able)"], ["|", "vline", "v-line"], ["∥", "channel", "channel"],
  ["🜄", "pitchfork", "pitchfork"], ["𝄩", "gannfan", "gann fan"], ["𝔽", "fib", "fib retracement"],
  ["𝔼", "fibext", "fib extension"], ["▭", "rect", "rectangle"], ["◯", "ellipse", "ellipse"],
  ["✎", "polyline", "polyline"], ["T", "text", "text"], ["⇲", "measure", "measure (stats)"],
  ["➹", "arrow", "arrow"], ["💬", "callout", "callout"], ["⚑", "flag", "flag"],
  ["𝘍", "fibfan", "fib fan"], ["𝆕", "fibtz", "fib time zones"], ["⊞", "gannbox", "gann box"],
  ["🜃", "schiff", "schiff pitchfork"], ["X", "xabcd", "XABCD pattern"], ["5", "elliott", "elliott waves"],
  ["▲", "long", "long position"], ["▼", "short", "short position"]];

