import type { BarChartElement } from "../types";
import { CHART_PALETTE, INK, MUTED, drawTitle, niceCeil } from "./charts";
import { roundRect, sansFont } from "./text";

/**
 * 分组柱状图:多系列按组对比(benchmark 图)。
 * groups[{label, values, deltas}] x groupSeries(系列名图例);竖向;逐柱生长入场。
 */

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

export function drawGroupedBar(ctx: CanvasRenderingContext2D, el: BarChartElement, progress?: number): void {
  const fontSize = el.fontSize ?? 28;
  const groups = (el.groups ?? []).filter((g) => g.values.length > 0);
  if (groups.length === 0) return;
  const seriesNames = el.groupSeries ?? groups[0].values.map((_, i) => `系列 ${i + 1}`);
  const showValue = el.showValue !== false;
  const showAxis = el.axis !== false;
  const pad = fontSize * 0.9;
  const legendH = seriesNames.length > 1 ? fontSize * 1.7 : 0;
  ctx.save();
  ctx.textBaseline = "middle";
  const titleH = drawTitle(ctx, el, fontSize);
  const area = { x: el.x + pad, y: el.y + titleH + legendH + pad * 0.5, w: el.w - pad * 2, h: el.h - titleH - legendH - pad * 1.8 };
  const dataMax = Math.max(...groups.flatMap((g) => g.values), 0);
  const cap = Math.max(el.max ?? niceCeil(dataMax), dataMax, 1);
  const Y = (v: number) => area.y + area.h - (v / cap) * area.h;
  // 网格 + Y 轴刻度
  if (showAxis) {
    ctx.font = sansFont(fontSize * 0.6, 500);
    ctx.textAlign = "left";
    for (let g = 0; g <= 4; g++) {
      const gv = (cap * g) / 4;
      const gy = Y(gv);
      ctx.strokeStyle = "rgba(148,163,184,0.28)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(area.x, gy);
      ctx.lineTo(area.x + area.w, gy);
      ctx.stroke();
      ctx.fillStyle = MUTED;
      ctx.fillText(String(Math.round(gv)), el.x + fontSize * 0.1, gy);
    }
    ctx.strokeStyle = "#CBD5E1";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(area.x, area.y);
    ctx.lineTo(area.x, area.y + area.h);
    ctx.lineTo(area.x + area.w, area.y + area.h);
    ctx.stroke();
  }
  const groupSlot = area.w / groups.length;
  const barW = Math.min((groupSlot * 0.62) / groups[0].values.length, fontSize * 1.5);
  const totalBars = groups.reduce((s, g) => s + g.values.length, 0);
  let barIndex = 0;
  groups.forEach((grp, gi) => {
    const groupW = barW * grp.values.length;
    const gx = area.x + groupSlot * gi + (groupSlot - groupW) / 2;
    grp.values.forEach((v, si) => {
      const color = CHART_PALETTE[si % CHART_PALETTE.length];
      const f = progress === undefined ? 1 : Math.min(1, Math.max(0, progress * totalBars - barIndex));
      barIndex++;
      const bh = (v / cap) * area.h * f;
      const bx = gx + si * barW;
      roundRect(ctx, bx, Y(v) + (area.h - bh), barW * 0.82, bh, Math.min(6, barW * 0.16));
      ctx.fillStyle = color;
      ctx.fill();
      if (showValue && f >= 1) {
        ctx.font = sansFont(fontSize * 0.56, 600);
        ctx.textAlign = "center";
        ctx.fillStyle = INK;
        ctx.fillText(String(v), bx + (barW * 0.82) / 2, Y(v) - fontSize * 0.5);
      }
      // 增益徽章:deltas[si] 非空时柱顶画药丸(accent 深蓝底白字)
      const delta = grp.deltas?.[si];
      if (delta && f >= 1) {
        ctx.font = sansFont(fontSize * 0.56, 700);
        const dw = ctx.measureText(delta).width + fontSize * 0.9;
        const dh = fontSize * 1.15;
        const dx = bx + (barW * 0.82 - dw) / 2;
        const dy = Y(v) - fontSize * 1.05 - dh;
        roundRect(ctx, dx, dy, dw, dh, dh / 2);
        ctx.fillStyle = "#1D4ED8";
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "center";
        ctx.fillText(delta, dx + dw / 2, dy + dh / 2 + 1);
      }
    });
    // 组标签
    ctx.font = sansFont(fontSize * 0.72, 600);
    ctx.textAlign = "center";
    ctx.fillStyle = INK;
    ctx.fillText(grp.label, area.x + groupSlot * gi + groupSlot / 2, area.y + area.h + fontSize * 0.85);
  });
  // 图例(多系列时):色块 + 名称
  if (seriesNames.length > 1) {
    drawLegendChips(ctx, seriesNames.map((name, si) => ({ label: name, color: CHART_PALETTE[si % CHART_PALETTE.length] })), area.x, el.y + titleH + fontSize * 0.8, fontSize);
  }
  ctx.restore();
}
