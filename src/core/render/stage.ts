import type { GridBgElement, GroupPanelElement, LaneElement, SpotlightElement } from "../types";
import { roundRect, sansFont } from "./text";

/**
 * 舞台打底四件套:聚光暗角 / 网格背景 / 分组面板 / 泳道。
 * 全部是 (project, t) 纯函数,无动画语义;spotlight 用 evenodd 奇偶填充在暗色底板上挖孔。
 * 注:Node 测试环境无 Path2D,故暗角走默认路径(beginPath + 子路径)+ fill("evenodd"),与 Path2D 等价。
 */

const MUTED = "#64748B";
const LANE_COLORS = ["#F8FAFC", "#F1F5F9", "#EEF2FF", "#ECFEFF"];

/** 聚光灯:全屏暗角,只亮本元素几何区;孔 = 内切椭圆或圆角矩形(r=24) */
export function drawSpotlight(ctx: CanvasRenderingContext2D, el: SpotlightElement): void {
  const strength = el.strength ?? 0.65;
  ctx.save();
  ctx.fillStyle = `rgba(15,23,42,${strength})`;
  ctx.beginPath();
  // 外矩形与孔是同一条路径的两个子路径,evenodd 规则下孔自动挖空
  ctx.rect(-32000, -32000, 64000, 64000);
  if (el.shape === "ellipse") {
    ctx.ellipse(el.x + el.w / 2, el.y + el.h / 2, el.w / 2, el.h / 2, 0, 0, Math.PI * 2);
  } else {
    ctx.roundRect(el.x, el.y, el.w, el.h, 24);
  }
  ctx.fill("evenodd");
  ctx.restore();
}

/** 把 rgba 的 alpha 提到 0.6 作轴线加重色;非 rgba 入参原样返回 */
function deepenAxisColor(color: string): string {
  const m = /^(.*,)\s*[\d.]+\)$/.exec(color);
  return m ? `${m[1]} 0.6)` : color;
}

