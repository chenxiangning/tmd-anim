import type { ConnectorElement, SceneElement } from "../core/types";
import { nearestBorderPoint } from "../core/render/misc";
import { connectorRoute } from "../core/render/connectorRoute";
import { elementRects, elementRotate, rotatePoint } from "./hitTest";

/**
 * 画布覆盖层的纯逻辑:手柄位置、手柄命中、手势 -> 元素补丁。
 * 连线元素用「端点圆点 + 曲线控制点」手柄,其余元素用 8 向缩放手柄。
 * 绘制部分(drawAssistOverlay/drawSelectionOverlay)在 stageOverlayDraw.ts。
 */

export { drawAssistOverlay, drawHoverOverlay, drawSelectionOverlay } from "./stageOverlayDraw";
export type HandleName = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "rot";
export const HANDLES: ReadonlyArray<Exclude<HandleName, "rot">> = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

/** 手柄 -> 悬停/拖拽光标(旋转手柄为 grab) */
export const HANDLE_CURSORS: Record<HandleName, string> = {
  nw: "nwse-resize", n: "ns-resize", ne: "nesw-resize", e: "ew-resize",
  se: "nwse-resize", s: "ns-resize", sw: "nesw-resize", w: "ew-resize", rot: "grab",
};

export interface ViewTransform {
  scale: number;
  ox: number;
  oy: number;
}

