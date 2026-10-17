import type { BrowserElement, StepCardElement, TerminalElement } from "../types";
import type { AiChatElement, PhoneElement } from "../types";
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

/** 手机 mock:圆角机身(带屏框) + 顶部刘海胶囊 + 底部 home 条;屏幕区留给后绘制元素叠加内容 */
export function drawPhone(ctx: CanvasRenderingContext2D, el: PhoneElement): void {
  ctx.save();
  roundRect(ctx, el.x, el.y, el.w, el.h, Math.min(44, el.w * 0.14));
  ctx.fillStyle = el.frame ?? "#0F172A";
  ctx.fill();
  const bezel = Math.max(10, el.w * 0.035);
  const sx = el.x + bezel;
  const sy = el.y + bezel;
  const sw = el.w - bezel * 2;
  const sh = el.h - bezel * 2;
  roundRect(ctx, sx, sy, sw, sh, Math.min(32, sw * 0.1));
  ctx.fillStyle = el.body ?? "#FFFFFF";
  ctx.fill();
  // 刘海胶囊:屏幕顶缘居中
  const notchW = Math.min(sw * 0.34, 120);
  const notchH = Math.max(12, bezel * 0.9);
  roundRect(ctx, sx + (sw - notchW) / 2, sy + 8, notchW, notchH, notchH / 2);
  ctx.fillStyle = el.frame ?? "#0F172A";
  ctx.fill();
  // home 指示条:屏幕底缘居中
  const barW = sw * 0.36;
  roundRect(ctx, sx + (sw - barW) / 2, sy + sh - 12, barW, 5, 2.5);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = el.frame ?? "#0F172A";
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

const AI_ACCENT = "#7C3AED";

/** AI 对话卡:星标 + 标题头部;用户消息右对齐气泡,AI 回复占余下高度(支持高亮芯片) */
export function drawAiChat(ctx: CanvasRenderingContext2D, el: AiChatElement, progress?: number): void {
  const fontSize = el.fontSize ?? 26;
  const dark = el.dark === true;
  const bg = dark ? "#0F172A" : "#FFFFFF";
  const fg = dark ? "#E2E8F0" : "#1F2937";
  const sub = dark ? "#94A3B8" : "#64748B";
  ctx.save();
  roundRect(ctx, el.x, el.y, el.w, el.h, 16);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = dark ? "#334155" : "#E2E8F0";
  ctx.lineWidth = 2;
  ctx.stroke();
  // 头部:四角星徽标 + 标题
  const headerH = fontSize * 2.2;
  const cx = el.x + fontSize * 1.15;
  const cy = el.y + headerH / 2;
  const r = fontSize * 0.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx + r * 0.22, cy - r * 0.22, cx + r, cy);
  ctx.quadraticCurveTo(cx + r * 0.22, cy + r * 0.22, cx, cy + r);
  ctx.quadraticCurveTo(cx - r * 0.22, cy + r * 0.22, cx - r, cy);
  ctx.quadraticCurveTo(cx - r * 0.22, cy - r * 0.22, cx, cy - r);
  ctx.fillStyle = AI_ACCENT;
  ctx.fill();
  ctx.font = sansFont(fontSize * 0.9, 600);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = fg;
  ctx.fillText(el.title ?? "AI 助手", cx + r + fontSize * 0.55, cy + 1, el.w - (cx + r + fontSize * 0.55 - el.x) - 12);
  ctx.strokeStyle = dark ? "#334155" : "#E2E8F0";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(el.x, el.y + headerH);
  ctx.lineTo(el.x + el.w, el.y + headerH);
  ctx.stroke();
  // 消息区:prompt 右对齐气泡,reply 左对齐平铺
  const padX = fontSize * 0.9;
  const innerW = el.w - padX * 2;
  let cursorY = el.y + headerH + fontSize * 0.8;
  if (el.prompt) {
    const bubbleH = fontSize * 2.1;
    const bubbleW = Math.min(innerW * 0.78, padX + el.prompt.length * fontSize * 0.62);
    roundRect(ctx, el.x + el.w - padX - bubbleW, cursorY, bubbleW, bubbleH, fontSize * 0.7);
    ctx.fillStyle = dark ? "#4C1D95" : "#EDE9FE";
    ctx.fill();
    ctx.font = sansFont(fontSize * 0.85, 400);
    ctx.fillStyle = dark ? "#E9D5FF" : "#4C1D95";
    ctx.textAlign = "left";
    ctx.save();
    ctx.beginPath();
    ctx.rect(el.x + el.w - padX - bubbleW + fontSize * 0.5, cursorY, bubbleW - fontSize, bubbleH);
    ctx.clip();
    drawRichText(ctx, el.x + el.w - padX - bubbleW + fontSize * 0.5, cursorY + (bubbleH - fontSize * 1.5) / 2, bubbleW - fontSize, fontSize * 1.5, el.prompt, { fontSize: fontSize * 0.85, color: dark ? "#E9D5FF" : "#4C1D95", align: "left" });
    ctx.restore();
    cursorY += bubbleH + fontSize * 0.7;
  }
  if (el.reply) {
    drawRichText(ctx, el.x + padX, cursorY, innerW, el.y + el.h - cursorY - fontSize * 0.8, el.reply, {
      fontSize: fontSize * 0.85,
      color: fg,
      align: "left",
      progress,
    });
  } else if (!el.prompt) {
    ctx.font = sansFont(fontSize * 0.85, 400);
    ctx.fillStyle = sub;
    ctx.fillText("输入消息…", el.x + padX, cursorY + fontSize);
  }
  ctx.restore();
}
