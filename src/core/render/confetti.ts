import type { ConfettiElement } from "../types";

/**
 * 纸屑粒子:种子确定性,rain 全区循环飘落 / burst 自中心迸发一次。
 * 同 (seed, age) 恒同画面,满足「渲染是 (project,t) 纯函数」;乘法散列足够,不上重量级 PRNG。
 */

const DEFAULT_COLORS = ["#F87171", "#FBBF24", "#34D399", "#60A5FA", "#F472B6", "#A78BFA"];
const BURST_DURATION = 1.6;

/** mulberry32:32 位种子 -> [0,1) 确定性序列 */
function rng32(seed: number): () => number {
  let a = Math.floor(seed) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawPiece(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rot: number, color: string, alpha: number): void {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.fillRect(-size / 2, -size * 0.35, size, size * 0.7);
  ctx.restore();
}

export function drawConfetti(ctx: CanvasRenderingContext2D, el: ConfettiElement, age: number): void {
  const rain = (el.mode ?? "rain") !== "burst";
  const count = Math.min(200, Math.max(10, Math.round(el.count ?? 80)));
  const colors = el.colors && el.colors.length > 0 ? el.colors : DEFAULT_COLORS;
  const rng = rng32(el.seed ?? 42);
  if (!rain) {
    const q = Math.min(1, age / BURST_DURATION);
    if (q >= 1) return;
    const cx = el.x + el.w / 2;
    const cy = el.y + el.h / 2;
    const reach = Math.max(el.w, el.h) * 0.6 + 60;
    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2;
      const travel = (0.3 + rng() * 0.7) * reach * q;
      const px = cx + Math.cos(angle) * travel;
      // 重力:竖直分量随 q² 下坠,抛物线感
      const py = cy + Math.sin(angle) * travel * 0.7 + 300 * q * q;
      drawPiece(ctx, px, py, 8 + rng() * 8, rng() * Math.PI * 2 + q * 3, colors[i % colors.length], 1 - q);
    }
    return;
  }
  for (let i = 0; i < count; i++) {
    const x0 = rng() * el.w;
    const y0 = rng() * el.h;
    const speed = 90 + rng() * 150;
    const size = 7 + rng() * 9;
    const rot0 = rng() * Math.PI * 2;
    const rotSpeed = (rng() - 0.5) * 5;
    const phase = rng() * Math.PI * 2;
    const y = el.y + ((y0 + age * speed) % el.h);
    const x = el.x + x0 + Math.sin(age * 1.4 + phase) * 16;
    drawPiece(ctx, x, y, size, rot0 + age * rotSpeed, colors[i % colors.length], 1);
  }
}
