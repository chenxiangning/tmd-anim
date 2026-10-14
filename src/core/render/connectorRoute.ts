import type { ConnectorElement, SceneElement } from "../types";
import { connectorGeometry, elementBounds, type Rect } from "./misc";
export type { Rect };

/**
 * 连线路由(语义对齐 Excalidraw):
 * - 出口方向 heading:绑定元素用「2 倍扩展包围盒 + 四搜索锥」判定(headingForPointFromElement),
 *   未绑定端用相对位移主轴(vectorToHeading);
 * - 直角路由 elbow:出口段 → 连接段 → 入口段的正交路径,渲染时拐角按半径 16 圆滑
 *   (generateElbowArrowShape 的 corner = min(radius, 半段长));
 * - smooth/straight 分别走自适应三次贝塞尔与直线。
 * 全部为 (from, to, 绑定元素) 的纯函数,预览与导出同一路径。
 */

export type Heading = [1, 0] | [0, 1] | [-1, 0] | [0, -1];

interface Pt {
  x: number;
  y: number;
}

/** 位移主轴的正交方向(Excalidraw vectorToHeading) */
export function vectorToHeading(vx: number, vy: number): Heading {
  const absX = Math.abs(vx);
  const absY = Math.abs(vy);
  if (vx > absY) return [1, 0];
  if (vx <= -absY) return [-1, 0];
  if (vy > absX) return [0, 1];
  return [0, -1];
}

/** 绑定元素出口方向:元素中心四象限主轴判定(Excalidraw headingForPointFromElement 的搜索锥等价于中心射线分象限,对任意距离成立) */
export function headingForPointFromElement(rect: Rect, p: Pt): Heading {
  return vectorToHeading(p.x - (rect.x + rect.w / 2), p.y - (rect.y + rect.h / 2));
}

export function connectorHeadings(el: ConnectorElement, elements: SceneElement[]): [Heading, Heading] {
  const boundsOf = (id: string | undefined): Rect | null => {
    if (!id) return null;
    const target = elements.find((e) => e.id === id);
    return target ? elementBounds(target) : null;
  };
  const [x1, y1] = el.from;
  const [x2, y2] = el.to;
  const bFrom = boundsOf(el.fromEl);
  const bTo = boundsOf(el.toEl);
  const h1: Heading = bFrom ? headingForPointFromElement(bFrom, { x: x2, y: y2 }) : vectorToHeading(x2 - x1, y2 - y1);
  const h2: Heading = bTo ? headingForPointFromElement(bTo, { x: x1, y: y1 }) : vectorToHeading(x1 - x2, y1 - y2);
  return [h1, h2];
}

const add = (p: Pt, h: Heading, d: number): Pt => ({ x: p.x + h[0] * d, y: p.y + h[1] * d });

/** 无障碍情形的正交路由:出口段 → 连接段 → 入口段(语义对齐 Excalidraw elbow 常规输出) */
export function routeElbow(from: Pt, to: Pt, h1: Heading, h2: Heading, stub = 40): Pt[] {
  const a = add(from, h1, stub);
  const b = add(to, h2, stub);
  const mids: Pt[] = [];
  if (h1[0] !== 0 && h2[1] !== 0) mids.push({ x: b.x, y: a.y });
  else if (h1[1] !== 0 && h2[0] !== 0) mids.push({ x: a.x, y: b.y });
  else if (h1[0] !== 0 && h2[0] !== 0) {
    const mx = (a.x + b.x) / 2;
    mids.push({ x: mx, y: a.y }, { x: mx, y: b.y });
  } else {
    const my = (a.y + b.y) / 2;
    mids.push({ x: a.x, y: my }, { x: b.x, y: my });
  }
  const raw = [from, a, ...mids, b, to];
  // 去重与去共线(Excalidraw DEDUP_TRESHOLD = 1)
  const out: Pt[] = [];
  for (const p of raw) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 1) out.push(p);
  }
  return out.filter((p, i) => {
    if (i === 0 || i === out.length - 1) return true;
    const prev = out[i - 1];
    const next = out[i + 1];
    return !((prev.x === p.x && p.x === next.x) || (prev.y === p.y && p.y === next.y));
  });
}

