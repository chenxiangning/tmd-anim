import type { CardFlowElement, DocStackElement, SpecRowElement } from "../types";
import { monoFont, roundRect, sansFont } from "./text";

/**
 * 信息图小件:流程卡组 / 规格行卡 / 文档堆叠。
 * 学术信息图风:白底圆角 + 浅灰边 + accent 单色点缀;纯 (project,t) 绘制,未知字段回落缺省。
 */

const INK = "#1F2937";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";

/** 流程卡组:编号卡横排 + 卡间箭头 + active 高亮 + 底注;typewriter 入场 = 逐卡揭示 */
export function drawCardFlow(ctx: CanvasRenderingContext2D, el: CardFlowElement, progress?: number): void {
  const fontSize = el.fontSize ?? 26;
  const accent = el.accent ?? "#3B82F6";
  const items = el.items ?? [];
  if (items.length === 0) return;
  const noteH = el.note ? fontSize * 2.1 : 0;
  const gap = fontSize * 1.1;
  const cardW = (el.w - gap * (items.length - 1)) / items.length;
  const cardH = el.h - noteH;
  const reveal = progress === undefined ? items.length : Math.min(items.length, Math.max(0, progress * items.length));
  ctx.save();
  ctx.textBaseline = "middle";
  // 入场 alpha 已在 drawElement 乘进 globalAlpha,逐卡揭示只能在其基础上乘,不能覆盖
  const baseAlpha = ctx.globalAlpha;
  items.forEach((it, i) => {
    const partial = reveal - i;
    if (partial <= 0) return;
    const cx = el.x + i * (cardW + gap);
    const isActive = i === (el.active ?? -1);
    ctx.globalAlpha = baseAlpha * Math.min(1, partial * 2.5);
    roundRect(ctx, cx, el.y, cardW, cardH, 16);
    ctx.fillStyle = isActive ? accent + "0D" : "#FFFFFF";
    ctx.fill();
    ctx.strokeStyle = isActive ? accent : BORDER;
    ctx.lineWidth = isActive ? 3 : 2;
    ctx.stroke();
    const pad = fontSize * 0.8;
    ctx.textAlign = "left";
    if (it.num) {
      ctx.font = sansFont(fontSize * 0.56, 700);
      ctx.fillStyle = accent;
      ctx.fillText(it.num, cx + pad, el.y + pad + fontSize * 0.32);
    }
    ctx.font = sansFont(fontSize, 700);
    ctx.fillStyle = INK;
    ctx.fillText(it.title, cx + pad + (it.num ? fontSize * 1.1 : 0), el.y + pad + fontSize * 0.34, cardW - pad * 2 - (it.num ? fontSize * 1.1 : 0));
    let ty = el.y + pad + fontSize * 1.5;
    if (it.tags?.length) {
      let tx = cx + pad;
      ctx.font = sansFont(fontSize * 0.52, 600);
      for (const tag of it.tags) {
        const tw = ctx.measureText(tag).width + fontSize * 0.9;
        if (tx + tw > cx + cardW - pad * 0.5) break;
        roundRect(ctx, tx, ty - fontSize * 0.42, tw, fontSize * 0.84, fontSize * 0.42);
        ctx.fillStyle = accent + "14";
        ctx.fill();
        ctx.fillStyle = accent;
        ctx.fillText(tag, tx + fontSize * 0.45, ty);
        tx += tw + fontSize * 0.4;
      }
      ty += fontSize * 1.25;
    }
    if (it.desc) {
      ctx.font = sansFont(fontSize * 0.62, 400);
      ctx.fillStyle = MUTED;
      const lines = it.desc.split("\n");
      for (const line of lines) {
        ctx.fillText(line, cx + pad, ty, cardW - pad * 2);
        ty += fontSize * 0.95;
      }
    }
    if (isActive) {
      const barW = cardW * 0.42;
      roundRect(ctx, cx + (cardW - barW) / 2, el.y + cardH - fontSize * 0.42, barW, 4, 2);
      ctx.fillStyle = accent;
      ctx.fill();
    }
    ctx.globalAlpha = baseAlpha;
    // 卡间箭头:下一张卡已开始揭示才画
    if (i < items.length - 1 && reveal - (i + 1) > 0) {
      const ax = cx + cardW + gap * 0.12;
      const ay = el.y + cardH / 2;
      ctx.strokeStyle = accent + "73";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax + gap * 0.55, ay);
      ctx.stroke();
      ctx.fillStyle = accent + "73";
      ctx.beginPath();
      ctx.moveTo(ax + gap * 0.76, ay);
      ctx.lineTo(ax + gap * 0.5, ay - fontSize * 0.22);
      ctx.lineTo(ax + gap * 0.5, ay + fontSize * 0.22);
      ctx.closePath();
      ctx.fill();
    }
  });
  if (el.note) {
    ctx.font = sansFont(fontSize * 0.68, 600);
    ctx.textAlign = "center";
    ctx.fillStyle = accent;
    ctx.fillText(el.note, el.x + el.w / 2, el.y + el.h - fontSize * 0.8, el.w);
  }
  ctx.restore();
}