export interface Guides {
  x: number | null;
  y: number | null;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export type GestureMode = "move" | "resize" | "endpoint" | "curve" | "rotate";

export function handlePoints(el: SceneElement, view: ViewTransform, elements: SceneElement[] = []): Array<{ name: HandleName; at: ScreenPoint }> {
  const { scale, ox, oy } = view;
  const S = (lx: number, ly: number): ScreenPoint => ({ x: ox + lx * scale, y: oy + ly * scale });
  if (el.kind === "connector") {
    const route = connectorRoute(el, elements);
    // 折线路由(直角/避让重排)不吃 curve,隐藏曲线手柄,避免拖了没反应
    const out: Array<{ name: HandleName; at: ScreenPoint }> = [
      { name: "nw", at: S(el.from[0], el.from[1]) },
      { name: "se", at: S(el.to[0], el.to[1]) },
    ];
    if (route.mode !== "segments") out.push({ name: "n", at: S(route.mid.x, route.mid.y) });
    return out;
  }
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  const map: Record<Exclude<HandleName, "rot">, [number, number]> = {
    nw: [el.x, el.y], n: [cx, el.y], ne: [el.x + el.w, el.y], e: [el.x + el.w, cy],
    se: [el.x + el.w, el.y + el.h], s: [cx, el.y + el.h], sw: [el.x, el.y + el.h], w: [el.x, cy],
  };
  // 旋转元素手柄锚点跟随旋转,保证手柄落在视觉框角上;另加一个法向外移的旋转手柄
  const deg = elementRotate(el);
  const out: Array<{ name: HandleName; at: ScreenPoint }> = HANDLES.map((name) => {
    const [ax, ay] = map[name];
    const p = deg === 0 ? { x: ax, y: ay } : rotatePoint(ax, ay, cx, cy, deg);
    return { name, at: S(p.x, p.y) };
  });
  out.push({ name: "rot", at: S(...rotAnchor(el, cx, cy, deg)) });
  return out;
}

/** 旋转手柄锚点:顶中点沿法线上移 28 逻辑像素,再随元素旋转 */
function rotAnchor(el: SceneElement, cx: number, cy: number, deg: number): [number, number] {
  const p = deg === 0 ? { x: cx, y: el.y - 28 } : rotatePoint(cx, el.y - 28, cx, cy, deg);
  return [p.x, p.y];
}

export interface HandleHit {
  mode: GestureMode;
  handle: HandleName;
  /** connector 手柄语义:nw/se = 起点/终点,n = 曲线控制点 */
  isConnector: boolean;
}

/** 屏幕空间手柄命中测试 */
export function hitHandle(el: SceneElement, view: ViewTransform, sx: number, sy: number, radius: number, elements: SceneElement[] = []): HandleHit | null {
  for (const hp of handlePoints(el, view, elements)) {
    if (Math.hypot(sx - hp.at.x, sy - hp.at.y) <= radius) {
      return { mode: el.kind === "connector" ? (hp.name === "n" ? "curve" : "endpoint") : hp.name === "rot" ? "rotate" : "resize", handle: hp.name, isConnector: el.kind === "connector" };
    }
  }
  return null;
}

/** resize 手势 -> 几何补丁(连线不适用)。角手柄 proportional 时锁宽高比(对角固定,指针在对角线上的投影定系数);
 *  旋转元素(便签)先把指针位移旋回局部坐标,补丁始终是未旋转框的 x/y/w/h。 */
export function resizePatch(o: SceneElement, handle: HandleName, dx: number, dy: number, proportional = false, minSize = 24): Record<string, number> {
  const deg = elementRotate(o);
  if (deg !== 0) ({ x: dx, y: dy } = rotatePoint(dx, dy, 0, 0, -deg));
  if (proportional && handle.length === 2) {
    const sx = handle.includes("e") ? 1 : -1;
    const sy = handle.includes("s") ? 1 : -1;
    const t = Math.max((o.w * o.w + o.w * sx * dx + o.h * o.h + o.h * sy * dy) / (o.w * o.w + o.h * o.h), minSize / Math.min(o.w, o.h));
    const w = o.w * t;
    const h = o.h * t;
    return {
      x: Math.round(handle.includes("w") ? o.x + o.w - w : o.x),
      y: Math.round(handle.includes("n") ? o.y + o.h - h : o.y),
      w: Math.round(w),
      h: Math.round(h),
    };
  }
  let x = o.x;
  let y = o.y;
  let w = o.w;
  let h = o.h;
  if (handle.includes("e")) w = o.w + dx;
  if (handle.includes("w")) {
    w = o.w - dx;
    x = o.x + dx;
  }
  if (handle.includes("s")) h = o.h + dy;
  if (handle.includes("n")) {
    h = o.h - dy;
    y = o.y + dy;
  }
  if (w < minSize) {
    if (handle.includes("w")) x -= minSize - w;
    w = minSize;
  }
  if (h < minSize) {
    if (handle.includes("n")) y -= minSize - h;
    h = minSize;
  }
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

/** 旋转手势 -> 补丁:指针相对元素中心的角度即旋转角(手柄在正上方为 0 度);snap 时吸 15 度整数倍 */
export function rotatePatch(o: SceneElement, px: number, py: number, snap = false): { rotate: number } {
  const cx = o.x + o.w / 2;
  const cy = o.y + o.h / 2;
  let deg = (Math.atan2(py - cy, px - cx) * 180) / Math.PI + 90;
  if (snap) deg = Math.round(deg / 15) * 15;
  return { rotate: Math.round(deg * 10) / 10 };
}

/** 等比缩放时文字类元素字号随宽度同比例缩放(带 fontSize 者才生效),下限 8 */
export function scaledFontSize(o: SceneElement, next: { w?: number }): { fontSize: number } | null {
  const fs = "fontSize" in o ? o.fontSize : undefined;
  if (typeof fs !== "number" || typeof next.w !== "number" || o.w <= 0) return null;
  return { fontSize: Math.max(8, Math.round((fs * next.w) / o.w)) };
}

export interface MovePatch {
  patch: Record<string, unknown>;
  guideX: number | null;
  guideY: number | null;
}

/** move 手势 -> 补丁;连线平移端点(并解除绑定,绑定端由元素位置决定,平移无从生效),其余元素带画布与元素间吸附 */
export function movePatch(o: SceneElement, dx: number, dy: number, canvasW: number, canvasH: number, snap: number, others: SceneElement[] = []): MovePatch {
  if (o.kind === "connector") {
    const round = (p: [number, number]): [number, number] => [Math.round(p[0]), Math.round(p[1])];
    return {
      patch: {
        from: round([o.from[0] + dx, o.from[1] + dy]),
        to: round([o.to[0] + dx, o.to[1] + dy]),
        fromEl: undefined,
        toEl: undefined,
      },
      guideX: null,
      guideY: null,
    };
  }
  const s = snapMove(o, dx, dy, canvasW, canvasH, snap, others);
  return { patch: { x: Math.round(o.x + s.dx), y: Math.round(o.y + s.dy) }, guideX: s.guideX, guideY: s.guideY };
}

/** 单轴吸附:移动框的左/中/右探针吸到画布边线或候选元素边线,返回校正量与参考线位置 */
function snapAxis(low: number, high: number, canvasMid: number, canvasMax: number, candidates: number[], snap: number): { shift: number; guide: number | null } {
  const probes = [low, (low + high) / 2, high];
  let best: { shift: number; guide: number; d: number } | null = null;
  for (const probe of probes) {
    for (const cand of [...candidates, 0, canvasMid, canvasMax]) {
      const d = Math.abs(probe - cand);
      if (d < snap && (!best || d < best.d)) best = { shift: cand - probe, guide: cand, d };
    }
  }
  return best ? { shift: best.shift, guide: best.guide } : { shift: 0, guide: null };
}

/** 其他元素的吸附候选线(左右缘/中心,数组格逐格);连线不参与 */
function elementSnapLines(others: SceneElement[]): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const el of others) {
    const rects = elementRects(el);
    if (!rects) continue;
    for (const r of rects) {
      xs.push(r.x, r.x + r.w / 2, r.x + r.w);
      ys.push(r.y, r.y + r.h / 2, r.y + r.h);
    }
  }
  return { xs, ys };
}

