import type { CodeElement } from "../types";
import { monoFont, roundRect, sansFont } from "./text";

/** 代码块:mac 三点标题栏 + 轻量词法着色(注释/字符串/数字/关键词),语言无关。 */

const KEYWORDS = new Set([
  "function", "return", "const", "let", "var", "if", "else", "for", "while", "break", "continue",
  "class", "new", "this", "import", "from", "export", "default", "async", "await", "typeof",
  "interface", "type", "extends", "implements", "def", "lambda", "pass", "print", "fn", "pub",
  "use", "mut", "match", "struct", "impl", "enum", "true", "false", "null", "undefined", "nil",
  "console", "log", "print",
]);

const TOKEN_RE =
  /(\/\/.*|#.*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d[\d_]*(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|(\s+)|(.)/g;

interface Token {
  text: string;
  color: string;
}

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  TOKEN_RE.lastIndex = 0;
  for (let m = TOKEN_RE.exec(line); m !== null; m = TOKEN_RE.exec(line)) {
    const [full, comment, str, numLit, word, space] = m;
    let color = "#334155";
    if (comment) color = "#94A3B8";
    else if (str) color = "#059669";
    else if (numLit) color = "#2563EB";
    else if (word) color = KEYWORDS.has(word) ? "#7C3AED" : "#334155";
    else if (!space) color = "#64748B";
    tokens.push({ text: full, color });
  }
  return tokens;
}

/** mac 窗口三个圆点(代码块/终端/浏览器共用),x/y 为首圆点圆心 */
export function drawWindowDots(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const dotColors = ["#FF5F57", "#FEBC2E", "#28C840"];
  dotColors.forEach((color, i) => {
    ctx.beginPath();
    ctx.arc(x + i * r * 3.4, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });
}

export function drawCode(
  ctx: CanvasRenderingContext2D,
  el: CodeElement,
  progress?: number,
  hl?: { lines: [number, number]; alpha: number } | null,
): void {
  const fontSize = el.fontSize ?? 26;
  const lineH = fontSize * 1.6;
  const headerH = fontSize * 2.1;
  const padX = fontSize * 0.9;
  const bg = el.dark ? "#0F172A" : "#FFFFFF";
  const border = el.dark ? "#1E293B" : "#E2E8F0";
  const defaultColor = el.dark ? "#E2E8F0" : "#334155";
  const commentColor = el.dark ? "#64748B" : "#94A3B8";

  ctx.save();
  roundRect(ctx, el.x, el.y, el.w, el.h, 16);
  ctx.clip();
  ctx.fillStyle = bg;
  ctx.fill();

  // 强调行高亮(emphasis.highlightLines):画在底色上、代码文字下
  if (hl) {
    const [ha, hb] = hl.lines;
    ctx.fillStyle = el.dark
      ? `rgba(96,165,250,${(0.3 * hl.alpha).toFixed(3)})`
      : `rgba(59,130,246,${(0.14 * hl.alpha).toFixed(3)})`;
    ctx.fillRect(el.x, el.y + headerH + lineH * 0.2 + (ha - 1) * lineH, el.w, (hb - ha + 1) * lineH);
  }

  // 标题栏:三个圆点 + 文件名
  const dotR = fontSize * 0.22;
  const dotY = el.y + headerH / 2;
  drawWindowDots(ctx, el.x + fontSize, dotY, dotR);
  if (el.filename) {
    ctx.font = sansFont(fontSize * 0.82, 500);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = el.dark ? "#94A3B8" : "#64748B";
    ctx.fillText(el.filename, el.x + fontSize + dotR * 3.4 * 3 + 12, dotY);
  }
  ctx.strokeStyle = border;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(el.x, el.y + headerH);
  ctx.lineTo(el.x + el.w, el.y + headerH);
  ctx.stroke();

  // 代码体:逐行逐 token 着色;typewriter 按行数比例显露
  ctx.font = monoFont(fontSize);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const lines = el.code.split("\n");
  const shownCount =
    progress === undefined ? lines.length : Math.max(1, Math.ceil(progress * lines.length));
  let ly = el.y + headerH + lineH * 0.7;
  for (let i = 0; i < Math.min(shownCount, lines.length); i++) {
    let lx = el.x + padX;
    for (const token of tokenizeLine(lines[i])) {
      ctx.fillStyle = token.color === "#94A3B8" ? commentColor : el.dark && token.color === "#334155" ? defaultColor : token.color;
      ctx.fillText(token.text, lx, ly);
      lx += ctx.measureText(token.text).width;
    }
    ly += lineH;
  }
  ctx.restore();
}
