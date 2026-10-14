import type { SceneElement } from "../core/types";
import type { Rect } from "../core/render/misc";
import { connectorRoute, strokeRoundedPolyline } from "../core/render/connectorRoute";
import { handlePoints, type Guides, type SnapPoint, type ViewTransform } from "./stageOverlay";

/** 画布覆盖层绘制:对齐参考线 / 框选虚线框 / 吸附绿圈 / 选中框与手柄(屏幕空间)。 */

/** 编辑辅助层:对齐参考线 / 端点吸附绿圈 / 框选虚线框(屏幕空间绘制) */
export function drawAssistOverlay(
  ctx: CanvasRenderingContext2D,
  view: ViewTransform,
  canvasW: number,
  canvasH: number,
  guides: Guides,
  snapDot: SnapPoint | null,
  marquee: Rect | null,
): void {
  const { scale, ox, oy } = view;
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  if (guides.x !== null || guides.y !== null) {
    ctx.strokeStyle = "#EC4899";
    ctx.lineWidth = 1;
    if (guides.x !== null) line(ox + guides.x * scale, 0, ox + guides.x * scale, canvasH);
    if (guides.y !== null) line(0, oy + guides.y * scale, canvasW, oy + guides.y * scale);
  }
  if (marquee) {
    ctx.setLineDash([4, 3]);
    ctx.fillStyle = "rgba(236, 72, 153, 0.06)";
    ctx.strokeStyle = "#EC4899";
    ctx.lineWidth = 1;
    const mx = ox + marquee.x * scale;
    const my = oy + marquee.y * scale;
    ctx.fillRect(mx, my, marquee.w * scale, marquee.h * scale);
    ctx.strokeRect(mx, my, marquee.w * scale, marquee.h * scale);
    ctx.setLineDash([]);
  }
  if (snapDot) {
    ctx.strokeStyle = "#10B981";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ox + snapDot.x * scale, oy + snapDot.y * scale, 9, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function endpointDot(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.stroke();
}

/** 覆盖层绘制:选中框 + 手柄(连线为端点圆点与曲线控制点);多选时仅画框,单一选中才画手柄 */
export function drawSelectionOverlay(ctx: CanvasRenderingContext2D, el: SceneElement, view: ViewTransform, withHandles = true, elements: SceneElement[] = []): void {
  const { scale, ox, oy } = view;
  ctx.strokeStyle = "#2563EB";
  ctx.lineWidth = 1.5;
  if (el.kind === "connector") {
    const route = connectorRoute(el, elements);
    const a = { x: ox + el.from[0] * scale, y: oy + el.from[1] * scale };
    const b = { x: ox + el.to[0] * scale, y: oy + el.to[1] * scale };
    const c = { x: ox + route.mid.x * scale, y: oy + route.mid.y * scale };
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    if (route.mode === "segments") {
      strokeRoundedPolyline(ctx, route.points, { x: el.to[0], y: el.to[1] }, scale);
    } else if (route.mode === "cubic") {
      ctx.bezierCurveTo(
        ox + route.geo!.c1.x * scale,
        oy + route.geo!.c1.y * scale,
        ox + route.geo!.c2.x * scale,
        oy + route.geo!.c2.y * scale,
        b.x,
        b.y,
      );
    } else ctx.quadraticCurveTo(ox + route.geo!.control.x * scale, oy + route.geo!.control.y * scale, b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    if (!withHandles) return;
    endpointDot(ctx, a.x, a.y);
    endpointDot(ctx, b.x, b.y);
    // 曲线中点手柄:琥珀色方块
    ctx.fillStyle = "#F59E0B";
    ctx.strokeStyle = "#B45309";
    ctx.beginPath();
    ctx.rect(c.x - 5, c.y - 5, 10, 10);
    ctx.fill();
    ctx.stroke();
    return;
  }
  const x = ox + el.x * scale - 3;
  const y = oy + el.y * scale - 3;
  const w = el.w * scale + 6;
  const h = el.h * scale + 6;
  ctx.setLineDash([5, 4]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
  if (!withHandles) return;
  for (const hp of handlePoints(el, view)) {
    ctx.beginPath();
    ctx.rect(hp.at.x - 5, hp.at.y - 5, 10, 10);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.stroke();
  }
}
