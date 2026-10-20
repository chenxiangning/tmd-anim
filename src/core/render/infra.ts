import type { ChipRowElement, RingNodeElement, StackListElement } from "../types";
import { withAlpha } from "./color";
import { roundRect, sansFont } from "./text";

/**
 * 信息图小件第二批:胶囊组 / 圆环节点 / 编号叠纸列。
 * 都服务于「结构图里的小语义单元」:状态变体、抽象角色、K 份样本。
 * 纯 (el, progress) 绘制,颜色一律走 withAlpha,未知字段回落缺省。
 */

const INK = "#1F2937";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";
const ACCENT = "#3B82F6";

/** 胶囊组:单行横排,宽度按文本自然宽度 + 内边距;style 决定填充/描边;typewriter = 逐个显现 */
export function drawChipRow(ctx: CanvasRenderingContext2D, el: ChipRowElement, progress?: number): void {
  const fontSize = el.fontSize ?? 22;
  const items = el.items ?? [];
  if (items.length === 0) return;
  const gap = el.gap ?? fontSize * 0.55;
  const padX = fontSize * 0.8;
  const h = fontSize * 1.75;
  const reveal = progress === undefined ? items.length : Math.min(items.length, Math.max(0, progress * items.length));
  ctx.save();
  ctx.font = sansFont(fontSize, 600);
  ctx.textBaseline = "middle";
  const widths = items.map((it) => Math.max(h, ctx.measureText(it.text).width + padX * 2));
  const total = widths.reduce((a, b) => a + b, 0) + gap * (items.length - 1);
  const startX = el.align === "center" ? el.x + (el.w - total) / 2 : el.align === "right" ? el.x + el.w - total : el.x;
  const y = el.y + (el.h - h) / 2;
  const baseAlpha = ctx.globalAlpha;
  let x = startX;
  items.forEach((it, i) => {
    const partial = reveal - i;
    if (partial <= 0) return;
    ctx.globalAlpha = baseAlpha * Math.min(1, partial * 2.2);
    const color = it.color ?? ACCENT;
    const style = it.style ?? "tint";
    roundRect(ctx, x, y, widths[i], h, h / 2);
    if (style === "solid") {
      ctx.fillStyle = color;
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
    } else if (style === "outline" || style === "dashed") {
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      if (style === "dashed") ctx.setLineDash([fontSize * 0.3, fontSize * 0.24]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = color;
    } else {
      ctx.fillStyle = withAlpha(color, "1F");
      ctx.fill();
      ctx.fillStyle = color;
    }
    ctx.textAlign = "center";
    ctx.fillText(it.text, x + widths[i] / 2, y + h / 2 + 1, widths[i] - padX);
    x += widths[i] + gap;
  });
  ctx.globalAlpha = baseAlpha;
  ctx.restore();
}

/** 圆环节点:外光晕 + 主圆环 + 内虚环 + 居中主文字/副文字(直径取 min(w,h)) */
export function drawRingNode(ctx: CanvasRenderingContext2D, el: RingNodeElement): void {
  const fontSize = el.fontSize ?? 34;
  const accent = el.accent ?? ACCENT;
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  const R = Math.max(12, Math.min(el.w, el.h) / 2);
  const ringW = Math.max(3, R * 0.055) * (el.ring ?? 1);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(accent, "12");
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, R - ringW * 1.6, 0, Math.PI * 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = ringW;
  ctx.stroke();
  // 内虚环:给"核"一点层次,不抢文字
  ctx.beginPath();
  ctx.arc(cx, cy, (R - ringW * 1.6) * 0.74, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(accent, "3D");
  ctx.lineWidth = Math.max(1.5, ringW * 0.35);
  ctx.setLineDash([6, 6]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // 圆内可用宽度约为 1.7R;文字超宽按比例缩字号,避免压出环外
  const fit = (text: string, base: number, maxW: number): number => {
    ctx.font = sansFont(base, 600);
    const tw = ctx.measureText(text).width;
    return tw > maxW ? Math.max(11, base * (maxW / tw)) : base;
  };
  const box = R * 1.5;
  if (el.sub) {
    const label = el.label ?? "";
    const fsL = fit(label, fontSize, box);
    ctx.font = sansFont(fsL, 600);
    ctx.fillStyle = INK;
    ctx.fillText(label, cx, cy - fontSize * 0.5);
    const fsS = fit(el.sub, fontSize * 0.6, box);
    ctx.font = sansFont(fsS, 500);
    ctx.fillStyle = MUTED;
    ctx.fillText(el.sub, cx, cy + fontSize * 0.75);
  } else {
    const label = el.label ?? "";
    const fsL = fit(label, fontSize, box);
    ctx.font = sansFont(fsL, 600);
    ctx.fillStyle = INK;
    ctx.fillText(label, cx, cy + 1);
  }
  ctx.restore();
}

/** 单张纸:白底圆角 + 顶部折角 + 三条文本示意线 */
function drawSheet(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, accent: string, active: boolean): void {
  roundRect(ctx, x, y, w, h, 6);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = active ? accent : BORDER;
  ctx.lineWidth = active ? 2 : 1.5;
  ctx.stroke();
  const fold = w * 0.26;
  ctx.beginPath();
  ctx.moveTo(x + w - fold, y);
  ctx.lineTo(x + w, y + fold);
  ctx.lineTo(x + w - fold, y + fold);
  ctx.closePath();
  ctx.fillStyle = withAlpha(accent, "26");
  ctx.fill();
  ctx.fillStyle = withAlpha(accent, "59");
  for (let l = 0; l < 3; l++) {
    roundRect(ctx, x + w * 0.16, y + h * (0.32 + l * 0.17), w * (0.62 - l * 0.13), Math.max(2, h * 0.045), 2);
    ctx.fill();
  }
}

/** 编号叠纸列:每段「编号 + 叠纸」纵向平分,段间画竖向省略号;typewriter = 逐段显现 */
export function drawStackList(ctx: CanvasRenderingContext2D, el: StackListElement, progress?: number): void {
  const fontSize = el.fontSize ?? 24;
  const accent = el.accent ?? "#8B5CF6";
  const keys = (el.keys && el.keys.length > 0 ? el.keys : ["1", "K"]).slice(0, 3);
  const sheets = Math.min(4, Math.max(1, Math.round(el.sheets ?? 2)));
  const showDots = el.ellipsis !== false && keys.length > 1;
  const reveal = progress === undefined ? keys.length : Math.min(keys.length, Math.max(0, progress * keys.length));
  const labelH = el.label ? fontSize * 2.1 : 0;
  const dotsH = showDots ? fontSize * 1.9 * (keys.length - 1) : 0;
  const blockH = (el.h - labelH - dotsH) / keys.length;
  if (blockH <= 0) return;
  ctx.save();
  ctx.textBaseline = "middle";
  const baseAlpha = ctx.globalAlpha;
  if (el.label) {
    ctx.font = sansFont(fontSize * 0.8, 600);
    ctx.textAlign = "center";
    ctx.fillStyle = MUTED;
    ctx.fillText(el.label, el.x + el.w / 2, el.y + fontSize * 0.9, el.w);
  }
  keys.forEach((key, i) => {
    const partial = reveal - i;
    if (partial <= 0) return;
    ctx.globalAlpha = baseAlpha * Math.min(1, partial * 2.2);
    const top = el.y + labelH + i * (blockH + dotsH / Math.max(1, keys.length - 1));
    // 编号左列
    ctx.font = sansFont(fontSize * 0.85, 600);
    ctx.textAlign = "center";
    ctx.fillStyle = MUTED;
    ctx.fillText(key, el.x + fontSize * 0.7, top + blockH / 2);
    // 叠纸:右移错位,末张高亮
    const areaX = el.x + fontSize * 1.7;
    const areaW = el.w - fontSize * 1.7;
    const pw = Math.min(areaW * 0.62, blockH * 0.78);
    const ph = pw * 1.16;
    const step = Math.min(7, pw * 0.14);
    const baseX = areaX + (areaW - pw - step * (sheets - 1)) / 2;
    const baseY = top + (blockH - ph + step * (sheets - 1)) / 2;
    for (let s = 0; s < sheets; s++) {
      drawSheet(ctx, baseX + s * step, baseY - s * step, pw, ph, accent, s === sheets - 1);
    }
    // 段间省略号(画在上一段之后的空隙里)
    if (showDots && i < keys.length - 1) {
      const cy = top + blockH + dotsH / Math.max(1, keys.length - 1) / 2;
      for (let d = -1; d <= 1; d++) {
        ctx.beginPath();
        ctx.arc(el.x + el.w / 2, cy + d * fontSize * 0.45, Math.max(2, fontSize * 0.1), 0, Math.PI * 2);
        ctx.fillStyle = MUTED;
        ctx.fill();
      }
    }
  });
  ctx.globalAlpha = baseAlpha;
  ctx.restore();
}
