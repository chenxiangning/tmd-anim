import type { ArrayCellsElement } from "../types";
import { roundRect, sansFont } from "./text";

/** 色块数组(视频里的 token/字节格):从 (x,y) 起按 perRow 折行,粉彩色板兜底。 */

/** 粉彩色板兜底,行内编辑浮层与属性面板共用同一套底色 */
export const PALETTE = ["#DBEAFE", "#DCFCE7", "#FEF9C3", "#FCE7F3", "#E0E7FF", "#CCFBF1"];

export function drawArrayCells(ctx: CanvasRenderingContext2D, el: ArrayCellsElement): void {
  const size = el.cellSize ?? 88;
  const gap = el.gap ?? 14;
  const perRow = Math.max(1, el.perRow ?? el.cells.length);
  const fontSize = el.fontSize ?? size * 0.5;
  ctx.save();
  ctx.font = sansFont(fontSize, 600);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  el.cells.forEach((cell, i) => {
    const cx = el.x + (i % perRow) * (size + gap);
    const cy = el.y + Math.floor(i / perRow) * (size + gap);
    roundRect(ctx, cx, cy, size, size, size * 0.18);
    ctx.fillStyle = el.colors?.[i] ?? PALETTE[i % PALETTE.length];
    ctx.fill();
    ctx.fillStyle = "#1E293B";
    ctx.fillText(cell, cx + size / 2, cy + size / 2 + 1);
  });
  ctx.restore();
}
