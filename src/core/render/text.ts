import type { Atom } from "../highlight";
import { atomsOf } from "../highlight";
import { wrapAtoms } from "../wrap";

/** 文本类元素的富文本绘制:高亮短语 = 黑底白字圆角芯片,支持居中/左对齐与打字机裁剪。 */

export const SANS = `"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif`;
export const MONO = `"SF Mono",Menlo,Consolas,"Liberation Mono",monospace`;

export function sansFont(size: number, weight = 600): string {
  return `${weight} ${size}px ${SANS}`;
}

export function monoFont(size: number, weight = 500): string {
  return `${weight} ${size}px ${MONO}`;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export interface RichTextOptions {
  fontSize: number;
  color: string;
  align: "left" | "center";
  highlights?: readonly string[];
  /** typewriter 已显露比例;缺省全显 */
  progress?: number;
  /** 描边(艺术字用):对非芯片文字先描边再填充 */
  stroke?: { color: string; width: number };
}

export function drawRichText(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  opts: RichTextOptions,
): void {
  const atoms = atomsOf(text, opts.highlights);
  const visible = opts.progress === undefined ? atoms : atoms.slice(0, Math.ceil(opts.progress * atoms.length));
  if (visible.length === 0) return;
  ctx.save();
  ctx.font = sansFont(opts.fontSize, 600);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const chipPadX = opts.fontSize * 0.18;
  const chipGap = opts.fontSize * 0.06;
  const measure = (atom: Atom) =>
    ctx.measureText(atom.text).width + (atom.hl ? chipPadX * 2 + chipGap : 0);
  const lineHeight = opts.fontSize * 1.5;
  const lines = wrapAtoms(visible, w, measure);
  const chipH = opts.fontSize * 1.3;
  let ly = y + (h - lines.length * lineHeight) / 2 + lineHeight / 2;
  for (const line of lines) {
    let lx = opts.align === "center" ? x + (w - line.width) / 2 : x;
    for (const atom of line.atoms) {
      const textW = ctx.measureText(atom.text).width;
      if (atom.hl) {
        roundRect(ctx, lx, ly - chipH / 2, textW + chipPadX * 2, chipH, chipH * 0.24);
        ctx.fillStyle = "#1F2937";
        ctx.fill();
        ctx.fillStyle = "#F9FAFB";
        ctx.fillText(atom.text, lx + chipPadX, ly + 1);
        lx += textW + chipPadX * 2 + chipGap;
      } else {
        if (opts.stroke && opts.stroke.width > 0) {
          ctx.lineJoin = "round";
          ctx.strokeStyle = opts.stroke.color;
          ctx.lineWidth = opts.stroke.width;
          ctx.strokeText(atom.text, lx, ly);
        }
        ctx.fillStyle = opts.color;
        ctx.fillText(atom.text, lx, ly);
        lx += textW;
      }
    }
    ly += lineHeight;
  }
  ctx.restore();
}

export function measureLine(ctx: CanvasRenderingContext2D, text: string, font: string): number {
  ctx.font = font;
  return ctx.measureText(text).width;
}
