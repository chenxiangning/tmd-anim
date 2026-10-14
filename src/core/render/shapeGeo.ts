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

export function traceShape(ctx: CanvasRenderingContext2D, el: ShapeElement): void {
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
