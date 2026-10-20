import type { MascotElement } from "../types";
import { drawLimb } from "./actors";
import { roundRect, sansFont } from "./text";

/**
 * 吉祥物:有脸的拟人生物,拟人化叙事(doc 文档精 / bot 机器人)。
 * 纯 (project,t) 绘制;variant/mood 未知值回落 doc/happy(devNode 先例)。
 */

const INK = "#1F2937";
const BLUSH = "#F9C6D0";
const SWEAT = "#7DD3FC";

/** 顶部切角的纸片路径(右上折角),替代普通圆角矩形 */
function traceDocBody(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fold: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - fold, y);
  ctx.lineTo(x + w, y + fold);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** 脸:两点眼(wink 左眼闭合线)+ 嘴 + 腮红;dark 底时眼嘴换白 */
function drawFace(ctx: CanvasRenderingContext2D, cx: number, cy: number, u: number, mood: MascotElement["mood"], dark: boolean): void {
  const ink = dark ? "#FFFFFF" : INK;
  const eyeY = cy - u * 0.02;
  const eyeDx = u * 0.11;
  const eyeR = Math.max(3, u * 0.035);
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(2.5, u * 0.03);
  ctx.lineCap = "round";
  if (mood === "wink") {
    // 左眼闭合弧线,右眼圆点
    ctx.beginPath();
    ctx.arc(cx - eyeDx, eyeY + eyeR, eyeR * 1.2, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + eyeDx, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();
  } else {
    for (const dx of [-eyeDx, eyeDx]) {
      ctx.beginPath();
      ctx.arc(cx + dx, eyeY, eyeR, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // 嘴:happy/wink 上弯弧,worried 下弯扁弧
  ctx.beginPath();
  if (mood === "worried") ctx.arc(cx, cy + u * 0.14, u * 0.07, Math.PI * 1.15, Math.PI * 1.85);
  else ctx.arc(cx, cy + u * 0.06, u * 0.09, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  // 腮红两团(深底用暖黄,浅底用粉)
  ctx.fillStyle = dark ? "#FDE68A" : BLUSH;
  for (const dx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + dx * u * 0.19, cy + u * 0.06, u * 0.05, u * 0.032, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // 汗滴:焦虑时飞在头右上方
  if (mood === "worried") {
    ctx.save();
    ctx.translate(cx + u * 0.3, cy - u * 0.34);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = SWEAT;
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(2, u * 0.02);
    roundRect(ctx, -u * 0.035, -u * 0.035, u * 0.07, u * 0.07, u * 0.015);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

/** 胸牌芯片:圆角矩形 + 自适应字号白色文字 + 描边 */
function drawBadgeChip(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, bg: string, maxW: number, h: number): void {
  let fontSize = h * 0.52;
  ctx.font = sansFont(fontSize, 700);
  while (ctx.measureText(text).width > maxW - h * 0.5 && fontSize > 10) {
    fontSize -= 2;
    ctx.font = sansFont(fontSize, 700);
  }
  const w = Math.min(maxW, ctx.measureText(text).width + h * 0.5);
  roundRect(ctx, x, y, w, h, h * 0.28);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = Math.max(2.5, h * 0.09);
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, y + h / 2 + 1);
}

/** 四肢:两臂斜下伸展 + 两腿;pose 由 mood 派生(worried 双臂上举慌张) */
function drawLimbs(ctx: CanvasRenderingContext2D, el: MascotElement, insetX: number, armY: number, bottom: number, lw: number): void {
  ctx.fillStyle = INK;
  const up = (el.mood ?? "happy") === "worried";
  const len = el.w * 0.16;
  // 左臂:肩点向左下(慌张时向左上)
  drawLimb(ctx, el.x + insetX, armY, el.x + insetX - len, up ? armY - len * 0.8 : armY + len, lw, lw * 0.45);
  drawLimb(ctx, el.x + el.w - insetX, armY, el.x + el.w - insetX + len, up ? armY - len * 0.8 : armY + len, lw, lw * 0.45);
  // 两腿
  const legTop = bottom - el.h * 0.1;
  for (const dx of [-0.18, 0.06]) {
    drawLimb(ctx, el.x + el.w * (0.5 + dx), legTop, el.x + el.w * (0.5 + dx), bottom, lw, lw * 0.45);
  }
  // 脚:腿底端小横条
  const footW = el.w * 0.09;
  const footH = lw * 0.8;
  for (const dx of [-0.18, 0.06]) {
    roundRect(ctx, el.x + el.w * (0.5 + dx) - footW / 2, bottom - footH / 2, footW, footH, footH / 2);
    ctx.fill();
  }
}

/** 脚下名牌:画在元素包围盒外底部(构图需预留),白底描边圆角胶囊 */
function drawNameLabel(ctx: CanvasRenderingContext2D, el: MascotElement): void {
  if (!el.label) return;
  const fontSize = 26;
  ctx.font = sansFont(fontSize, 500);
  const textW = ctx.measureText(el.label).width;
  const w = textW + 28;
  const h = 36;
  const x = el.x + el.w / 2 - w / 2;
  const y = el.y + el.h + 8;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(el.label, x + w / 2, y + h / 2 + 1);
}

export function drawMascot(ctx: CanvasRenderingContext2D, el: MascotElement): void {
  const variant = el.variant ?? "doc";
  const mood = el.mood ?? "happy";
  ctx.save();
  ctx.lineJoin = "round";
  if (variant === "bot") {
    // 机器人:圆角机身 + 天线灯 + 顶部铭牌 + 脸 + 底部白条标签 + 短腿
    const body = el.body ?? "#3B82F6";
    const bodyH = el.h * 0.82;
    const r = Math.min(28, el.w * 0.12);
    // 天线:顶杆 + 圆头灯(绿灯常亮 = 在岗)
    const cx = el.x + el.w / 2;
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(3, el.w * 0.02);
    ctx.beginPath();
    ctx.moveTo(cx, el.y + r * 0.4);
    ctx.lineTo(cx, el.y + el.h * 0.06 + r * 0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, el.y + el.h * 0.045, Math.max(5, el.w * 0.028), 0, Math.PI * 2);
    ctx.fillStyle = "#22C55E";
    ctx.fill();
    ctx.stroke();
    // 机身
    roundRect(ctx, el.x, el.y + el.h * 0.06, el.w, bodyH, r);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = INK;
    ctx.stroke();
    const by = el.y + el.h * 0.06;
    // 铭牌条:徽章文字,黄底深字
    if (el.badge) {
      const plateW = el.w * 0.66;
      const plateH = bodyH * 0.2;
      roundRect(ctx, cx - plateW / 2, by + bodyH * 0.08, plateW, plateH, plateH * 0.24);
      ctx.fillStyle = el.badgeColor ?? "#F7C948";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.font = sansFont(Math.min(plateH * 0.52, 40), 700);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(el.badge, cx, by + bodyH * 0.08 + plateH / 2 + 1);
    }
    drawFace(ctx, cx, by + bodyH * 0.47, el.h * 0.62, mood, true);
    // 底部白条:label 文本(机身内)
    if (el.label) {
      const barW = el.w * 0.74;
      const barH = bodyH * 0.16;
      const barY = by + bodyH * 0.76;
      roundRect(ctx, cx - barW / 2, barY, barW, barH, barH / 2);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.font = sansFont(Math.min(barH * 0.5, 26), 500);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(el.label, cx, barY + barH / 2 + 1);
    }
    // 两只短脚
    ctx.fillStyle = INK;
    for (const dx of [-0.24, 0.12]) {
      roundRect(ctx, el.x + el.w * (0.5 + dx), el.y + el.h * 0.88, el.w * 0.12, el.h * 0.1, 6);
      ctx.fill();
    }
  } else {
    // 文档精:切角纸片 + 折角 + 脸 + 胸牌芯片 + 四肢
    const body = el.body ?? "#FFFFFF";
    const fold = Math.min(el.w, el.h) * 0.2;
    const r = Math.min(16, el.w * 0.08);
    traceDocBody(ctx, el.x, el.y, el.w, el.h, r, fold);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = INK;
    ctx.stroke();
    // 折角三角
    ctx.beginPath();
    ctx.moveTo(el.x + el.w - fold, el.y);
    ctx.lineTo(el.x + el.w - fold, el.y + fold);
    ctx.lineTo(el.x + el.w, el.y + fold);
    ctx.closePath();
    ctx.fillStyle = "#E2E8F0";
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.stroke();
    // 正文灰线三条(纸面质感)
    ctx.strokeStyle = "#CBD5E1";
    ctx.lineWidth = Math.max(3, el.h * 0.014);
    ctx.lineCap = "round";
    const lineY = el.y + el.h * 0.78;
    const lineW = el.w * 0.52;
    for (let i = 0; i < 3; i++) {
      const w_i = i === 2 ? lineW * 0.6 : lineW;
      ctx.beginPath();
      ctx.moveTo(el.x + el.w * 0.2, lineY + i * el.h * 0.055);
      ctx.lineTo(el.x + el.w * 0.2 + w_i, lineY + i * el.h * 0.055);
      ctx.stroke();
    }
    drawFace(ctx, el.x + el.w / 2, el.y + el.h * 0.38, el.h * 0.5, mood, false);
    if (el.badge) {
      drawBadgeChip(ctx, el.x + el.w * 0.1, el.y + el.h * 0.1, el.badge, el.badgeColor ?? "#EF5350", el.w * 0.62, el.h * 0.13);
    }
    drawLimbs(ctx, el, el.w * 0.02, el.y + el.h * 0.42, el.y + el.h, Math.max(6, el.h * 0.045));
  }
  ctx.restore();
  // 名牌:doc 画脚下;bot 已画在机身内,不重复
  if (variant !== "bot") drawNameLabel(ctx, el);
}
