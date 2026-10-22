import type { ArtTextElement, BadgeElement, InputElement, NoteElement, ShapeElement, TextElement, TitleElement } from "../types";
import { easingByName } from "./anim";
import { traceShape } from "./shapeGeo";
import { drawRichText, roundRect, sansFont } from "./text";

/** 文本类元素绘制:标题 / 艺术字 / 正文 / 输入框 / 便签 / 徽章 / 形状。 */

/** 按填充亮度反推可读文字色(亮色底用深字,暗色底用白字);形状绘制与行内编辑共用 */
export function readableOn(fill: string | undefined): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(fill ?? "");
  if (!m) return "#1F2937";
  const n = parseInt(m[1], 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 150 ? "#1F2937" : "#FFFFFF";
}

export function drawShape(ctx: CanvasRenderingContext2D, el: ShapeElement): void {
  traceShape(ctx, el);
  const hasStroke = Boolean(el.stroke) && (el.strokeWidth ?? 0) > 0;
  // 柔和投影:只随第一次上色(填充优先,无填充时随描边)投一次,复线与内嵌文字不重复投影
  if (el.shadow === true) {
    ctx.shadowColor = "rgba(15,23,42,0.16)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 7;
  }
  if (el.fill) {
    ctx.fillStyle = el.fill;
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  } else if (!hasStroke) {
    // 既无填充也无描边时给浅灰底,避免画布上不可见
    ctx.fillStyle = "rgba(100,116,139,0.18)";
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
  if (hasStroke) {
    ctx.strokeStyle = el.stroke as string;
    ctx.lineWidth = el.strokeWidth ?? 0;
    ctx.stroke();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    if (el.sketch) {
      // 手绘感:同路径叠一道更细更淡的复线,像起稿描边
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = (el.strokeWidth ?? 0) * 0.55;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  if (el.text) {
    drawRichText(ctx, el.x, el.y, el.w, el.h, el.text, {
      fontSize: el.fontSize ?? 28,
      color: el.color ?? readableOn(el.fill),
      align: "center",
    });
  }
}

export function drawTitle(ctx: CanvasRenderingContext2D, el: TitleElement, progress?: number): void {
  const fontSize = el.fontSize ?? 64;
  // 有副标题时主标题收进上方 78%,副标题占底部一条(居中小字灰)
  const subH = el.sub ? fontSize * 0.85 : 0;
  const mainH = el.h - subH;
  // 逐字入场:单行且无高亮芯片时按字符错峰上浮;其余情形回落普通绘制
  if (el.kinetic && progress != null && !(el.highlight && el.highlight.length > 0) && !el.text.includes("\n")) {
    drawKineticText(ctx, el, mainH, progress);
  } else {
    drawRichText(ctx, el.x, el.y, el.w, mainH, el.text, {
      fontSize,
      color: el.color ?? "#111827",
      align: "center",
      highlights: el.highlight,
      progress,
    });
  }
  if (el.sub) {
    drawRichText(ctx, el.x, el.y + el.h - subH, el.w, subH, el.sub, {
      fontSize: Math.max(14, fontSize * 0.36),
      color: "#64748B",
      align: "center",
      progress,
    });
  }
}

/** 逐字入场:按字符错峰上浮浮现(spring 缓动),字符宽实测排布,居中与 drawRichText 对齐 */
function drawKineticText(ctx: CanvasRenderingContext2D, el: TitleElement, mainH: number, progress: number): void {
  const fontSize = el.fontSize ?? 64;
  const chars = Array.from(el.text);
  ctx.save();
  ctx.font = sansFont(fontSize, 600);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = el.color ?? "#111827";
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0);
  const ly = el.y + mainH / 2 + 1;
  let lx = el.x + (el.w - total) / 2;
  const n = chars.length;
  const step = n > 1 ? Math.min(0.06, 0.5 / (n - 1)) : 0;
  const span = 1 - step * (n - 1);
  const spring = easingByName("spring");
  for (let i = 0; i < n; i++) {
    const ci = Math.min(1, Math.max(0, (progress - i * step) / span));
    const e = spring(ci);
    ctx.globalAlpha = Math.min(1, ci * 3);
    ctx.fillText(chars[i] as string, lx, ly + (1 - e) * fontSize * 0.38);
    lx += widths[i] as number;
  }
  ctx.restore();
}

export function drawArtText(ctx: CanvasRenderingContext2D, el: ArtTextElement, progress?: number): void {
  const fontSize = el.fontSize ?? 96;
  drawRichText(ctx, el.x, el.y, el.w, el.h, el.text, {
    fontSize,
    color: el.color ?? "#F59E0B",
    align: "center",
    progress,
    stroke: { color: el.stroke ?? "#111827", width: Math.max(2, fontSize * 0.09) },
  });
}

export function drawText(ctx: CanvasRenderingContext2D, el: TextElement, progress?: number): void {
  drawRichText(ctx, el.x, el.y, el.w, el.h, el.text, {
    fontSize: el.fontSize ?? 40,
    color: el.color ?? "#1F2937",
    align: el.align ?? "left",
    highlights: el.highlight,
    progress,
  });
}

export function drawInput(ctx: CanvasRenderingContext2D, el: InputElement): void {
  const fontSize = el.fontSize ?? 34;
  roundRect(ctx, el.x, el.y, el.w, el.h, 12);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = "#94A3B8";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.font = sansFont(fontSize, 500);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#111827";
  const padX = fontSize * 0.6;
  ctx.fillText(el.text, el.x + padX, el.y + el.h / 2 + 1);
  // 静态光标:不闪烁,保证逐帧导出确定性
  const textW = ctx.measureText(el.text).width;
  ctx.fillRect(el.x + padX + textW + 8, el.y + el.h * 0.28, 3, el.h * 0.44);
}

export function drawNote(ctx: CanvasRenderingContext2D, el: NoteElement, progress?: number): void {
  ctx.save();
  // 静态旋转由 drawElement 统一处理(便签缺省 -2)
  roundRect(ctx, el.x, el.y, el.w, el.h, 10);
  ctx.fillStyle = el.bg ?? "#FDE68A";
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.lineWidth = 2;
  ctx.stroke();
  drawRichText(ctx, el.x + 18, el.y + 14, el.w - 36, el.h - 28, el.text, {
    fontSize: el.fontSize ?? 30,
    color: "#78350F",
    align: "center",
    progress,
  });
  ctx.restore();
}

export function drawBadge(ctx: CanvasRenderingContext2D, el: BadgeElement): void {
  const fontSize = el.fontSize ?? 34;
  ctx.save();
  ctx.font = sansFont(fontSize, 600);
  const textW = ctx.measureText(el.text).width;
  const padX = fontSize * 0.7;
  const w = Math.max(el.w, textW + padX * 2);
  roundRect(ctx, el.x, el.y, w, el.h, el.h / 2);
  ctx.fillStyle = el.bg ?? "#1D4ED8";
  ctx.fill();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = el.color ?? "#FFFFFF";
  ctx.fillText(el.text, el.x + (w - textW) / 2, el.y + el.h / 2 + 1);
  ctx.restore();
}
