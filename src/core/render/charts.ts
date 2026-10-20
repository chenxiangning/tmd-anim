import type { BarChartElement, PieChartElement } from "../types";
import { roundRect, sansFont } from "./text";
import { CHART_PALETTE, INK, MUTED, drawTitle, niceCeil } from "./chartsCommon";
import { drawGroupedBar } from "./chartsGroup";

// 折线图在 chartsLine.ts(独立文件守 300 行铁则),此处统一出口,调用方只认 charts
export { drawLineChart } from "./chartsLine";

/**
 * 图表三件套中的柱状 / 饼图(折线在 chartsLine.ts)。数据驱动 + 确定性绘制;
 * 入场动画语义:柱 = 逐柱生长,线 = 沿路径 draw-on,饼 = 扫掠展开,progress 缺省 = 全显。
 * 公共部件(调色板/标题/图例/上限取整)在 chartsCommon.ts,避免与 chartsGroup.ts 双向引用。
 */

export function drawBarChart(ctx: CanvasRenderingContext2D, el: BarChartElement, progress?: number): void {
  // 分组模式(benchmark 图)走专用渲染;缺省单系列走本文件路径
  if (el.groups?.length) {
    drawGroupedBar(ctx, el, progress);
    return;
  }
  const fontSize = el.fontSize ?? 28;
  const series = el.series ?? [];
  if (series.length === 0) return;
  const showValue = el.showValue !== false;
  const showAxis = el.axis !== false;
  const horizontal = el.horizontal === true;
  const pad = fontSize * 0.9;
  ctx.save();
  ctx.font = sansFont(fontSize * 0.72, 500);
  const titleH = drawTitle(ctx, el, fontSize, el.subtitle);
  const area = { x: el.x + pad, y: el.y + titleH + pad * 0.5, w: el.w - pad * 2, h: el.h - titleH - pad * 1.5 };
  const dataMax = Math.max(...series.map((s) => s.value), 0);
  const cap = Math.max(el.max ?? niceCeil(dataMax), dataMax, 1);
  const n = series.length;
  const slot = (horizontal ? area.h : area.w) / n;
  const barLong = horizontal ? area.w : area.h;
  ctx.textBaseline = "middle";
  series.forEach((s, i) => {
    // 逐柱生长:第 i 柱的窗口 = [i/n, (i+1)/n] 进度切片
    const q = progress === undefined ? 1 : Math.min(1, Math.max(0, progress * n - i));
    if (q <= 0) return;
    const e = 1 - Math.pow(1 - q, 3);
    const len = barLong * Math.min(1, Math.max(0, s.value / cap)) * e;
    const thick = slot * 0.56;
    const color = s.color ?? CHART_PALETTE[i % CHART_PALETTE.length];
    ctx.fillStyle = color;
    let labelX: number;
    let labelY: number;
    if (horizontal) {
      const by = area.y + i * slot + (slot - thick) / 2;
      roundRect(ctx, area.x, by, Math.max(len, 2), thick, thick / 2);
      ctx.fill();
      ctx.textAlign = "right";
      ctx.fillStyle = MUTED;
      ctx.fillText(s.label, area.x - fontSize * 0.4, by + thick / 2);
      labelX = area.x + len + fontSize * 0.35;
      labelY = by + thick / 2;
    } else {
      const bx = area.x + i * slot + (slot - thick) / 2;
      const by = area.y + area.h - len;
      roundRect(ctx, bx, by, thick, Math.max(len, 2), thick * 0.18);
      ctx.fill();
      ctx.textAlign = "center";
      ctx.fillStyle = MUTED;
      ctx.fillText(s.label, bx + thick / 2, area.y + area.h + fontSize * 0.75, slot);
      labelX = bx + thick / 2;
      labelY = by - fontSize * 0.6;
    }
    if (showValue) {
      ctx.textAlign = horizontal ? "left" : "center";
      ctx.fillStyle = INK;
      ctx.font = sansFont(fontSize * 0.72, 700);
      ctx.fillText(String(s.value), labelX, labelY);
      ctx.font = sansFont(fontSize * 0.72, 500);
    }
  });
  if (showAxis) {
    ctx.strokeStyle = "#CBD5E1";
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (horizontal) {
      ctx.moveTo(area.x, area.y);
      ctx.lineTo(area.x, area.y + area.h);
    } else {
      ctx.moveTo(area.x, area.y + area.h);
      ctx.lineTo(area.x + area.w, area.y + area.h);
    }
    ctx.stroke();
  }
  ctx.restore();
}


