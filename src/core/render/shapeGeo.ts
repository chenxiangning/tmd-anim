import type { ShapeElement } from "../types";

/**
 * 形状几何:把 shape 变体描成路径(可能含多个子路径,如圆柱顶面、对话框尾巴),
 * 填充/描边由调用方统一处理;圆柱顶面与对话框尾巴重叠填充无副作用(nonzero)。
 */

function polygon(ctx: CanvasRenderingContext2D, points: Array<[number, number]>): void {
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
}

/** 五角星顶点:外接 (w x h) 椭圆,内半径比例 0.42,顶点朝上 */
function starPoints(x: number, y: number, w: number, h: number): Array<[number, number]> {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = w / 2;
  const ry = h / 2;
  const points: Array<[number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const f = i % 2 === 0 ? 1 : 0.42;
    points.push([cx + Math.cos(angle) * rx * f, cy + Math.sin(angle) * ry * f]);
  }
  return points;
}

// ---- 手绘(sketch)模式:按元素 id 种子确定性展开的抖动轮廓 ----

/** FNV-1a 字符串哈希 → 稳定种子;同 id 每次渲染抖出同一形状,保证 (project,t) 纯函数 */
function hashSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = (h ^ id.charCodeAt(i)) * 16777619;
  return h >>> 0;
}

