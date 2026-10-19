import type { FormulaElement, QuoteElement } from "../types";
import { drawRichText, roundRect, sansFont } from "./text";

/** 富文本补强:引用块 + 数学公式(TeX 子集轻量排版,零依赖)。 */

export function drawQuote(ctx: CanvasRenderingContext2D, el: QuoteElement, progress?: number): void {
  const fontSize = el.fontSize ?? 34;
  const accent = el.accent ?? "#3B82F6";
  const authorH = el.author ? fontSize * 1.5 : 0;
  ctx.save();
  // 左侧竖条
  roundRect(ctx, el.x, el.y + fontSize * 0.2, 6, el.h - fontSize * 0.4 - authorH, 3);
  ctx.fillStyle = accent;
  ctx.fill();
  drawRichText(ctx, el.x + fontSize * 0.9, el.y, el.w - fontSize, el.h - authorH, el.text, {
    fontSize,
    color: "#1F2937",
    align: "left",
    progress,
  });
  if (el.author) {
    ctx.font = sansFont(fontSize * 0.78, 500);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#64748B";
    ctx.fillText(`—— ${el.author}`, el.x + el.w, el.y + el.h - fontSize * 0.75, el.w);
  }
  ctx.restore();
}

// ---------- formula:TeX 子集确定性排版 ----------

/** 命令映射:希腊字母 / 关系与运算 / 大型算子(左值 = TeX 命令名,不含反斜杠) */
const TEX_SYMBOLS: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", zeta: "ζ", eta: "η", theta: "θ",
  lambda: "λ", mu: "μ", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", phi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Omega: "Ω",
  sum: "∑", int: "∫", infty: "∞", pm: "±", mp: "∓", times: "×", div: "÷", cdot: "⋅",
  leq: "≤", geq: "≥", neq: "≠", approx: "≈", propto: "∝",
  rightarrow: "→", leftarrow: "←", Rightarrow: "⇒", mapsto: "↦",
  partial: "∂", nabla: "∇", forall: "∀", exists: "∃", in: "∈", subset: "⊂", cup: "∪", cap: "∩",
  ldots: "…", cdots: "⋯", quad: " ", qquad: "  ",
};

type FNode =
  | { t: "chr"; ch: string }
  | { t: "op"; sym: string }
  | { t: "seq"; children: FNode[] }
  | { t: "frac"; num: FNode; den: FNode }
  | { t: "sqrt"; arg: FNode }
  | { t: "sup"; base: FNode; arg: FNode }
  | { t: "sub"; base: FNode; arg: FNode };

class TexError extends Error {}

/** 递归下降解析:frac/sqrt 命令、^ _ 上下标(绑定前驱)、{} 分组;未闭合抛出由绘制层回落纯文本 */
function parseTex(src: string): FNode {
  let pos = 0;
  const peek = () => src[pos];
  const eat = () => src[pos++];
  function parseGroup(): FNode {
    if (peek() === "{") {
      eat();
      const g = parseSeq();
      if (peek() !== "}") throw new TexError("未闭合的 {");
      eat();
      return g;
    }
    if (pos >= src.length) throw new TexError("下标/上标缺操作数");
    const ch = eat();
    if (ch === "\\") {
      const name = readCommand();
      return { t: "op", sym: TEX_SYMBOLS[name] ?? name };
    }
    return { t: "chr", ch };
  }
  function readCommand(): string {
    const m = /^[a-zA-Z]+/.exec(src.slice(pos));
    if (m) {
      pos += m[0].length;
      return m[0];
    }
    // 单字符命令如 \,: 取该字符
    return pos < src.length ? eat() : "";
  }
  function parseSeq(): FNode {
    const children: FNode[] = [];
    while (pos < src.length && peek() !== "}") {
      const ch = eat();
      if (ch === "\\") {
        const name = readCommand();
        if (name === "frac") {
          children.push({ t: "frac", num: parseGroup(), den: parseGroup() });
        } else if (name === "sqrt") {
          children.push({ t: "sqrt", arg: parseGroup() });
        } else {
          children.push({ t: "op", sym: TEX_SYMBOLS[name] ?? name });
        }
      } else if (ch === "_" || ch === "^") {
        const prev = children.pop();
        if (!prev) throw new TexError("下标/上标缺前驱");
        const arg = parseGroup();
        children.push(ch === "_" ? { t: "sub", base: prev, arg } : { t: "sup", base: prev, arg });
      } else if (ch === "{") {
        children.push(parseSeq());
        if (peek() !== "}") throw new TexError("未闭合的 {");
        eat();
      } else {
        children.push({ t: "chr", ch });
      }
    }
    return { t: "seq", children };
  }
  const root = parseSeq();
  if (pos !== src.length) throw new TexError("多余的 }");
  return root;
}

interface Metrics {
  w: number;
  /** 基线上方高度 */
  up: number;
  /** 基线下方深度 */
  down: number;
}

function mathFont(size: number): string {
  return `italic 600 ${size}px Georgia,"Times New Roman","Songti SC",serif`;
}