/** 网格背景:坐标纸细线或点阵,从区域边缘按 step 布置;axis 时过中心的横竖线加重 */
export function drawGridBg(ctx: CanvasRenderingContext2D, el: GridBgElement): void {
  const step = Math.max(el.step ?? 40, 12);
  const color = el.color ?? "rgba(148,163,184,0.35)";
  ctx.save();
  if (el.dot === true) {
    ctx.fillStyle = color;
    for (let gx = 0; gx <= el.w + 0.5; gx += step) {
      for (let gy = 0; gy <= el.h + 0.5; gy += step) {
        ctx.beginPath();
        ctx.arc(el.x + gx, el.y + gy, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = 0; gx <= el.w + 0.5; gx += step) {
      ctx.moveTo(el.x + gx, el.y);
      ctx.lineTo(el.x + gx, el.y + el.h);
    }
    for (let gy = 0; gy <= el.h + 0.5; gy += step) {
      ctx.moveTo(el.x, el.y + gy);
      ctx.lineTo(el.x + el.w, el.y + gy);
    }
    ctx.stroke();
  }
  if (el.axis === true) {
    ctx.strokeStyle = deepenAxisColor(color);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(el.x, el.y + el.h / 2);
    ctx.lineTo(el.x + el.w, el.y + el.h / 2);
    ctx.moveTo(el.x + el.w / 2, el.y);
    ctx.lineTo(el.x + el.w / 2, el.y + el.h);
    ctx.stroke();
  }
  ctx.restore();
}

/** 分组面板:圆角卡片 + 标题(骑跨上边框的胶囊 / 带副标题时改内嵌左上);dash = 弱分组的虚线边 */
export function drawGroupPanel(ctx: CanvasRenderingContext2D, el: GroupPanelElement): void {
  const radius = el.radius ?? 24;
  const accent = el.accent ?? "#3B82F6";
  ctx.save();
  roundRect(ctx, el.x, el.y, el.w, el.h, radius);
  ctx.fillStyle = el.fill ?? "rgba(255,255,255,0.72)";
  ctx.fill();
  ctx.strokeStyle = el.stroke ?? (el.dash === true ? accent : "#E2E8F0");
  ctx.lineWidth = 1.5;
  if (el.dash === true) {
    ctx.setLineDash([12, 8]);
    ctx.lineWidth = 2;
  }
  ctx.stroke();
  ctx.setLineDash([]);
  if (el.title && el.subtitle) {
    // 内嵌标题:主标题 accent 加深,副标题灰小字(参照学术图的面板头)
    const fontSize = 24;
    const pad = Math.max(20, radius * 0.9);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = sansFont(fontSize, 700);
    ctx.fillStyle = accent;
    ctx.fillText(el.title, el.x + pad, el.y + pad + fontSize * 0.5, el.w - pad * 2);
    ctx.font = sansFont(fontSize * 0.62, 500);
    ctx.fillStyle = MUTED;
    ctx.fillText(el.subtitle, el.x + pad, el.y + pad + fontSize * 1.7, el.w - pad * 2);
  } else if (el.title) {
    const fontSize = 22;
    const chipH = fontSize * 1.5;
    ctx.font = sansFont(fontSize, 600);
    ctx.textBaseline = "middle";
    const chipX = el.x + 28;
    const chipY = el.y - fontSize * 0.75;
    roundRect(ctx, chipX, chipY, ctx.measureText(el.title).width + fontSize * 1.2, chipH, fontSize * 0.75);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.textAlign = "left";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(el.title, chipX + fontSize * 0.6, chipY + chipH / 2 + 1);
  }
  ctx.restore();
}

/** 泳道标签:带内白底 pill(高 30,宽 = 文本宽 + 24);h 方向靠带内左上,v 方向靠带顶部居中 */
function drawLaneLabel(ctx: CanvasRenderingContext2D, text: string, px: number, py: number): void {
  ctx.font = sansFont(24, 500);
  const pw = ctx.measureText(text).width + 24;
  roundRect(ctx, px, py, pw, 30, 15);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = MUTED;
  ctx.fillText(text, px + 12, py + 16);
}

/** 泳道:2-4 条平行色带 + 可选标签;count 缺省取 labels 长度,fallback 2(normalize 已钳 2-4) */
export function drawLane(ctx: CanvasRenderingContext2D, el: LaneElement): void {
  const count = el.count ?? el.labels?.length ?? 2;
  const gutter = el.gutter ?? 6;
  const horizontal = el.direction !== "v";
  const band = (horizontal ? el.h - (count - 1) * gutter : el.w - (count - 1) * gutter) / count;
  ctx.save();
  for (let i = 0; i < count; i++) {
    const bx = horizontal ? el.x : el.x + i * (band + gutter);
    const by = horizontal ? el.y + i * (band + gutter) : el.y;
    const bw = horizontal ? el.w : band;
    const bh = horizontal ? band : el.h;
    ctx.fillStyle = LANE_COLORS[i % LANE_COLORS.length];
    ctx.fillRect(bx, by, bw, bh);
    ctx.font = sansFont(24, 500);
    const label = el.labels?.[i];
    if (label) {
      const px = horizontal ? bx + 10 : bx + (bw - (ctx.measureText(label).width + 24)) / 2;
      drawLaneLabel(ctx, label, px, by + 8);
    }
    if (i === count - 1) continue;
    // 带间分隔线:gutter 中点一条 dashed,更像泳道
    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    if (horizontal) {
      const gy = by + bh + gutter / 2;
      ctx.moveTo(el.x, gy);
      ctx.lineTo(el.x + el.w, gy);
    } else {
      const gx = bx + bw + gutter / 2;
      ctx.moveTo(gx, el.y);
      ctx.lineTo(gx, el.y + el.h);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}