/** 种子噪声 [0,1),sin 哈希,够用的确定性伪随机 */
function noise(seed: number, i: number): number {
  const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/** 逐顶点抖动:幅度 ~ min(w,h)*5%,有界 1.5~10 逻辑像素;salt 让同一元素的子路径抖得不同。
 *  种子优先取 sketchSeed(点击/粘贴时随机生成),缺省按 id 稳定展开——渲染仍是纯函数 */
function wobble(el: ShapeElement, pts: Array<[number, number]>, salt = 0): Array<[number, number]> {
  const amp = Math.min(10, Math.max(1.5, (Math.min(el.w, el.h) * 5) / 100));
  const seed = Math.round(el.sketchSeed ?? hashSeed(el.id)) + salt;
  return pts.map(([px, py], i) => [
    px + (noise(seed, i * 2) - 0.5) * 2 * amp,
    py + (noise(seed, i * 2 + 1) - 0.5) * 2 * amp,
  ]);
}

/** 椭圆/圆弧采样点(角度 from..to 均分 n 段) */
function arcPoints(cx: number, cy: number, rx: number, ry: number, from: number, to: number, n: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= n; i++) {
    const a = from + ((to - from) * i) / n;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}

/** 圆角矩形周长采样:四边中点 + 每角 3 段圆弧 */
function rectPoints(x: number, y: number, w: number, h: number, r: number): Array<[number, number]> {
  const rr = Math.min(r, w / 2, h / 2);
  const pts: Array<[number, number]> = [];
  const corner = (cx: number, cy: number, from: number) => {
    for (let i = 0; i <= 3; i++) {
      const a = from + (i / 3) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
  };
  pts.push([x + rr, y], [x + w - rr, y]);
  corner(x + w - rr, y + rr, -Math.PI / 2);
  pts.push([x + w, y + h - rr]);
  corner(x + w - rr, y + h - rr, 0);
  pts.push([x + w - rr, y + h], [x + rr, y + h]);
  corner(x + rr, y + h - rr, Math.PI / 2);
  pts.push([x, y + rr]);
  corner(x + rr, y + rr, Math.PI);
  return pts;
}

/** 手绘描迹:各变体展开为点列后抖动;圆柱顶面/对话框尾巴用 salt 区分子路径 */
function traceSketch(ctx: CanvasRenderingContext2D, el: ShapeElement): void {
  const { x, y, w, h } = el;
  const poly = (pts: Array<[number, number]>, salt = 0) => polygon(ctx, wobble(el, pts, salt));
  ctx.beginPath();
  switch (el.shape) {
    case "ellipse":
      poly(arcPoints(x + w / 2, y + h / 2, w / 2, h / 2, 0, Math.PI * 2, 14));
      break;
    case "triangle":
      poly([[x + w / 2, y], [x + w, y + h], [x, y + h]]);
      break;
    case "diamond":
      poly([[x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2]]);
      break;
    case "hexagon":
      poly([
        [x, y + h / 2], [x + w * 0.25, y], [x + w * 0.75, y],
        [x + w, y + h / 2], [x + w * 0.75, y + h], [x + w * 0.25, y + h],
      ]);
      break;
    case "star":
      poly(starPoints(x, y, w, h));
      break;
    case "cylinder": {
      const rx = w / 2;
      const ry = Math.min(h * 0.14, h / 4);
      const cx = x + rx;
      // 主体:左竖边 → 底半椭圆 → 右竖边 → 顶半椭圆(上凸)
      poly([
        [x, y + ry], [x, y + h - ry],
        ...arcPoints(cx, y + h - ry, rx, ry, Math.PI, Math.PI * 2, 7),
        [x + w, y + ry],
        ...arcPoints(cx, y + ry, rx, ry, 0, -Math.PI, 7),
      ]);
      poly(arcPoints(cx, y + ry, rx, ry, 0, Math.PI * 2, 12), 31);
      break;
    }
    case "blockArrow": {
      const cy = y + h / 2;
      const shaft = h * 0.45;
      const headLen = Math.min(w * 0.38, w / 2);
      poly([
        [x, cy - shaft / 2], [x + w - headLen, cy - shaft / 2], [x + w - headLen, y],
        [x + w, cy], [x + w - headLen, y + h], [x + w - headLen, cy + shaft / 2], [x, cy + shaft / 2],
      ]);
      break;
    }
    case "speechBubble": {
      const bodyH = h * 0.76;
      poly(rectPoints(x, y, w, bodyH, Math.min(18, h / 4)));
      poly([[x + w * 0.2, y + bodyH - 2], [x + w * 0.14, y + h], [x + w * 0.4, y + bodyH - 2]], 7);
      break;
    }
    default:
      poly(rectPoints(x, y, w, h, Math.min(el.radius ?? 0, Math.min(w, h) / 2)));
  }
}

export function traceShape(ctx: CanvasRenderingContext2D, el: ShapeElement): void {
  if (el.sketch) {
    traceSketch(ctx, el);
    return;
  }
  const { x, y, w, h } = el;
  ctx.beginPath();
  switch (el.shape) {
    case "ellipse":
      ctx.ellipse(x + w / 2, y + h / 2, Math.max(w / 2, 1), Math.max(h / 2, 1), 0, 0, Math.PI * 2);
      break;
    case "triangle":
      polygon(ctx, [
        [x + w / 2, y],
        [x + w, y + h],
        [x, y + h],
      ]);
      break;
    case "diamond":
      polygon(ctx, [
        [x + w / 2, y],
        [x + w, y + h / 2],
        [x + w / 2, y + h],
        [x, y + h / 2],
      ]);
      break;
    case "hexagon":
      polygon(ctx, [
        [x, y + h / 2],
        [x + w * 0.25, y],
        [x + w * 0.75, y],
        [x + w, y + h / 2],
        [x + w * 0.75, y + h],
        [x + w * 0.25, y + h],
      ]);
      break;
    case "star":
      polygon(ctx, starPoints(x, y, w, h));
      break;
    case "cylinder": {
      const rx = w / 2;
      const ry = Math.min(h * 0.14, h / 4);
      const cx = x + rx;
      ctx.moveTo(x, y + ry);
      ctx.lineTo(x, y + h - ry);
      ctx.ellipse(cx, y + h - ry, rx, ry, 0, Math.PI, 0, true);
      ctx.lineTo(x + w, y + ry);
      ctx.ellipse(cx, y + ry, rx, ry, 0, 0, Math.PI, true);
      ctx.closePath();
      ctx.moveTo(x + w, y + ry);
      ctx.ellipse(cx, y + ry, rx, ry, 0, 0, Math.PI * 2);
      break;
    }
    case "blockArrow": {
      const cy = y + h / 2;
      const shaft = h * 0.45;
      const headLen = Math.min(w * 0.38, w / 2);
      polygon(ctx, [
        [x, cy - shaft / 2],
        [x + w - headLen, cy - shaft / 2],
        [x + w - headLen, y],
        [x + w, cy],
        [x + w - headLen, y + h],
        [x + w - headLen, cy + shaft / 2],
        [x, cy + shaft / 2],
      ]);
      break;
    }
    case "speechBubble": {
      const bodyH = h * 0.76;
      ctx.roundRect(x, y, w, bodyH, Math.min(18, h / 4));
      polygon(ctx, [
        [x + w * 0.2, y + bodyH - 2],
        [x + w * 0.14, y + h],
        [x + w * 0.4, y + bodyH - 2],
      ]);
      break;
    }
    default:
      ctx.roundRect(x, y, w, h, Math.min(el.radius ?? 0, Math.min(w, h) / 2));
  }
}
