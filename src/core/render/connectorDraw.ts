import type { ConnectorElement, SceneElement } from "../types";
import { connectorRoute, strokeRoundedPolyline, type ConnectorRoute } from "./connectorRoute";
import { roundRect, sansFont } from "./text";

/** 连线绘制:draw 入场沿路径生长(dash 技巧),箭头与曲上标签胶囊在末端浮现;emphasis 数据流虚线滚动。 */

/** 路径近似总长:直角段按折线累加,三次/二次按采样累加;draw 生长的 dash 只需近似,p>=1 时无 dash 兜底补全 */
function routeLength(route: ConnectorRoute, x1: number, y1: number, x2: number, y2: number): number {
  let pts: Array<{ x: number; y: number }>;
  if (route.mode === "segments") {
    pts = route.points;
  } else if (route.mode === "cubic") {
    pts = [];
    const c1 = route.geo!.c1;
    const c2 = route.geo!.c2;
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const u = 1 - t;
      pts.push({
        x: u * u * u * x1 + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * x2,
        y: u * u * u * y1 + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * y2,
      });
    }
  } else {
    pts = [];
    const c = route.geo!.control;
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const u = 1 - t;
      pts.push({ x: u * u * x1 + 2 * u * t * c.x + t * t * x2, y: u * u * y1 + 2 * u * t * c.y + t * t * y2 });
    }
  }
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return len;
}

export function drawConnector(ctx: CanvasRenderingContext2D, el: ConnectorElement, elements: SceneElement[] = [], dashOffset?: number, progress?: number): void {
  const [x1, y1] = el.from;
  const [x2, y2] = el.to;
  const color = el.color ?? "#475569";
  const lineW = el.width ?? 5;
  const route = connectorRoute(el, elements);
  const mid = route.mid;
  // draw 入场:p<1 时线只画前 p 段,箭头/标签在末端(0.82+/0.88+)浮现;emphasis 数据流优先于生长 dash
  const p = progress == null ? 1 : Math.min(1, Math.max(0, progress));
  const baseAlpha = ctx.globalAlpha;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineW;
  ctx.lineCap = "round";
  // 强调数据流(emphasis.dashFlow):虚线滚动,速度由 dashOffset 变化率决定;静态虚线走 el.dash
  if (dashOffset !== undefined) {
    ctx.setLineDash([lineW * 2.6, lineW * 1.9]);
    ctx.lineDashOffset = dashOffset;
  } else if (p < 1) {
    ctx.setLineDash([Math.max(routeLength(route, x1, y1, x2, y2) * p, 0.01), 1e6]);
    ctx.lineDashOffset = 0;
  } else if (el.dash === true) {
    ctx.setLineDash([lineW * 2.4, lineW * 1.8]);
  }
  ctx.beginPath();
  if (route.mode === "segments") {
    strokeRoundedPolyline(ctx, route.points, { x: x2, y: y2 });
  } else if (route.mode === "cubic") {
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(route.geo!.c1.x, route.geo!.c1.y, route.geo!.c2.x, route.geo!.c2.y, x2, y2);
  } else {
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(route.geo!.control.x, route.geo!.control.y, x2, y2);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // arrow 缺省 true;false = 纯直线/曲线(直线库入口);draw 入场时 0.82-1 渐入
  if (el.arrow !== false) {
    const ang = route.endAngle;
    const size = lineW * 3.2;
    ctx.globalAlpha = baseAlpha * (p < 1 ? Math.min(1, Math.max(0, (p - 0.82) / 0.18)) : 1);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - size * Math.cos(ang - 0.45), y2 - size * Math.sin(ang - 0.45));
    ctx.lineTo(x2 - size * Math.cos(ang + 0.45), y2 - size * Math.sin(ang + 0.45));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = baseAlpha;
  }
  if (el.label) {
    // 标签挂曲线中点,draw 入场时比箭头再晚一拍(0.88-1 渐入)
    ctx.globalAlpha = baseAlpha * (p < 1 ? Math.min(1, Math.max(0, (p - 0.88) / 0.12)) : 1);
    const fontSize = 26;
    ctx.font = sansFont(fontSize, 600);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const tw = ctx.measureText(el.label).width;
    roundRect(ctx, mid.x - tw / 2 - 14, mid.y - 24, tw + 28, 48, 24);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.strokeStyle = "#CBD5E1";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#334155";
    ctx.fillText(el.label, mid.x - tw / 2, mid.y + 1);
    ctx.globalAlpha = baseAlpha;
  }
  ctx.restore();
}
