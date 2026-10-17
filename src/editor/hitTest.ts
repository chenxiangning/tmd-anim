import type { Project, SceneElement } from "../core/types";
import { locate } from "../core/timeline";
import { connectorRoute, type Rect } from "../core/render/connectorRoute";
import { elementBounds, resolveConnector } from "../core/render/misc";

/** 画布命中测试:自上而下(数组逆序)找第一个命中的元素;连线按曲线采样距离,数组格按格子矩形。 */

const CONNECTOR_HIT = 14;

/** 两点构造正则化矩形(框选用) */
export function normRect(x1: number, y1: number, x2: number, y2: number): Rect {
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
}

/** 元素渲染旋转角(度):通用 rotate 字段;便签保留历史缺省 -2,其余缺省 0 */
export function elementRotate(el: SceneElement): number {
  return el.rotate ?? (el.kind === "note" ? -2 : 0);
}
/** 点绕 (cx, cy) 旋转 deg 度(顺时针为正,y 轴向下坐标系) */
export function rotatePoint(px: number, py: number, cx: number, cy: number, deg: number): { x: number; y: number } {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const dx = px - cx;
  const dy = py - cy;
  return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
}

export function elementRects(el: SceneElement): Rect[] | null {
  if (el.kind === "connector") return null;
  if (el.kind === "arrayCells") {
    const size = el.cellSize ?? 88;
    const gap = el.gap ?? 14;
    const perRow = Math.max(1, el.perRow ?? el.cells.length);
    return el.cells.map((_, i) => ({
      x: el.x + (i % perRow) * (size + gap),
      y: el.y + Math.floor(i / perRow) * (size + gap),
      w: size,
      h: size,
    }));
  }
  return [{ x: el.x, y: el.y, w: el.w, h: el.h }];
}

function hits(el: SceneElement, sceneElements: SceneElement[], px: number, py: number): boolean {
  if (el.kind === "connector") {
    const route = connectorRoute(resolveConnector(el, sceneElements), sceneElements);
    const hitR = CONNECTOR_HIT + (el.width ?? 5) / 2;
    for (const p of route.sample()) {
      if (Math.hypot(px - p.x, py - p.y) <= hitR) return true;
    }
    return false;
  }
  const rects = elementRects(el);
  if (!rects) return false;
  // 旋转元素:指针逆旋转回元素局部坐标再查未旋转框
  const deg = elementRotate(el);
  let lx = px;
  let ly = py;
  if (deg !== 0) ({ x: lx, y: ly } = rotatePoint(px, py, el.x + el.w / 2, el.y + el.h / 2, -deg));
  return rects.some((r) => lx >= r.x && lx <= r.x + r.w && ly >= r.y && ly <= r.y + r.h);
}

/** 全局时刻 t 定位场景后做命中测试,返回命中的元素 id(顶层优先);无命中返回 null */
export function hitTest(project: Project, t: number, px: number, py: number): string | null {
  const { index } = locate(project, t);
  const scene = project.scenes[index];
  if (!scene) return null;
  for (let i = scene.elements.length - 1; i >= 0; i--) {
    const el = scene.elements[i];
    if (hits(el, scene.elements, px, py)) return el.id;
  }
  return null;
}

function boundsIntersect(a: Rect, b: Rect): boolean {
  return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
}

function connectorBounds(el: SceneElement, sceneElements: SceneElement[]): Rect | null {
  if (el.kind !== "connector") return elementBounds(el);
  const pts = connectorRoute(resolveConnector(el, sceneElements), sceneElements).sample(24);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** 框选:包围盒与选框相交的元素 id(数组序,即绘制序) */
export function idsInRect(project: Project, t: number, rect: Rect): string[] {
  const { index } = locate(project, t);
  const scene = project.scenes[index];
  if (!scene) return [];
  return scene.elements.filter((el) => {
    const bounds = connectorBounds(el, scene.elements);
    return bounds !== null && boundsIntersect(bounds, rect);
  }).map((el) => el.id);
}
