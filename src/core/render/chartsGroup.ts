import type { BarChartElement } from "../types";
import { CHART_PALETTE, INK, MUTED, drawLegendChips, drawTitle, niceCeil } from "./chartsCommon";
import { roundRect, sansFont } from "./text";

/**
 * 分组柱状图:多系列按组对比(benchmark 图)。
 * groups[{label, values, deltas}] x groupSeries(系列名图例);竖向;逐柱生长入场。
 */

export function drawGroupedBar(ctx: CanvasRenderingContext2D, el: BarChartElement, progress?: number): void {
  const fontSize = el.fontSize ?? 28;
  // 渲染层再兜一层:normalize 已结构化 groups,但节流预览可能拿到半成品数据,读 undefined.length 会崩整帧
  const groups = (el.groups ?? [])
    .filter((g) => g && Array.isArray(g.values) && g.values.length > 0)
    .map((g) => ({ ...g, values: g.values.map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0)) }));
  if (groups.length === 0) return;
  const seriesNames = el.groupSeries ?? groups[0].values.map((_, i) => `系列 ${i + 1}`);
  const showValue = el.showValue !== false;
  const showAxis = el.axis !== false;
  const pad = fontSize * 0.9;
  const legendH = seriesNames.length > 1 ? fontSize * 1.7 : 0;
  ctx.save();
  ctx.textBaseline = "middle";
  const titleH = drawTitle(ctx, el, fontSize, el.subtitle);
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
  // 系列宽度按「组内最多柱数」算,组间柱数不一致时不会溢出组槽位
  const seriesCount = Math.max(...groups.map((g) => g.values.length), 1);
  const barW = Math.min((groupSlot * 0.62) / seriesCount, fontSize * 2.6);
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
      // 柱顶 = 基线 - 当前高度(生长动画从基线往上长);Y(v) 已含一次高度,不能再叠加
      roundRect(ctx, bx, area.y + area.h - bh, barW * 0.82, bh, Math.min(6, barW * 0.16));
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
