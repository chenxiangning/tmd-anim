import type { CodeDiffElement, CursorElement, FolderTreeElement } from "../types";
import { drawWindowDots } from "./code";
import { monoFont, roundRect, sansFont } from "./text";

/**
 * 演示三件套:鼠标光标 / mac 文件树 / 行级代码 diff。确定性绘制,纯 (project, t) 函数;
 * 入场动画:文件树与 diff = 逐行 stagger(progress 缺省全显),光标移动由 localT 驱动。
 */

const INK = "#1F2937";
const MUTED = "#64748B";
const BLUE = "#3B82F6";

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** 光标箭头多边形(以 tip 为原点,原始高约 22px) */
const ARROW: Array<[number, number]> = [
  [0, 0],
  [0, 18],
  [5, 13],
  [10, 22],
  [14, 20],
  [14, 8],
];

/** localT 时刻的 tip 位置:points 折线均分时间窗逐段线性插值,p>=1 停在末点 */
function cursorTipAt(el: CursorElement, localT: number): [number, number] {
  const pts = el.points;
  if (pts.length === 0) return [el.x, el.y];
  if (pts.length === 1) return pts[0];
  const p = clamp01((localT - el.anim.start) / Math.max(el.anim.duration, 1e-6));
  if (p >= 1) return pts[pts.length - 1];
  const seg = pts.length - 1;
  const f = p * seg;
  const i = Math.min(Math.floor(f), seg - 1);
  const q = clamp01(f - i);
  const [ax, ay] = pts[i];
  const [bx, by] = pts[i + 1];
  return [ax + (bx - ax) * q, ay + (by - ay) * q];
}

export function drawCursor(ctx: CanvasRenderingContext2D, el: CursorElement, localT: number): void {
  const size = Math.min(40, Math.max(16, el.h * 0.5));
  const s = size / 22;

  // 涟漪:click 后 0.5s 内以该时刻位置为圆心扩散
  for (const c of el.clicks ?? []) {
    const dt = localT - c;
    if (dt < 0 || dt > 0.5) continue;
    const [cx, cy] = cursorTipAt(el, c);
    ctx.save();
    ctx.globalAlpha = (1 - dt / 0.5) * 0.45;
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 6 + dt * 70, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const [tx, ty] = cursorTipAt(el, localT);
  const holding = el.hold !== undefined && localT >= el.hold[0] && localT <= el.hold[1];
  ctx.save();
  ctx.translate(tx, ty);
  if (holding) ctx.scale(0.9, 0.9);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  // 黑描边:同路径放大一层垫底
  ctx.save();
  ctx.scale(s * 1.14, s * 1.14);
  ctx.beginPath();
  ctx.moveTo(ARROW[0][0], ARROW[0][1]);
  for (let i = 1; i < ARROW.length; i++) ctx.lineTo(ARROW[i][0], ARROW[i][1]);
  ctx.closePath();
  ctx.fillStyle = "#111827";
  ctx.fill();
  ctx.restore();
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(ARROW[0][0], ARROW[0][1]);
  for (let i = 1; i < ARROW.length; i++) ctx.lineTo(ARROW[i][0], ARROW[i][1]);
  ctx.closePath();
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();
}

/** 小文件夹图标(填充 #FBBF24 简形):tab + 圆角主体 */
function drawFolderIcon(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = "#FBBF24";
  roundRect(ctx, x, y, w * 0.55, h * 0.5, h * 0.12);
  ctx.fill();
  roundRect(ctx, x, y + h * 0.2, w, h * 0.8, h * 0.14);
  ctx.fill();
}

/** 文档图标:白底 #CBD5E1 描边折角 */
function drawFileIcon(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const fold = Math.min(w, h) * 0.32;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w - fold, y);
  ctx.lineTo(x + w, y + fold);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = "#CBD5E1";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + w - fold, y);
  ctx.lineTo(x + w - fold, y + fold);
  ctx.lineTo(x + w, y + fold);
  ctx.stroke();
}