/** 移动矩形(单元素框或多选包围盒)吸附:返回校正后的位移与参考线(画布中线和元素边线)。
 *  ponytail: 吸附/对齐候选按未旋转几何框,旋转元素的视觉边线有偏差;需要精确时对角点用 rotatePoint 求旋转包围盒 */
export function snapMove(r: { x: number; y: number; w: number; h: number }, dx: number, dy: number, canvasW: number, canvasH: number, snap: number, others: SceneElement[] = []): { dx: number; dy: number; guideX: number | null; guideY: number | null } {
  const { xs, ys } = elementSnapLines(others);
  const sx = snapAxis(r.x + dx, r.x + r.w + dx, canvasW / 2, canvasW, xs, snap);
  const sy = snapAxis(r.y + dy, r.y + r.h + dy, canvasH / 2, canvasH, ys, snap);
  return { dx: dx + sx.shift, dy: dy + sy.shift, guideX: sx.guide, guideY: sy.guide };
}

/** 连线手势补丁:端点拖拽 / 曲线控制点拖拽 */
export function connectorPatch(o: ConnectorElement, handle: HandleName, px: number, py: number): Record<string, unknown> {
  if (handle === "nw") return { from: [Math.round(px), Math.round(py)] };
  if (handle === "se") return { to: [Math.round(px), Math.round(py)] };
  // 曲线控制点:指针相对中点在法线上的投影即为 curve
  const vx = o.to[0] - o.from[0];
  const vy = o.to[1] - o.from[1];
  const len = Math.hypot(vx, vy) || 1;
  const nx = -vy / len;
  const ny = vx / len;
  const mx = (o.from[0] + o.to[0]) / 2;
  const my = (o.from[1] + o.to[1]) / 2;
  return { curve: Math.round(Math.max(-480, Math.min(480, (px - mx) * nx + (py - my) * ny))) };
}

export interface SnapPoint {
  x: number;
  y: number;
  /** anchor = 角/边中点/中心,edge = 贴到元素边缘 */
  kind: "anchor" | "edge";
  /** 命中的元素 id:端点落点绑定它,实现连线跟随元素 */
  elId: string;
}

const ANCHOR_SNAP_R = 14;
const EDGE_SNAP_R = 10;

/**
 * 连线端点吸附(粘连):靠近其他元素的锚点(四角/边中点/中心)时吸到锚点;
 * 指针落在元素内部或贴边时吸到最近边缘点。数组格逐格参与。无候选返回 null。
 * ponytail: 锚点网格按未旋转几何,旋转元素的吸附位置有偏差(同 elementBounds)。
 */
export function snapConnectorPoint(others: SceneElement[], px: number, py: number): SnapPoint | null {
  let anchor: (SnapPoint & { d: number }) | null = null;
  let edge: (SnapPoint & { d: number }) | null = null;
  for (const el of others) {
    const rects = elementRects(el);
    if (!rects) continue;
    for (const r of rects) {
      const points: Array<[number, number]> = [
        [r.x, r.y], [r.x + r.w / 2, r.y], [r.x + r.w, r.y],
        [r.x, r.y + r.h / 2], [r.x + r.w / 2, r.y + r.h / 2], [r.x + r.w, r.y + r.h / 2],
        [r.x, r.y + r.h], [r.x + r.w / 2, r.y + r.h], [r.x + r.w, r.y + r.h],
      ];
      for (const [ax, ay] of points) {
        const d = Math.hypot(px - ax, py - ay);
        if (d <= ANCHOR_SNAP_R && (!anchor || d < anchor.d)) anchor = { x: ax, y: ay, kind: "anchor", d, elId: el.id };
      }
      const near = nearestBorderPoint(r, px, py);
      const inside = px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
      if ((inside || near.d <= EDGE_SNAP_R) && (!edge || near.d < edge.d)) edge = { x: near.x, y: near.y, kind: "edge", d: near.d, elId: el.id };
    }
  }
  if (anchor) return { x: anchor.x, y: anchor.y, kind: "anchor", elId: anchor.elId };
  return edge ? { x: edge.x, y: edge.y, kind: "edge", elId: edge.elId } : null;
}