function measure(ctx: CanvasRenderingContext2D, node: FNode, size: number): Metrics {
  const script = size * 0.66;
  ctx.font = mathFont(size);
  switch (node.t) {
    case "chr":
    case "op": {
      const ch = node.t === "chr" ? node.ch : node.sym;
      return { w: ctx.measureText(ch).width, up: size * 0.74, down: size * 0.26 };
    }
    case "seq": {
      let w = 0;
      let up = size * 0.2;
      let down = 0;
      for (const c of node.children) {
        const m = measure(ctx, c, size);
        w += m.w;
        up = Math.max(up, m.up);
        down = Math.max(down, m.down);
      }
      return { w, up, down };
    }
    case "frac": {
      const nm = measure(ctx, node.num, script);
      const dm = measure(ctx, node.den, script);
      return {
        w: Math.max(nm.w, dm.w) + size * 0.28,
        up: nm.up + nm.down + size * 0.34,
        down: dm.up + dm.down + size * 0.22,
      };
    }
    case "sqrt": {
      const am = measure(ctx, node.arg, size);
      return { w: am.w + size * 0.5, up: am.up + size * 0.12, down: am.down };
    }
    case "sup":
    case "sub": {
      const bm = measure(ctx, node.base, size);
      const am = measure(ctx, node.arg, script);
      return node.t === "sup"
        ? { w: bm.w + am.w, up: bm.up + am.up * 0.85, down: bm.down }
        : { w: bm.w + am.w, up: bm.up, down: bm.down + am.down + size * 0.08 };
    }
  }
}

function renderAt(ctx: CanvasRenderingContext2D, node: FNode, x: number, baseY: number, size: number): number {
  const script = size * 0.66;
  ctx.font = mathFont(size);
  switch (node.t) {
    case "chr":
    case "op": {
      const ch = node.t === "chr" ? node.ch : node.sym;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(ch, x, baseY);
      return ctx.measureText(ch).width;
    }
    case "seq": {
      let cx = x;
      for (const c of node.children) cx += renderAt(ctx, c, cx, baseY, size);
      return cx - x;
    }
    case "frac": {
      const nm = measure(ctx, node.num, script);
      const dm = measure(ctx, node.den, script);
      const w = Math.max(nm.w, dm.w) + size * 0.28;
      const ruleY = baseY - size * 0.1;
      renderAt(ctx, node.num, x + (w - nm.w) / 2, ruleY - size * 0.14, script);
      renderAt(ctx, node.den, x + (w - dm.w) / 2, ruleY + dm.up + size * 0.14, script);
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = Math.max(1, size * 0.045);
      ctx.beginPath();
      ctx.moveTo(x + size * 0.05, ruleY);
      ctx.lineTo(x + w - size * 0.05, ruleY);
      ctx.stroke();
      return w;
    }
    case "sqrt": {
      const am = measure(ctx, node.arg, size);
      const signW = size * 0.42;
      const topY = baseY - am.up - size * 0.08;
      // 根号折线
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = Math.max(1, size * 0.05);
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(x, baseY - size * 0.08);
      ctx.lineTo(x + signW * 0.32, baseY - size * 0.08);
      ctx.lineTo(x + signW * 0.6, topY + size * 0.04);
      ctx.lineTo(x + signW, topY);
      ctx.stroke();
      // 横线(vinculum)
      ctx.beginPath();
      ctx.moveTo(x + signW, topY);
      ctx.lineTo(x + signW + am.w + size * 0.08, topY);
      ctx.stroke();
      renderAt(ctx, node.arg, x + signW + size * 0.04, baseY, size);
      return signW + am.w + size * 0.12;
    }
    case "sup":
    case "sub": {
      const bm = measure(ctx, node.base, size);
      const am = measure(ctx, node.arg, script);
      renderAt(ctx, node.base, x, baseY, size);
      const argBase = node.t === "sup" ? baseY - bm.up * 0.85 - am.down * 0.2 : baseY + bm.down + am.up * 0.85;
      renderAt(ctx, node.arg, x + bm.w, argBase, script);
      return bm.w + am.w;
    }
  }
}

export function drawFormula(ctx: CanvasRenderingContext2D, el: FormulaElement): void {
  const color = el.color ?? "#1F2937";
  let root: FNode | null = null;
  try {
    root = parseTex(el.text);
  } catch {
    root = null; // 解析失败回落纯文本,lint 会另发警告
  }
  ctx.save();
  ctx.fillStyle = color;
  if (!root) {
    ctx.font = sansFont(el.fontSize ?? 44, 600);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(el.text, el.x + el.w / 2, el.y + el.h / 2, el.w);
    ctx.restore();
    return;
  }
  // 两趟排版:先按声明字号量,超界等比缩到元素框内
  let size = el.fontSize ?? 64;
  let m = measure(ctx, root, size);
  const scale = Math.min(el.w / Math.max(m.w, 1e-6), el.h / Math.max(m.up + m.down, 1e-6), 1);
  if (scale < 1) {
    size *= scale;
    m = measure(ctx, root, size);
  }
  renderAt(ctx, root, el.x + (el.w - m.w) / 2, el.y + (el.h - (m.up + m.down)) / 2 + m.up, size);
  ctx.restore();
}

/** 校验 TeX 子集可解析性:validate CLI lint 用,解析失败 = 绘制会回落纯文本 */
export function texParseable(src: string): boolean {
  try {
    parseTex(src);
    return true;
  } catch {
    return false;
  }
}
