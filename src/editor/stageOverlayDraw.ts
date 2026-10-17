import type { SceneElement } from "../core/types";
import type { Rect } from "../core/render/misc";
import { connectorRoute, strokeRoundedPolyline } from "../core/render/connectorRoute";
import { elementRotate } from "./hitTest";
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
  // 旋转元素(便签)选中框跟随旋转;手柄锚点已在 handlePoints 内旋转
  ctx.setLineDash([5, 4]);
  strokeRotatedBox(ctx, view, el);
  ctx.setLineDash([]);
  if (!withHandles) return;
  const pts = handlePoints(el, view);
  for (const hp of pts) {
    if (hp.name === "rot") continue;
    ctx.beginPath();
    ctx.rect(hp.at.x - 5, hp.at.y - 5, 10, 10);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.stroke();
  }
  // 旋转手柄:顶中点向外的连杆 + 蓝圆点(锚点已随元素旋转)
  const nAt = pts.find((p) => p.name === "n")?.at;
  const rotAt = pts.find((p) => p.name === "rot")?.at;
  if (nAt && rotAt) {
    ctx.beginPath();
    ctx.moveTo(nAt.x, nAt.y);
    ctx.lineTo(rotAt.x, rotAt.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(rotAt.x, rotAt.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#2563EB";
    ctx.fill();
    ctx.stroke();
  }
}

/** 按元素几何描外扩 3px 的包围框(虚线/线宽/颜色由调用方预设),旋转元素绕中心旋转后描 */
function strokeRotatedBox(ctx: CanvasRenderingContext2D, view: ViewTransform, el: SceneElement): void {
  const { scale, ox, oy } = view;
  const x = ox + el.x * scale - 3;
  const y = oy + el.y * scale - 3;
  const w = el.w * scale + 6;
  const h = el.h * scale + 6;
  const deg = elementRotate(el);
  if (deg === 0) {
    ctx.strokeRect(x, y, w, h);
    return;
  }
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}

/** 悬停高亮:未选中元素的细实线轮廓;连线不描(细线靠光标提示),数组格描占位框与选中框行为一致 */
export function drawHoverOverlay(ctx: CanvasRenderingContext2D, el: SceneElement, view: ViewTransform): void {
  if (el.kind === "connector") return;
  ctx.strokeStyle = "rgba(37, 99, 235, 0.45)";
  ctx.lineWidth = 1.5;
  strokeRotatedBox(ctx, view, el);
}
