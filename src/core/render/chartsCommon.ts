import { roundRect, sansFont } from "./text";

/**
 * 图表公共部件:调色板 / 墨色 / 上限取整 / 标题 / 图例芯片。
 * 独立成文件是为了断开 charts.ts 与 chartsGroup.ts 的双向依赖(拆分图表按系列走不同文件)。
 */

export const CHART_PALETTE = ["#3B82F6", "#F59E0B", "#10B981", "#EF4444", "#8B5CF6", "#EC4899"];
export const INK = "#1F2937";
export const MUTED = "#64748B";

/** 数值上限取整放大:36 -> 40,170 -> 200,让柱顶/点不顶格 */
export function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * mag;
}

/** 图表标题:画在元素顶边,返回占用的高度(0 = 无标题) */
export function drawTitle(ctx: CanvasRenderingContext2D, el: { x: number; y: number; w: number; title?: string }, fontSize: number, sub?: string): number {
  if (!el.title) return 0;
  ctx.font = sansFont(fontSize, 700);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = INK;
  ctx.fillText(el.title, el.x, el.y + fontSize * 0.9, el.w);
  if (sub) {
    ctx.font = sansFont(fontSize * 0.56, 500);
    ctx.fillStyle = MUTED;
    ctx.fillText(sub, el.x, el.y + fontSize * 1.72, el.w);
    return fontSize * 2.5;
  }
  return fontSize * 1.9;
}

/** 图例芯片行:色块 + 名称,返回结束 x;折线图与分组柱图共用同一视觉 */
export function drawLegendChips(ctx: CanvasRenderingContext2D, entries: { label: string; color: string }[], x: number, y: number, fontSize: number): number {
  ctx.font = sansFont(fontSize * 0.64, 600);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  let lx = x;
  entries.forEach((e) => {
    ctx.fillStyle = e.color;
    roundRect(ctx, lx, y - fontSize * 0.21, fontSize * 0.42, fontSize * 0.42, fontSize * 0.1);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.fillText(e.label, lx + fontSize * 0.58, y);
    lx += fontSize * 0.58 + ctx.measureText(e.label).width + fontSize * 1.0;
  });
  return lx;
}
