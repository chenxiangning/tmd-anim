import type { BrowserElement, StepCardElement, TerminalElement } from "../types";
import { drawWindowDots } from "./code";
import { drawRichText, monoFont, roundRect, sansFont } from "./text";

/** 卡片与窗口绘制:步骤卡片 / 终端窗口 / 浏览器窗口。 */

export function drawStepCard(ctx: CanvasRenderingContext2D, el: StepCardElement, progress?: number): void {
  const fontSize = el.fontSize ?? 34;
  const pad = fontSize * 0.9;
  const chip = fontSize * 1.7;
  ctx.save();
  roundRect(ctx, el.x, el.y, el.w, el.h, 20);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 2;
  ctx.stroke();
  const accent = el.accent ?? "#3B82F6";
  const chipX = el.x + pad;
  const chipY = el.y + pad;
  roundRect(ctx, chipX, chipY, chip, chip, chip * 0.28);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.font = sansFont(fontSize, 700);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(el.num ?? "1", chipX + chip / 2, chipY + chip / 2 + 1);
  if (el.title) {
    ctx.textAlign = "left";
    ctx.fillStyle = "#111827";
    ctx.font = sansFont(fontSize, 700);
    ctx.fillText(el.title, chipX + chip + fontSize * 0.55, chipY + chip / 2 + 1);
  }
  if (el.desc) {
    drawRichText(ctx, el.x + pad, chipY + chip + fontSize * 0.55, el.w - pad * 2, Math.max(el.h - pad - chip - fontSize * 0.55, fontSize * 1.5), el.desc, {
      fontSize: fontSize * 0.82,
      color: "#475569",
      align: "left",
      highlights: el.highlight,
      progress,
    });
  }
  ctx.restore();
}

export function drawTerminal(ctx: CanvasRenderingContext2D, el: TerminalElement, progress?: number): void {
  const fontSize = el.fontSize ?? 26;
  const dark = el.dark !== false;
  const lineH = fontSize * 1.6;
  const headerH = fontSize * 2.1;
  const padX = fontSize * 0.9;
  const bg = dark ? "#0F172A" : "#FFFFFF";
  ctx.save();
  roundRect(ctx, el.x, el.y, el.w, el.h, 16);
  ctx.clip();
  ctx.fillStyle = bg;
  ctx.fill();
  const dotR = fontSize * 0.22;
  drawWindowDots(ctx, el.x + fontSize, el.y + headerH / 2, dotR);
  ctx.font = sansFont(fontSize * 0.82, 500);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = dark ? "#94A3B8" : "#64748B";
  ctx.fillText(el.title ?? "zsh", el.x + fontSize + dotR * 3.4 * 3 + 12, el.y + headerH / 2);
  ctx.strokeStyle = dark ? "#1E293B" : "#E2E8F0";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(el.x, el.y + headerH);
  ctx.lineTo(el.x + el.w, el.y + headerH);
  ctx.stroke();

  // 逐行输出:$ 开头 = 命令行(提示符着强调色,命令用主文字色),其余为输出行(弱化色)
  ctx.font = monoFont(fontSize);
  const lines = el.code.split("\n");
  const shown = progress === undefined ? lines.length : Math.max(1, Math.ceil(progress * lines.length));
  const promptColor = dark ? "#34D399" : "#059669";
  let ly = el.y + headerH + lineH * 0.7;
  for (let i = 0; i < Math.min(shown, lines.length); i++) {
    const line = lines[i];
    if (line.startsWith("$")) {
      ctx.fillStyle = promptColor;
      ctx.fillText("$", el.x + padX, ly);
      const promptW = ctx.measureText("$").width;
      ctx.fillStyle = dark ? "#E2E8F0" : "#0F172A";
      ctx.fillText(line.slice(1), el.x + padX + promptW, ly);
    } else {
      ctx.fillStyle = dark ? "#94A3B8" : "#64748B";
      ctx.fillText(line, el.x + padX, ly);
    }
    ly += lineH;
  }
  ctx.restore();
}

export function drawBrowser(ctx: CanvasRenderingContext2D, el: BrowserElement): void {
  const fontSize = el.fontSize ?? 26;
  const headerH = fontSize * 2.2;
  ctx.save();
  roundRect(ctx, el.x, el.y, el.w, el.h, 16);
  ctx.fillStyle = el.body ?? "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 2;
  ctx.stroke();
  const dotR = fontSize * 0.22;
  const dotX = el.x + fontSize * 0.9;
  drawWindowDots(ctx, dotX, el.y + headerH / 2, dotR);
  const pillX = dotX + dotR * 3.4 * 3;
  const pillW = Math.max(el.w - (pillX - el.x) - fontSize * 0.9, fontSize * 4);
  const pillH = fontSize * 1.35;
  roundRect(ctx, pillX, el.y + (headerH - pillH) / 2, pillW, pillH, pillH / 2);
  ctx.fillStyle = "#F1F5F9";
  ctx.fill();
  if (el.url) {
    ctx.font = sansFont(fontSize * 0.82, 500);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#64748B";
    ctx.fillText(el.url, pillX + fontSize * 0.6, el.y + headerH / 2 + 1);
  }
  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(el.x, el.y + headerH);
  ctx.lineTo(el.x + el.w, el.y + headerH);
  ctx.stroke();
  ctx.restore();
}
