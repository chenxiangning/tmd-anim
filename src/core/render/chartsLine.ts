import type { LineChartElement } from "../types";
import { sansFont } from "./text";
import { CHART_PALETTE, MUTED, drawLegendChips, drawTitle } from "./chartsCommon";

/**
 * 折线图:沿路径 draw-on 入场(边界段插值到中间点),smooth = 穿过数据点的平滑曲线,
 * endLabels = 期刊风线尾标注(替代顶部图例)。从 charts.ts 拆出以守住单文件 300 行铁则。
 */

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
  const titleH = drawTitle(ctx, el, fontSize, el.subtitle);
  const legendH = series.length > 1 && el.endLabels !== true ? fontSize * 1.6 : 0;
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
    // 系列虚线:对照系列的视觉语言(实线 = 主角,虚线 = 基线)
    if (s.dash === true) ctx.setLineDash([fontSize * 0.55, fontSize * 0.45]);
    if (el.smooth === true && drawn.length > 2) {
      // Catmull-Rom 转三次贝塞尔:曲线必须穿过每个数据点,否则数据点圆点会飘在线外。
      // 端点用重复点夹取(切角减半),让首尾段不至于甩出去。
      ctx.moveTo(drawn[0].x, drawn[0].y);
      const at = (i: number): { x: number; y: number } =>
        drawn[Math.min(drawn.length - 1, Math.max(0, i))];
      for (let i = 0; i < drawn.length - 1; i++) {
        const p1 = at(i);
        const p2 = at(i + 1);
        const p0 = at(i - 1);
        const p3 = at(i + 2);
        ctx.bezierCurveTo(
          p1.x + (p2.x - p0.x) / 6,
          p1.y + (p2.y - p0.y) / 6,
          p2.x - (p3.x - p1.x) / 6,
          p2.y - (p3.y - p1.y) / 6,
          p2.x,
          p2.y,
        );
      }
    } else {
      ctx.moveTo(drawn[0].x, drawn[0].y);
      drawn.forEach((p) => ctx.lineTo(p.x, p.y));
    }
    ctx.stroke();
    ctx.setLineDash([]);
    if (el.dot !== false && s.dot !== false) {
      // 空心点用于虚线系列:白底 + 同色描边,弱化到背景层
      const hollow = s.dash === true;
      drawn.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, fontSize * 0.16, 0, Math.PI * 2);
        if (hollow) {
          ctx.fillStyle = "#FFFFFF";
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = fontSize * 0.07;
          ctx.stroke();
        } else {
          ctx.fillStyle = color;
          ctx.fill();
        }
      });
    }
    // 线尾标签 + 末点光晕:draw-on 完成后才出现(期刊风:系列名直接标在线尾,替代图例)
    if (el.endLabels === true && (progress === undefined || f >= segTotal)) {
      const last = drawn[drawn.length - 1];
      ctx.beginPath();
      ctx.arc(last.x, last.y, fontSize * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = color + "2E";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(last.x, last.y, fontSize * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.font = sansFont(fontSize * 0.66, 700);
      ctx.textAlign = "left";
      ctx.fillStyle = color;
      // 不限宽:末点贴元素右缘,剩余宽为负会让 fillText 整段不渲染;溢出元素框由画布边界自然裁
      ctx.fillText(s.label, last.x + fontSize * 0.75, last.y);
    }
  });
  // 图例(多序列时):颜色芯片 + 名称,顶部一行;endLabels 模式由线尾标注替代
  if (series.length > 1 && el.endLabels !== true) {
    drawLegendChips(ctx, series.map((s, si) => ({ label: s.label, color: s.color ?? CHART_PALETTE[si % CHART_PALETTE.length] })), area.x, el.y + titleH + fontSize * 0.8, fontSize);
  }
  ctx.restore();
}