export function drawPieChart(ctx: CanvasRenderingContext2D, el: PieChartElement, progress?: number): void {
  const fontSize = el.fontSize ?? 26;
  const slices = (el.slices ?? []).filter((s) => s.value > 0);
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return;
  const legend = el.legend ?? "right";
  const pad = fontSize * 0.9;
  ctx.save();
  const titleH = drawTitle(ctx, el, fontSize, el.subtitle);
  const legendW = legend === "right" ? el.w * 0.34 : 0;
  const legendH = legend === "bottom" ? fontSize * 1.7 : 0;
  const cx = el.x + (el.w - legendW) / 2;
  const cy = el.y + titleH + (el.h - titleH - legendH) / 2 + pad * 0.2;
  const r = Math.max(Math.min(el.w - legendW, el.h - titleH - legendH) / 2 - pad, fontSize);
  const start = ((el.startAngle ?? -90) * Math.PI) / 180;
  const sweep = (progress ?? 1) * Math.PI * 2;
  let acc = 0;
  slices.forEach((s, i) => {
    const a0 = start + (acc / total) * sweep;
    const a1 = start + ((acc + s.value) / total) * sweep;
    acc += s.value;
    if (a1 - a0 <= 0) return;
    const color = s.color ?? CHART_PALETTE[i % CHART_PALETTE.length];
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a1);
    if (el.donut === true) ctx.arc(cx, cy, r * 0.55, a1, a0, true);
    else ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2.5;
    ctx.stroke();
  });
  if (el.donut === true) {
    ctx.font = sansFont(fontSize * 0.9, 700);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = INK;
    ctx.fillText(String(Math.round(total)), cx, cy);
  }
  // 图例:色块 + 名称 + 百分比
  ctx.font = sansFont(fontSize * 0.68, 500);
  ctx.textBaseline = "middle";
  const drawLegend = (lx: number, ly: number, s: { label: string; value: number; color?: string }, i: number) => {
    ctx.fillStyle = s.color ?? CHART_PALETTE[i % CHART_PALETTE.length];
    roundRect(ctx, lx, ly - fontSize * 0.22, fontSize * 0.44, fontSize * 0.44, fontSize * 0.12);
    ctx.fill();
    ctx.textAlign = "left";
    ctx.fillStyle = INK;
    const pct = `${Math.round((s.value / total) * 100)}%`;
    ctx.fillText(`${s.label}  ${pct}`, lx + fontSize * 0.62, ly, legend === "right" ? legendW - fontSize : el.w);
  };
  if (legend === "right") {
    slices.forEach((s, i) => drawLegend(el.x + el.w - legendW + fontSize * 0.2, el.y + titleH + pad + i * fontSize * 1.35, s, i));
  } else if (legend === "bottom") {
    const totalW = slices.reduce((sum, s) => sum + ctx.measureText(s.label).width + fontSize * 2.4, 0);
    let lx = el.x + (el.w - Math.min(totalW, el.w)) / 2;
    const ly = el.y + el.h - fontSize * 0.9;
    slices.forEach((s, i) => {
      drawLegend(lx, ly, s, i);
      lx += ctx.measureText(s.label).width + fontSize * 2.4;
    });
  }
  ctx.restore();
}
