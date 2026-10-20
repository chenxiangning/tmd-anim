import type { LoopArrowElement } from "../types";
import { strokeRoundedPolyline } from "./connectorRoute";
import { roundRect, sansFont } from "./text";

/**
 * 回环箭头:U 形折返箭头(反馈 / 下一轮 / 复盘回写)。
 * 与 connector 的分工:connector 走两点最短路径,loopArrow 强制绕出一圈——
 * 结构图里「走到底再回到开头」的含义,用最短路径画不出来。
 */

const DEFAULT_COLOR = "#8B5CF6";

export function drawLoopArrow(ctx: CanvasRenderingContext2D, el: LoopArrowElement): void {
  const [x1, y1] = el.from;
  const [x2, y2] = el.to;
  const color = el.color ?? DEFAULT_COLOR;
  const lineW = el.width ?? 5;
  const side = el.side ?? "bottom";
  const vertical = side === "top" || side === "bottom";
  const sgn = side === "bottom" || side === "right" ? 1 : -1;
  const span = vertical ? Math.abs(x2 - x1) : Math.abs(y2 - y1);
  const depth = Math.min(400, Math.max(24, el.depth ?? Math.max(48, span * 0.26 + 56)));
  const bend = vertical
    ? [{ x: x1, y: y1 + sgn * depth }, { x: x2, y: y2 + sgn * depth }]
    : [{ x: x1 + sgn * depth, y: y1 }, { x: x2 + sgn * depth, y: y2 }];
  const pts = [{ x: x1, y: y1 }, ...bend, { x: x2, y: y2 }];
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineW;
  ctx.lineCap = "round";
  if (el.dash === true) ctx.setLineDash([lineW * 2.4, lineW * 1.8]);
  ctx.beginPath();
  strokeRoundedPolyline(ctx, pts, { x: x2, y: y2 }, 1, Math.min(depth * 0.5, 30));
  ctx.stroke();
  ctx.setLineDash([]);
  if (el.arrow !== false) {
    // 箭头朝 to:方向 = 最后一段的走向(与 side 相反)
    const ang = vertical ? (sgn > 0 ? -Math.PI / 2 : Math.PI / 2) : sgn > 0 ? Math.PI : 0;
    const size = lineW * 3.4;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - size * Math.cos(ang - 0.45), y2 - size * Math.sin(ang - 0.45));
    ctx.lineTo(x2 - size * Math.cos(ang + 0.45), y2 - size * Math.sin(ang + 0.45));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
  if (el.label) {
    const fontSize = 24;
    const mx = vertical ? (x1 + x2) / 2 : x1 + sgn * depth;
    const my = vertical ? y1 + sgn * depth : (y1 + y2) / 2;
    // 标签放在折返段外侧:靠画布内的那一侧,避免压住主线
    const ly = vertical ? my + (sgn > 0 ? -fontSize * 0.95 : fontSize * 1.15) : my;
    const lx = vertical ? mx : mx + (sgn > 0 ? -fontSize * 0.5 : fontSize * 0.5);
    ctx.font = sansFont(fontSize, 600);
    ctx.textAlign = vertical ? "center" : sgn > 0 ? "right" : "left";
    ctx.textBaseline = "middle";
    const tw = ctx.measureText(el.label).width;
    if (vertical) {
      roundRect(ctx, lx - tw / 2 - 12, ly - fontSize * 0.85, tw + 24, fontSize * 1.7, fontSize * 0.85);
    } else {
      const bx = sgn > 0 ? lx - tw - 12 : lx - 12;
      roundRect(ctx, bx, ly - fontSize * 0.85, tw + 24, fontSize * 1.7, fontSize * 0.85);
    }
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillText(el.label, lx, ly + 1);
  }
  ctx.restore();
}
