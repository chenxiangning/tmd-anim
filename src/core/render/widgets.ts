import type { KbdElement, ListElement, ProgressElement } from "../types";
import { roundRect, sansFont } from "./text";

/** 小组件绘制:要点列表 / 进度条 / 按键。全部确定性绘制,不依赖时序状态。 */

export function drawList(ctx: CanvasRenderingContext2D, el: ListElement, progress?: number): void {
  const fontSize = el.fontSize ?? 36;
  const itemH = fontSize * 1.9;
  const items = el.items ?? [];
  const shown = progress === undefined ? items.length : Math.max(0, Math.ceil(progress * items.length));
  if (shown === 0) return;
  const accent = el.accent ?? "#3B82F6";
  const markerW = fontSize * 1.7;
  const totalH = items.length * itemH;
  let ly = el.y + Math.max((el.h - totalH) / 2, 0) + itemH / 2;
  ctx.save();
  ctx.textBaseline = "middle";
  for (let i = 0; i < shown; i++) {
    const mx = el.x + markerW / 2;
    const label = items[i];
    ctx.font = sansFont(fontSize, 500);
    ctx.textAlign = "left";
    ctx.fillStyle = el.color ?? "#1F2937";
    ctx.fillText(label, el.x + markerW, ly + 1);
    if (el.marker === "number") {
      const s = fontSize * 1.15;
      roundRect(ctx, el.x, ly - s / 2, s, s, s * 0.32);
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.font = sansFont(fontSize * 0.62, 700);
      ctx.textAlign = "center";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(String(i + 1), el.x + s / 2, ly + 1);
    } else if (el.marker === "check") {
      ctx.font = sansFont(fontSize * 0.95, 700);
      ctx.textAlign = "center";
      ctx.fillStyle = accent;
      ctx.fillText("✓", mx, ly + 1);
    } else {
      ctx.beginPath();
      ctx.arc(mx, ly, fontSize * 0.18, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();
    }
    ly += itemH;
  }
  ctx.restore();
}

export function drawProgress(ctx: CanvasRenderingContext2D, el: ProgressElement): void {
  const fontSize = el.fontSize ?? 30;
  const percent = Math.min(100, Math.max(0, el.percent ?? 60));
  const showText = el.showText !== false;
  const barH = Math.max(6, Math.min(fontSize * 1.35, el.label !== undefined ? el.h - fontSize * 2.1 : el.h));
  ctx.save();
  ctx.font = sansFont(fontSize, 600);
  const textW = showText ? ctx.measureText(`${percent}%`).width : 0;
  const barY = el.label !== undefined ? el.y + fontSize * 2.1 + Math.max((el.h - fontSize * 2.1 - barH) / 2, 0) : el.y + (el.h - barH) / 2;
  const barW = el.label !== undefined ? el.w : el.w - (textW > 0 ? textW + fontSize * 0.5 : 0);
  const radius = barH / 2;
  roundRect(ctx, el.x, barY, barW, barH, radius);
  ctx.fillStyle = el.trackColor ?? "#E2E8F0";
  ctx.fill();
  const fillW = Math.max(barW * (percent / 100), radius);
  roundRect(ctx, el.x, barY, Math.min(fillW, barW), barH, radius);
  ctx.fillStyle = el.barColor ?? "#3B82F6";
  ctx.fill();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  if (el.label !== undefined) {
    ctx.fillStyle = "#334155";
    ctx.fillText(el.label, el.x, el.y + fontSize * 1.05);
  }
  if (showText) {
    ctx.fillStyle = el.label !== undefined ? "#64748B" : "#475569";
    ctx.fillText(`${percent}%`, el.x + (el.label !== undefined ? el.w - textW : barW + fontSize * 0.25), el.label !== undefined ? el.y + fontSize * 1.05 : barY + barH / 2 + 1);
  }
  ctx.restore();
}

export function drawKbd(ctx: CanvasRenderingContext2D, el: KbdElement): void {
  const fontSize = el.fontSize ?? 36;
  const tokens = el.text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return;
  const capH = fontSize * 1.7;
  const gap = fontSize * 0.45;
  ctx.save();
  ctx.font = sansFont(fontSize, 600);
  const widths = tokens.map((t) => (t === "+" ? ctx.measureText(t).width : Math.max(ctx.measureText(t).width + fontSize * 0.72, fontSize * 1.4)));
  const totalW = widths.reduce((a, b) => a + b, 0) + gap * (tokens.length - 1);
  let lx = el.x + Math.max((el.w - totalW) / 2, 0);
  const cy = el.y + el.h / 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  tokens.forEach((token, i) => {
    const w = widths[i];
    if (token === "+") {
      ctx.fillStyle = "#94A3B8";
      ctx.fillText(token, lx + w / 2, cy + 1);
    } else {
      // 键帽:底层投影 + 顶层帽体
      const capY = cy - capH / 2;
      roundRect(ctx, lx, capY + fontSize * 0.14, w, capH, fontSize * 0.32);
      ctx.fillStyle = "rgba(100,116,139,0.45)";
      ctx.fill();
      roundRect(ctx, lx, capY, w, capH, fontSize * 0.32);
      ctx.fillStyle = el.bg ?? "#FFFFFF";
      ctx.fill();
      ctx.strokeStyle = "#CBD5E1";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#1E293B";
      ctx.fillText(token, lx + w / 2, capY + capH / 2);
    }
    lx += w + gap;
  });
  ctx.restore();
}
