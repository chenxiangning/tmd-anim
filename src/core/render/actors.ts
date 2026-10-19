import type { AvatarElement, PersonElement } from "../types";
import { getImage } from "./misc";
import { roundRect, sansFont } from "./text";

/**
 * 角色元素:头像(圆形图片/initials + 名称胶囊 + 状态点)与方块人(stand/point/think 三姿态)。
 * 纯 (project,t) 绘制,无外部状态;src 图片未就绪时回退 initials,不闪空。
 */

const INK = "#1F2937";
const MUTED = "#64748B";
const BLUE = "#3B82F6";

const STATUS_COLOR: Record<"online" | "busy" | "offline", string> = {
  online: "#22C55E",
  busy: "#F59E0B",
  offline: "#94A3B8",
};

/** 斜向肢体:从 (x1,y1) 画到 (x2,y2) 的圆角矩形(竖/横/斜统一) */
function drawLimb(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, r: number): void {
  ctx.save();
  ctx.translate(x1, y1);
  ctx.rotate(Math.atan2(y2 - y1, x2 - x1));
  roundRect(ctx, 0, -w / 2, Math.hypot(x2 - x1, y2 - y1), w, r);
  ctx.fill();
  ctx.restore();
}

/** 位图尺寸:主线程 HTMLImageElement(naturalWidth),Worker ImageBitmap(width) */
function sourceSize(source: CanvasImageSource): { w: number; h: number } {
  const s = source as HTMLImageElement | ImageBitmap;
  return "naturalWidth" in s ? { w: s.naturalWidth, h: s.naturalHeight } : { w: s.width, h: s.height };
}

export function drawAvatar(ctx: CanvasRenderingContext2D, el: AvatarElement): void {
  const d = Math.min(el.h, el.w * 0.5);
  const cx = el.x + d / 2;
  const cy = el.y + el.h / 2;
  const bg = el.color ?? BLUE;
  ctx.save();
  ctx.textBaseline = "middle";
  // 圆形本体:图片就绪走 contain 裁中,否则底色 + initials
  const img = el.src ? getImage(el.src) : null;
  if (img) {
    const { w, h } = sourceSize(img.source);
    ctx.save();
    ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
    ctx.clip();
    const s = Math.min(d / w, d / h);
    const dw = w * s;
    const dh = h * s;
    ctx.drawImage(img.source, cx - dw / 2, cy - dh / 2, dw, dh);
    ctx.restore();
  } else {
    const initials = (el.initials ?? (el.name ? el.name.charAt(0) : "?")) || "?";
    ctx.beginPath();
    ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.font = sansFont(d * 0.42, 700);
    ctx.textAlign = "center";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(initials, cx, cy);
  }
  // 状态点:右下 45°,白环 + 色点
  if (el.status) {
    const a = Math.PI / 4;
    const sx = cx + Math.cos(a) * d * 0.42;
    const sy = cy + Math.sin(a) * d * 0.42;
    ctx.beginPath();
    ctx.arc(sx, sy, d * 0.13 + 3, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx, sy, d * 0.13, 0, Math.PI * 2);
    ctx.fillStyle = STATUS_COLOR[el.status];
    ctx.fill();
  }
  // 名称胶囊:贴头像右侧垂直居中,宽 = 文本宽 + 28
  if (el.name) {
    const fontSize = 24;
    ctx.font = sansFont(fontSize, 500);
    const textW = ctx.measureText(el.name).width;
    const pillH = 30;
    const px = el.x + d + 8;
    const py = cy - pillH / 2;
    roundRect(ctx, px, py, textW + 28, pillH, 15);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#E2E8F0";
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.fillStyle = INK;
    ctx.fillText(el.name, px + 14, cy);
  }
  ctx.restore();
}

export function drawPerson(ctx: CanvasRenderingContext2D, el: PersonElement): void {
  const u = el.h;
  const cx = el.x + el.w / 2;
  const color = el.color ?? BLUE;
  const top = el.y;
  ctx.save();
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  // 头
  ctx.beginPath();
  ctx.arc(cx, top + u * 0.11, u * 0.11, 0, Math.PI * 2);
  ctx.fill();
  // 躯干
  roundRect(ctx, cx - u * 0.13, top + u * 0.24, u * 0.26, u * 0.34, u * 0.08);
  ctx.fill();
  // 腿(同宽同圆角,起点 y=u*0.58)
  const legW = u * 0.09;
  for (const lx of [cx - u * 0.115, cx + u * 0.025]) {
    roundRect(ctx, lx, top + u * 0.58, legW, u * 0.30, u * 0.045);
    ctx.fill();
  }
  // 手臂:左臂三姿态一致(肩 y=u*0.27 下垂);右臂按 pose
  const armW = legW;
  const armR = u * 0.045;
  const shoulderY = top + u * 0.27;
  const armLen = u * 0.26;
  const leftX = cx - u * 0.13 - u * 0.02 - armW;
  drawLimb(ctx, leftX, shoulderY, leftX, shoulderY + armLen, armW, armR);
  const pose = el.pose ?? "stand";
  if (pose === "stand") {
    drawLimb(ctx, cx + u * 0.15, shoulderY, cx + u * 0.15, shoulderY + armLen, armW, armR);
  } else if (pose === "point") {
    // 右臂水平右伸 u*0.30,端点小手圆
    const hx = cx + u * 0.13 + u * 0.30;
    drawLimb(ctx, cx + u * 0.13, shoulderY, hx, shoulderY, armW, armR);
    ctx.beginPath();
    ctx.arc(hx, shoulderY, u * 0.045, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // think:肘在躯干右缘 y=u*0.38,前臂斜上到手圆(头右下托腮位)
    const ex = cx + u * 0.13;
    const ey = top + u * 0.38;
    const hx = cx + u * 0.18;
    const hy = top + u * 0.20;
    drawLimb(ctx, cx + u * 0.15, shoulderY, ex, ey, armW, armR);
    drawLimb(ctx, ex, ey, hx, hy, armW, armR);
    ctx.beginPath();
    ctx.arc(hx, hy, u * 0.045, 0, Math.PI * 2);
    ctx.fill();
    // 思考泡:头右上,白底灰边 + MUTED "?"
    const bx = cx + u * 0.15;
    const by = top + u * 0.02;
    ctx.beginPath();
    ctx.arc(bx, by, u * 0.05, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#CBD5E1";
    ctx.stroke();
    ctx.font = sansFont(u * 0.07, 700);
    ctx.textAlign = "center";
    ctx.fillStyle = MUTED;
    ctx.fillText("?", bx, by);
  }
  ctx.restore();
}
