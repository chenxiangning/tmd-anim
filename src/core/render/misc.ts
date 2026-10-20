import type { ConnectorElement, ImageElement, SceneElement } from "../types";
import { connectorRoute, strokeRoundedPolyline } from "./connectorRoute";
import { roundRect, sansFont } from "./text";

/** 连线(smooth 自适应三次 / elbow 直角正交 / straight 直线 + 切线箭头 + 曲上标签胶囊)与图片(圆角裁剪 + contain 适配)。 */

export interface ConnectorGeometry {
  /** true = 自适应平滑曲线(三次贝塞尔,curve 为 0/缺省);false = 手动弓量(二次,curve 非 0) */
  auto: boolean;
  /** 手动模式:二次控制点;自动模式:曲线 t=0.5 处的点(标签/手柄挂点) */
  control: { x: number; y: number };
  /** 自动模式的三次控制点(手动模式下与 control 相同,仅占位) */
  c1: { x: number; y: number };
  c2: { x: number; y: number };
  /** 曲线上 t 处的点 */
  pointAt(t: number): { x: number; y: number };
  /** 曲线终点切线角(箭头朝向) */
  endAngle(): number;
}

export function connectorGeometry(el: ConnectorElement): ConnectorGeometry {
  const [x1, y1] = el.from;
  const [x2, y2] = el.to;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const vx = x2 - x1;
  const vy = y2 - y1;
  const len = Math.hypot(vx, vy) || 1;
  const curve = el.curve && Math.abs(el.curve) >= 1 ? el.curve : 0;

  function quadratic(control: { x: number; y: number }): ConnectorGeometry {
    function pointAt(t: number): { x: number; y: number } {
      const u = 1 - t;
      return {
        x: u * u * x1 + 2 * u * t * control.x + t * t * x2,
        y: u * u * y1 + 2 * u * t * control.y + t * t * y2,
      };
    }
    return {
      auto: false,
      control,
      c1: control,
      c2: control,
      pointAt,
      endAngle: () => Math.atan2(y2 - control.y, x2 - control.x),
    };
  }

  // 手动弓量(原有语义):控制点 = 中点沿法线偏移 curve 像素
  if (curve !== 0) return quadratic({ x: mx + (-vy / len) * curve, y: my + (vx / len) * curve });

  // 自适应平滑(对标 React Flow getBezierPath):控制点沿两端出口方向(相对位移主轴)伸展,
  // 长度 = 0.35 * 距离;曲线离开与进入元素时都顺着主轴,入射角随相对位置自动贴合
  const horizontal = Math.abs(vx) > Math.abs(vy);
  const sx = Math.sign(vx) || 1;
  const sy = Math.sign(vy) || 1;
  const k = Math.min(Math.max(len * 0.35, 36), 480);
  const c1 = { x: x1 + (horizontal ? sx * k : 0), y: y1 + (horizontal ? 0 : sy * k) };
  const c2 = { x: x2 - (horizontal ? sx * k : 0), y: y2 - (horizontal ? 0 : sy * k) };
  function pointAt(t: number): { x: number; y: number } {
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    return {
      x: a * x1 + b * c1.x + c * c2.x + d * x2,
      y: a * y1 + b * c1.y + c * c2.y + d * y2,
    };
  }
  return {
    auto: true,
    control: pointAt(0.5),
    c1,
    c2,
    pointAt,
    endAngle: () => Math.atan2(y2 - c2.y, x2 - c2.x),
  };
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 元素布局包围盒:数组格取全部格子的外接框;连线不可作为绑定目标,返回 null;与动画状态无关。
 *  ponytail: 未旋转几何,旋转元素的连线锚点/吸附有偏差(同 snapMove),精确时按 rotatePoint 求旋转角点 */
export function elementBounds(el: SceneElement): Rect | null {
  if (el.kind === "connector") return null;
  if (el.kind === "arrayCells") {
    const size = el.cellSize ?? 88;
    const gap = el.gap ?? 14;
    const perRow = Math.max(1, el.perRow ?? el.cells.length);
    const rows = Math.ceil(el.cells.length / perRow);
    const cols = Math.min(el.cells.length, perRow);
    if (el.cells.length === 0) return null;
    return { x: el.x, y: el.y, w: cols * size + (cols - 1) * gap, h: rows * size + (rows - 1) * gap };
  }
  return { x: el.x, y: el.y, w: el.w, h: el.h };
}

/** 元素中心朝 (tx,ty) 的射线与包围盒边界的交点,归一化到 [0..1, 0..1](绑定 focus 与端点解析共用) */
export function centerRayFocus(rect: Rect, tx: number, ty: number): [number, number] {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return [0.5, 0];
  const sx = dx !== 0 ? rect.w / 2 / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? rect.h / 2 / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return [(cx + dx * s - rect.x) / rect.w, (cy + dy * s - rect.y) / rect.h];
}

/** 点到矩形边界的最近点;内部点投影到最近的一条边(连线吸附与绑定端点解析共用) */
export function nearestBorderPoint(r: Rect, px: number, py: number): { x: number; y: number; d: number } {
  const cx = Math.min(Math.max(px, r.x), r.x + r.w);
  const cy = Math.min(Math.max(py, r.y), r.y + r.h);
  if (cx !== px || cy !== py) return { x: cx, y: cy, d: Math.hypot(px - cx, py - cy) };
  const left = px - r.x;
  const right = r.x + r.w - px;
  const top = py - r.y;
  const bottom = r.y + r.h - py;
  const min = Math.min(left, right, top, bottom);
  if (min === left) return { x: r.x, y: py, d: left };
  if (min === right) return { x: r.x + r.w, y: py, d: right };
  if (min === top) return { x: px, y: r.y, d: top };
  return { x: px, y: r.y + r.h, d: bottom };
}

/**
 * 连线端点解析(纯函数):fromEl/toEl 指向的元素存在时——
 * - 有 fromFocus/toFocus(拖拽吸附绑定时记录的归一化位置):端点固定在元素上的相对位置,元素移动/缩放端点跟随,不滑动不跳边;
 * - 否则取「元素中心朝另一端」的射线与包围盒边界的交点(旧行为兜底);
 * 元素缺失回落到 from/to 原始坐标。
 */
export function resolveConnector(el: ConnectorElement, elements: SceneElement[]): ConnectorElement {
  if (!el.fromEl && !el.toEl) return el;
  const boundsOf = (id: string | undefined): Rect | null => {
    if (!id) return null;
    const target = elements.find((e) => e.id === id);
    return target ? elementBounds(target) : null;
  };
  const anchor = (rect: Rect, focus: [number, number] | undefined, tx: number, ty: number): { x: number; y: number } => {
    if (focus) {
      const fx = Math.min(1, Math.max(0, focus[0]));
      const fy = Math.min(1, Math.max(0, focus[1]));
      return { x: rect.x + fx * rect.w, y: rect.y + fy * rect.h };
    }
    const [fx, fy] = centerRayFocus(rect, tx, ty);
    return { x: rect.x + fx * rect.w, y: rect.y + fy * rect.h };
  };
  const bFrom = boundsOf(el.fromEl);
  const bTo = boundsOf(el.toEl);
  if (!bFrom && !bTo) return el;
  // 先按原始对端解析一端,再按解析后的结果解析另一端,保证确定性
  const from = bFrom ? anchor(bFrom, el.fromFocus, el.to[0], el.to[1]) : { x: el.from[0], y: el.from[1] };
  const to = bTo ? anchor(bTo, el.toFocus, from.x, from.y) : { x: el.to[0], y: el.to[1] };
  return { ...el, from: [from.x, from.y], to: [to.x, to.y] };
}

export function drawConnector(ctx: CanvasRenderingContext2D, el: ConnectorElement, elements: SceneElement[] = [], dashOffset?: number): void {
  const [x1, y1] = el.from;
  const [x2, y2] = el.to;
  const color = el.color ?? "#475569";
  const lineW = el.width ?? 5;
  const route = connectorRoute(el, elements);
  const mid = route.mid;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineW;
  ctx.lineCap = "round";
  // 强调数据流(emphasis.dashFlow):虚线滚动,速度由 dashOffset 变化率决定;静态虚线走 el.dash
  if (dashOffset !== undefined) {
    ctx.setLineDash([lineW * 2.6, lineW * 1.9]);
    ctx.lineDashOffset = dashOffset;
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
  // arrow 缺省 true;false = 纯直线/曲线(直线库入口)
  if (el.arrow !== false) {
    const ang = route.endAngle;
    const size = lineW * 3.2;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - size * Math.cos(ang - 0.45), y2 - size * Math.sin(ang - 0.45));
    ctx.lineTo(x2 - size * Math.cos(ang + 0.45), y2 - size * Math.sin(ang + 0.45));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
  if (el.label) {
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
  }
  ctx.restore();
}

/** 图片缓存条目:主线程预览放 HTMLImageElement,Worker 导出放预解码好的 ImageBitmap */
interface CachedImage {
  source: CanvasImageSource;
  ready(): boolean;
}

const imgCache = new Map<string, CachedImage>();

/** Worker 导出路径用:注册主线程预解码好的位图(worker 内没有 Image/DOM) */
export function registerImageSource(src: string, source: CanvasImageSource): void {
  imgCache.set(src, { source, ready: () => true });
}

/** 取已就绪的图片;未加载完返回 null(下一帧重画时会自动就绪),不阻塞绘制循环 */
export function getImage(src: string): CachedImage | null {
  let entry = imgCache.get(src);
  if (!entry) {
    const img = new Image();
    img.src = src;
    entry = { source: img, ready: () => img.complete && img.naturalWidth > 0 };
    imgCache.set(src, entry);
  }
  return entry.ready() ? entry : null;
}

/** 位图尺寸:主线程是 HTMLImageElement(naturalWidth),Worker 里是 ImageBitmap(width) */
function sourceSize(source: CanvasImageSource): { w: number; h: number } {
  const s = source as HTMLImageElement | ImageBitmap;
  return "naturalWidth" in s ? { w: s.naturalWidth, h: s.naturalHeight } : { w: s.width, h: s.height };
}

export function drawImageEl(ctx: CanvasRenderingContext2D, el: ImageElement): void {
  const img = getImage(el.src);
  if (!img) return;
  const { w, h } = sourceSize(img.source);
  ctx.save();
  roundRect(ctx, el.x, el.y, el.w, el.h, el.radius ?? 12);
  ctx.clip();
  const s = Math.min(el.w / w, el.h / h);
  const dw = w * s;
  const dh = h * s;
  ctx.drawImage(img.source, el.x + (el.w - dw) / 2, el.y + (el.h - dh) / 2, dw, dh);
  ctx.restore();
}