/** 规格行卡:编号芯片 + 标题 + mono 路径 + 右侧徽章药丸 */
export function drawSpecRow(ctx: CanvasRenderingContext2D, el: SpecRowElement): void {
  const fontSize = el.fontSize ?? 24;
  const accent = el.accent ?? "#3B82F6";
  const pad = fontSize * 0.75;
  ctx.save();
  roundRect(ctx, el.x, el.y, el.w, el.h, 14);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textBaseline = "middle";
  const chip = fontSize * 1.15;
  roundRect(ctx, el.x + pad, el.y + (el.h - chip) / 2, chip, chip, chip * 0.22);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.font = sansFont(fontSize * 0.5, 700);
  ctx.textAlign = "center";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(el.num ?? "C", el.x + pad + chip / 2, el.y + el.h / 2);
  ctx.textAlign = "left";
  ctx.font = sansFont(fontSize, 700);
  ctx.fillStyle = INK;
  const textX = el.x + pad + chip + pad * 0.6;
  ctx.fillText(el.title, textX, el.y + el.h / 2 - (el.path ? fontSize * 0.55 : 0), el.w - (textX - el.x) * 2 - fontSize * 3.5);
  if (el.path) {
    ctx.font = monoFont(fontSize * 0.58);
    ctx.fillStyle = MUTED;
    ctx.fillText(el.path, textX, el.y + el.h / 2 + fontSize * 0.6, el.w - (textX - el.x) * 2 - fontSize * 3.5);
  }
  if (el.badge) {
    ctx.font = sansFont(fontSize * 0.52, 600);
    const bw = ctx.measureText(el.badge).width + fontSize * 1.1;
    const bx = el.x + el.w - pad - bw;
    roundRect(ctx, bx, el.y + (el.h - fontSize * 1.05) / 2, bw, fontSize * 1.05, fontSize * 0.32);
    ctx.fillStyle = accent + "14";
    ctx.fill();
    ctx.textAlign = "center";
    ctx.fillStyle = accent;
    ctx.fillText(el.badge, bx + bw / 2, el.y + el.h / 2 + 1);
  }
  ctx.restore();
}

/** 文档堆叠:错位叠纸 + 右上折角,逐张出现(progress),下方标注 */
export function drawDocStack(ctx: CanvasRenderingContext2D, el: DocStackElement, progress?: number): void {
  const fontSize = el.fontSize ?? 24;
  const accent = el.accent ?? "#8B5CF6";
  const count = Math.min(Math.max(el.count ?? 3, 1), 5);
  const shown = progress === undefined ? count : Math.min(count, Math.max(0, Math.ceil(progress * count)));
  if (shown <= 0) return;
  const labelH = el.label ? fontSize * 1.9 : 0;
  const pw = Math.min(el.w * 0.42, el.h - labelH - fontSize * 0.4);
  const ph = pw * 1.3;
  const px = el.x + (el.w - pw) / 2 - (count - 1) * 6;
  const py = el.y + (el.h - labelH - ph) / 2;
  ctx.save();
  for (let i = 0; i < shown; i++) {
    const ox = px + i * 6;
    const oy = py - i * 7;
    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = i === shown - 1 ? accent : BORDER;
    ctx.lineWidth = i === shown - 1 ? 2.5 : 2;
    roundRect(ctx, ox, oy, pw, ph, 8);
    ctx.fill();
    ctx.stroke();
    // 右上折角
    const fold = pw * 0.22;
    ctx.beginPath();
    ctx.moveTo(ox + pw - fold, oy);
    ctx.lineTo(ox + pw, oy + fold);
    ctx.lineTo(ox + pw - fold, oy + fold);
    ctx.closePath();
    ctx.fillStyle = "#F1F5F9";
    ctx.fill();
    // 文本行示意
    ctx.fillStyle = "#E2E8F0";
    for (let l = 0; l < 3; l++) {
      roundRect(ctx, ox + pw * 0.16, oy + ph * (0.3 + l * 0.16), pw * (0.68 - l * 0.14), ph * 0.055, 3);
      ctx.fill();
    }
  }
  if (el.label) {
    ctx.font = sansFont(fontSize * 0.72, 600);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = INK;
    ctx.fillText(el.label, el.x + el.w / 2, el.y + el.h - labelH / 2, el.w);
  }
  ctx.restore();
}