export function drawFolderTree(ctx: CanvasRenderingContext2D, el: FolderTreeElement, progress?: number): void {
  const fontSize = el.fontSize ?? 24;
  const lineH = fontSize * 1.7;
  const headerH = fontSize * 2;
  const pad = fontSize * 0.8;
  const n = el.items.length;
  const cardH = Math.max(el.h, headerH + n * lineH);

  ctx.save();
  roundRect(ctx, el.x, el.y, el.w, cardH, 14);
  ctx.clip();
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1.5;
  roundRect(ctx, el.x, el.y, el.w, cardH, 14);
  ctx.stroke();

  // 头部灰带:root 图标 + 名称(缺省 "project",空名也保留头部)
  ctx.fillStyle = "#F8FAFC";
  ctx.fillRect(el.x, el.y, el.w, headerH);
  ctx.strokeStyle = "#E2E8F0";
  ctx.beginPath();
  ctx.moveTo(el.x, el.y + headerH);
  ctx.lineTo(el.x + el.w, el.y + headerH);
  ctx.stroke();
  const iconS = fontSize * 1.05;
  drawFolderIcon(ctx, el.x + pad, el.y + (headerH - iconS * 0.8) / 2, iconS, iconS * 0.8);
  ctx.font = sansFont(fontSize * 0.72, 600);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = INK;
  ctx.fillText(el.root ?? "project", el.x + pad + iconS + fontSize * 0.4, el.y + headerH / 2);

  // 行:depth 首行缺省 0,其后缺省继承上一行;逐行 alpha stagger
  const depths: number[] = [];
  let prev = 0;
  el.items.forEach((item, i) => {
    prev = item.depth ?? (i === 0 ? 0 : prev);
    depths.push(prev);
  });
  el.items.forEach((item, i) => {
    const q = progress === undefined ? 1 : clamp01(progress * n - i);
    if (q <= 0) return;
    ctx.save();
    ctx.globalAlpha *= q;
    const rowY = el.y + headerH + i * lineH + lineH / 2;
    const iconX = el.x + pad + depths[i] * fontSize * 1.4;
    if ((item.icon ?? "file") === "dir") drawFolderIcon(ctx, iconX, rowY - iconS / 2, iconS, iconS * 0.8);
    else drawFileIcon(ctx, iconX, rowY - iconS / 2, iconS * 0.8, iconS);
    const textX = iconX + iconS + fontSize * 0.45;
    ctx.font = sansFont(fontSize * 0.72, 600);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = INK;
    ctx.fillText(item.name, textX, rowY);
    if (item.comment) {
      const nameW = ctx.measureText(item.name).width;
      ctx.font = sansFont(fontSize * 0.72, 500);
      ctx.fillStyle = MUTED;
      ctx.fillText("  // " + item.comment, textX + nameW, rowY);
    }
    ctx.restore();
  });
  ctx.restore();
}

interface DiffRow {
  tag: "ctx" | " " | "+" | "-";
  text: string;
}

export function drawCodeDiff(ctx: CanvasRenderingContext2D, el: CodeDiffElement, progress?: number): void {
  const fontSize = el.fontSize ?? 24;
  const lineH = fontSize * 1.6;
  const headerH = fontSize * 2.1;
  const padX = fontSize * 0.9;
  const rows: DiffRow[] = [];
  for (const hunk of el.hunks) {
    if (hunk.ctx !== undefined) rows.push({ tag: "ctx", text: hunk.ctx });
    for (const line of hunk.lines) rows.push({ tag: line.tag, text: line.text });
  }
  const total = rows.length;
  const light = el.dark === false;
  const lineColor = light ? "#334155" : "#94A3B8";

  ctx.save();
  roundRect(ctx, el.x, el.y, el.w, el.h, 16);
  ctx.clip();
  ctx.fillStyle = light ? "#FFFFFF" : "#0F172A";
  ctx.fill();

  // 标题栏:mac 三点 + 文件名(右侧, MUTED)
  const dotR = fontSize * 0.22;
  const dotY = el.y + headerH / 2;
  drawWindowDots(ctx, el.x + fontSize, dotY, dotR);
  if (el.filename) {
    ctx.font = sansFont(fontSize * 0.82, 500);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = MUTED;
    ctx.fillText(el.filename, el.x + el.w - padX, dotY);
  }
  ctx.strokeStyle = light ? "#E2E8F0" : "#1E293B";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(el.x, el.y + headerH);
  ctx.lineTo(el.x + el.w, el.y + headerH);
  ctx.stroke();

  // 行:增删改着色 + 逐行 stagger
  ctx.font = monoFont(fontSize);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  let ly = el.y + headerH + lineH * 0.7;
  rows.forEach((row, i) => {
    const q = progress === undefined ? 1 : clamp01(progress * total - i);
    if (q <= 0) {
      ly += lineH;
      return;
    }
    ctx.save();
    ctx.globalAlpha *= q;
    if (row.tag === "+") ctx.fillStyle = light ? "rgba(34,197,94,0.12)" : "rgba(34,197,94,0.14)";
    else if (row.tag === "-") ctx.fillStyle = light ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.14)";
    if (row.tag === "+" || row.tag === "-") ctx.fillRect(el.x, ly - lineH / 2, el.w, lineH);
    if (row.tag === "ctx") ctx.fillStyle = MUTED;
    else if (row.tag === "+") ctx.fillStyle = light ? "#16A34A" : "#4ADE80";
    else if (row.tag === "-") ctx.fillStyle = light ? "#DC2626" : "#F87171";
    else ctx.fillStyle = lineColor;
    ctx.fillText(row.tag === "ctx" || row.tag === " " ? row.text : row.tag + " " + row.text, el.x + padX, ly);
    ctx.restore();
    ly += lineH;
  });
  ctx.restore();
}
