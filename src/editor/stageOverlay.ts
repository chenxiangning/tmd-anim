import type { ConnectorElement, SceneElement } from "../core/types";
import { nearestBorderPoint } from "../core/render/misc";
import { connectorRoute } from "../core/render/connectorRoute";
import { elementRects } from "./hitTest";

/**
 * 画布覆盖层的纯逻辑:手柄位置、手柄命中、手势 -> 元素补丁。
 * 连线元素用「端点圆点 + 曲线控制点」手柄,其余元素用 8 向缩放手柄。
 * 绘制部分(drawAssistOverlay/drawSelectionOverlay)在 stageOverlayDraw.ts。
 */

export { drawAssistOverlay, drawSelectionOverlay } from "./stageOverlayDraw";

export type HandleName = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
export const HANDLES: ReadonlyArray<HandleName> = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

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

export type GestureMode = "move" | "resize" | "endpoint" | "curve";

export function handlePoints(el: SceneElement, view: ViewTransform, elements: SceneElement[] = []): Array<{ name: HandleName; at: ScreenPoint }> {
  const { scale, ox, oy } = view;
  const S = (lx: number, ly: number): ScreenPoint => ({ x: ox + lx * scale, y: oy + ly * scale });
  if (el.kind === "connector") {
    const mid = connectorRoute(el, elements).mid;
    return [
      { name: "nw", at: S(el.from[0], el.from[1]) },
      { name: "se", at: S(el.to[0], el.to[1]) },
      { name: "n", at: S(mid.x, mid.y) },
    ];
  }
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  const map: Record<HandleName, [number, number]> = {
    nw: [el.x, el.y], n: [cx, el.y], ne: [el.x + el.w, el.y], e: [el.x + el.w, cy],
    se: [el.x + el.w, el.y + el.h], s: [cx, el.y + el.h], sw: [el.x, el.y + el.h], w: [el.x, cy],
  };
  return HANDLES.map((name) => ({ name, at: S(map[name][0], map[name][1]) }));
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
      return { mode: el.kind === "connector" ? (hp.name === "n" ? "curve" : "endpoint") : "resize", handle: hp.name, isConnector: el.kind === "connector" };
    }
  }
  return null;
}

/** resize 手势 -> 几何补丁(连线不适用) */
export function resizePatch(o: SceneElement, handle: HandleName, dx: number, dy: number, minSize = 24): Record<string, number> {
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

export interface MovePatch {
  patch: Record<string, unknown>;
  guideX: number | null;
  guideY: number | null;
}

/** move 手势 -> 补丁;连线平移端点(并解除绑定,绑定端由元素位置决定,平移无从生效),其余元素带中心/边缘吸附 */
export function movePatch(o: SceneElement, dx: number, dy: number, canvasW: number, canvasH: number, snap: number): MovePatch {
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
  let nx = o.x + dx;
  let ny = o.y + dy;
  let guideX: number | null = null;
  let guideY: number | null = null;
  for (const [pos, line] of [[0, 0], [canvasW / 2 - o.w / 2, canvasW / 2], [canvasW - o.w, canvasW]] as const) {
    if (Math.abs(nx - pos) < snap) {
      nx = pos;
      guideX = line;
      break;
    }
  }
  for (const [pos, line] of [[0, 0], [canvasH / 2 - o.h / 2, canvasH / 2], [canvasH - o.h, canvasH]] as const) {
    if (Math.abs(ny - pos) < snap) {
      ny = pos;
      guideY = line;
      break;
    }
  }
  return { patch: { x: Math.round(nx), y: Math.round(ny) }, guideX, guideY };
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
