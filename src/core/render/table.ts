import type { TableElement } from "../types";
import { roundRect, sansFont } from "./text";

/** 表格:深色表头 + 斑马纹行 + 细网格线,列宽均分,文本垂直居中。 */

export function drawTable(ctx: CanvasRenderingContext2D, el: TableElement, progress?: number): void {
  const fontSize = el.fontSize ?? 30;
  const cols = Math.max(1, el.header.length);
  const rows = el.rows.length;
  const colW = el.w / cols;
  const headerH = Math.min(el.h * 0.34, fontSize * 2.2);
  const rowH = rows > 0 ? (el.h - headerH) / rows : 0;

  ctx.save();
  roundRect(ctx, el.x, el.y, el.w, el.h, 14);
  ctx.clip();

  // 表头
  ctx.fillStyle = el.headerBg ?? "#1E293B";
  ctx.fillRect(el.x, el.y, el.w, headerH);
  ctx.font = sansFont(fontSize * 0.93, 600);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  el.header.forEach((cell, c) => {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(cell, el.x + c * colW + fontSize * 0.6, el.y + headerH / 2 + 1);
  });

  // 数据行:斑马纹
  el.rows.forEach((row, r) => {
    const ry = el.y + headerH + r * rowH;
    ctx.fillStyle = r % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
    ctx.fillRect(el.x, ry, el.w, rowH);
    ctx.font = sansFont(fontSize * 0.87, 500);
    row.slice(0, cols).forEach((cell, c) => {
      ctx.fillStyle = "#334155";
      ctx.fillText(cell, el.x + c * colW + fontSize * 0.6, ry + rowH / 2 + 1);
    });
  });

  // 网格线
  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1.5;
  for (let c = 1; c < cols; c++) {
    const gx = el.x + c * colW;
    ctx.beginPath();
    ctx.moveTo(gx, el.y);
    ctx.lineTo(gx, el.y + el.h);
    ctx.stroke();
  }
  for (let r = 0; r <= rows; r++) {
    const gy = el.y + headerH + r * rowH;
    ctx.beginPath();
    ctx.moveTo(el.x, gy);
    ctx.lineTo(el.x + el.w, gy);
    ctx.stroke();
  }
  ctx.restore();

  roundRect(ctx, el.x, el.y, el.w, el.h, 14);
  ctx.strokeStyle = "#CBD5E1";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  void progress;
}