/** 折线路径(直角拐角圆滑:corner = min(radius, 半段长),语义对齐 generateElbowArrowShape);scale 供画布→屏幕换算 */
export function strokeRoundedPolyline(ctx: CanvasRenderingContext2D, pts: Pt[], to: Pt, scale = 1, radius = 16): void {
  ctx.moveTo(pts[0].x * scale, pts[0].y * scale);
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const next = pts[i + 1];
    const r = Math.min(radius, Math.hypot(cur.x - prev.x, cur.y - prev.y) / 2, Math.hypot(next.x - cur.x, next.y - cur.y) / 2) * scale;
    ctx.arcTo(cur.x * scale, cur.y * scale, next.x * scale, next.y * scale, r);
  }
  ctx.lineTo(to.x * scale, to.y * scale);
}

export type RouteMode = "smooth" | "elbow" | "straight";

export interface ConnectorRoute {
  /** segments = 折线(直角/直线);cubic/quad = 参数曲线(自适应/手动弓量) */
  mode: "segments" | "cubic" | "quad";
  /** segments 模式的折线顶点(含端点) */
  points: Pt[];
  geo?: ReturnType<typeof connectorGeometry>;
  /** 曲线中点或折线半程点(标签挂点) */
  mid: Pt;
  /** 终点切线角 */
  endAngle: number;
  /** 命中采样点(间距约 8px) */
  sample(step?: number): Pt[];
}

function polylineRoute(points: Pt[]): ConnectorRoute {
  let total = 0;
  const segs: Array<[Pt, Pt, number]> = [];
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    segs.push([points[i - 1], points[i], d]);
    total += d;
  }
  const at = (t: number): Pt => {
    let remain = total * t;
    for (const [a, b, d] of segs) {
      if (remain <= d || d === 0) {
        const r = d === 0 ? 0 : remain / d;
        return { x: a.x + (b.x - a.x) * r, y: a.y + (b.y - a.y) * r };
      }
      remain -= d;
    }
    return points[points.length - 1];
  };
  const last = segs[segs.length - 1];
  return {
    mode: "segments",
    points,
    mid: at(0.5),
    endAngle: Math.atan2(last[1].y - last[0].y, last[1].x - last[0].x),
    sample: (step = 8) => {
      const count = Math.max(8, Math.ceil(total / step));
      return Array.from({ length: count + 1 }, (_, i) => at(i / count));
    },
  };
}

function curveRoute(el: ConnectorElement): ConnectorRoute {
  const geo = connectorGeometry(el);
  const dist = Math.hypot(el.to[0] - el.from[0], el.to[1] - el.from[1]);
  return {
    mode: geo.auto ? "cubic" : "quad",
    points: [],
    geo,
    mid: geo.pointAt(0.5),
    endAngle: geo.endAngle(),
    sample: (step = 8) => {
      const count = Math.max(8, Math.ceil(dist / step));
      return Array.from({ length: count + 1 }, (_, i) => geo.pointAt(i / count));
    },
  };
}

/** 连线路由解析:route 缺省 = smooth(自适应三次);elbow = 直角正交;straight = 直线 */
export function connectorRoute(el: ConnectorElement, elements: SceneElement[]): ConnectorRoute {
  if (el.route === "straight") return polylineRoute([{ x: el.from[0], y: el.from[1] }, { x: el.to[0], y: el.to[1] }]);
  if (el.route === "elbow") {
    const [h1, h2] = connectorHeadings(el, elements);
    return polylineRoute(routeElbow({ x: el.from[0], y: el.from[1] }, { x: el.to[0], y: el.to[1] }, h1, h2));
  }
  return curveRoute(el);
}
