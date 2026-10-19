import type { BarChartElement, LineChartElement, PieChartElement } from "../types";
import { roundRect, sansFont } from "./text";

/**
 * 图表三件套:柱状 / 折线 / 饼图。数据驱动 + 确定性绘制;
 * 入场动画语义:柱 = 逐柱生长,线 = 沿路径 draw-on,饼 = 扫掠展开,progress 缺省 = 全显。
 */

export const CHART_PALETTE = ["#3B82F6", "#F59E0B", "#10B981", "#EF4444", "#8B5CF6", "#EC4899"];
const INK = "#1F2937";
const MUTED = "#64748B";

/** 数值上限取整放大:36 -> 40,170 -> 200,让柱顶/点不顶格 */
function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * mag;
}

function drawTitle(ctx: CanvasRenderingContext2D, el: { x: number; y: number; w: number; title?: string }, fontSize: number): number {
  if (!el.title) return 0;
  ctx.font = sansFont(fontSize, 700);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = INK;
  ctx.fillText(el.title, el.x, el.y + fontSize * 0.9, el.w);
  return fontSize * 1.9;
}

export function drawBarChart(ctx: CanvasRenderingContext2D, el: BarChartElement, progress?: number): void {
  const fontSize = el.fontSize ?? 28;
  const series = el.series ?? [];
  if (series.length === 0) return;
  const showValue = el.showValue !== false;
  const showAxis = el.axis !== false;
  const horizontal = el.horizontal === true;
  const pad = fontSize * 0.9;
  ctx.save();
  ctx.font = sansFont(fontSize * 0.72, 500);
  const titleH = drawTitle(ctx, el, fontSize);
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

export function drawLineChart(ctx: CanvasRenderingContext2D, el: LineChartElement, progress?: number): void {
  const fontSize = el.fontSize ?? 26;
  const series = (el.series ?? []).slice(0, 3);
  if (series.length === 0) return;
  const pad = fontSize * 0.9;
  const allPts = series.flatMap((s) => s.points);
  if (allPts.length === 0) return;
  const dataMin = Math.min(...allPts);
  const dataMax = Math.max(...allPts);
  const span = Math.max(dataMax - dataMin, 1e-6);
  const lo = el.min ?? Math.floor(dataMin - span * 0.12);
  const hi = Math.max(el.max ?? Math.ceil(dataMax + span * 0.12), lo + 1e-6);
  const n = Math.max(...series.map((s) => s.points.length));
  ctx.save();
  const titleH = drawTitle(ctx, el, fontSize);
  const legendH = series.length > 1 ? fontSize * 1.6 : 0;
  const area = { x: el.x + pad, y: el.y + titleH + legendH + pad * 0.4, w: el.w - pad * 2, h: el.h - titleH - legendH - pad * 1.6 };
  const X = (i: number) => area.x + (n <= 1 ? area.w / 2 : (i / (n - 1)) * area.w);
  const Y = (v: number) => area.y + area.h - ((v - lo) / (hi - lo)) * area.h;
  // 网格 + Y 轴刻度
  if (el.grid !== false) {
    ctx.font = sansFont(fontSize * 0.62, 500);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (let g = 0; g <= 4; g++) {
      const gv = lo + ((hi - lo) * g) / 4;
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
  }
  if (el.axis !== false) {
    ctx.strokeStyle = "#CBD5E1";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(area.x, area.y);
    ctx.lineTo(area.x, area.y + area.h);
    ctx.lineTo(area.x + area.w, area.y + area.h);
    ctx.stroke();
  }
  series.forEach((s, si) => {
    const pts = s.points.map((v, i) => ({ x: X(i), y: Y(v) }));
    if (pts.length === 0) return;
    const color = s.color ?? CHART_PALETTE[si % CHART_PALETTE.length];
    // draw-on:整体进度 p 映射到 (n-1) 段;边界段插值到中间点
    const segTotal = Math.max(pts.length - 1, 1);
    const f = progress === undefined ? segTotal : Math.min(segTotal, Math.max(0, progress * segTotal));
    const full = Math.floor(f);
    const part = f - full;
    const drawn: Array<{ x: number; y: number }> = pts.slice(0, full + 1);
    if (part > 0 && full + 1 < pts.length) {
      const a = pts[full];
      const b = pts[full + 1];
      drawn.push({ x: a.x + (b.x - a.x) * part, y: a.y + (b.y - a.y) * part });
    }
    if (drawn.length === 0) return;
    if (el.area === true && drawn.length > 1) {
      ctx.beginPath();
      ctx.moveTo(drawn[0].x, area.y + area.h);
      drawn.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.lineTo(drawn[drawn.length - 1].x, area.y + area.h);
      ctx.closePath();
      ctx.fillStyle = color + "33";
      ctx.fill();
    }
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = fontSize * 0.18;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (el.smooth === true && drawn.length > 2) {
      ctx.moveTo((drawn[0].x + drawn[1].x) / 2, (drawn[0].y + drawn[1].y) / 2);
      for (let i = 1; i < drawn.length - 1; i++) {
        const mx = (drawn[i].x + drawn[i + 1].x) / 2;
        const my = (drawn[i].y + drawn[i + 1].y) / 2;
        ctx.quadraticCurveTo(drawn[i].x, drawn[i].y, mx, my);
      }
      ctx.lineTo(drawn[drawn.length - 1].x, drawn[drawn.length - 1].y);
    } else {
      ctx.moveTo(drawn[0].x, drawn[0].y);
      drawn.forEach((p) => ctx.lineTo(p.x, p.y));
    }
    ctx.stroke();
    if (el.dot !== false) {
      ctx.fillStyle = color;
      drawn.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, fontSize * 0.16, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  });
  // 图例(多序列时):颜色芯片 + 名称,顶部一行
  if (series.length > 1) {
    ctx.font = sansFont(fontSize * 0.68, 600);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    let lx = area.x;
    const ly = el.y + titleH + fontSize * 0.8;
    series.forEach((s, si) => {
      ctx.fillStyle = s.color ?? CHART_PALETTE[si % CHART_PALETTE.length];
      roundRect(ctx, lx, ly - fontSize * 0.22, fontSize * 0.44, fontSize * 0.44, fontSize * 0.12);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.fillText(s.label, lx + fontSize * 0.6, ly);
      lx += fontSize * 0.6 + ctx.measureText(s.label).width + fontSize * 1.1;
    });
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
  const titleH = drawTitle(ctx, el, fontSize);
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
