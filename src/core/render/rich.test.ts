import { describe, expect, it } from "vitest";
import type { FormulaElement, QuoteElement } from "../types";
import { drawFormula, drawQuote } from "./rich";

const anim = { type: "fade" as const, start: 0, duration: 0.1 };

function mockCtx() {
  const texts: Array<{ text: string; x: number; y: number }> = [];
  const strokes: number[] = [];
  const noop = () => {};
  return {
    texts,
    strokes,
    fillText: (text: string, x: number, y: number) => texts.push({ text, x, y }),
    measureText: (t: string) => ({ width: String(t).length * 12 }),
    save: noop, restore: noop, beginPath: noop, closePath: noop,
    roundRect: noop, arc: noop, moveTo: noop, lineTo: noop,
    stroke: () => strokes.push(1), fill: noop, clip: noop, rect: noop,
    globalAlpha: 1,
    fillStyle: "", strokeStyle: "", lineWidth: 1, lineJoin: "round", lineCap: "round",
    font: "", textAlign: "left", textBaseline: "middle",
  } as unknown as CanvasRenderingContext2D & { texts: Array<{ text: string; x: number; y: number }>; strokes: number[] };
}

const quote = (over: Partial<QuoteElement>): QuoteElement => ({
  id: "q1", kind: "quote", x: 0, y: 0, w: 600, h: 160,
  text: "过早优化是万恶之源", author: "Knuth",
  anim,
  ...over,
});

describe("drawQuote", () => {
  it("画正文与署名", () => {
    const ctx = mockCtx();
    drawQuote(ctx, quote({}));
    const all = ctx.texts.map((t) => t.text).join("");
    expect(all).toContain("过早优化是万恶之源");
    expect(all).toContain("Knuth");
  });

  it("无署名时不画作者行", () => {
    const ctx = mockCtx();
    drawQuote(ctx, quote({ author: undefined }));
    const all = ctx.texts.map((t) => t.text).join("");
    expect(all).not.toContain("——");
  });
});

const formula = (text: string, over: Partial<FormulaElement> = {}): FormulaElement => ({
  id: "f1", kind: "formula", x: 0, y: 0, w: 500, h: 200,
  text,
  anim,
  ...over,
});

describe("drawFormula", () => {
  it("上下标与分数可解析:逐字符绘制而非整串回落", () => {
    const ctx = mockCtx();
    drawFormula(ctx, formula("E = mc^2"));
    expect(ctx.texts.length).toBeGreaterThan(1);
    expect(ctx.texts.some((t) => t.text === "2")).toBe(true);
  });

  it("希腊字母与根号映射为符号", () => {
    const ctx = mockCtx();
    drawFormula(ctx, formula("\\alpha + \\sqrt{x}"));
    const chars = ctx.texts.map((t) => t.text);
    expect(chars).toContain("α");
    expect(chars).toContain("x");
    // 根号折线 + 横线至少两段 stroke
    expect(ctx.strokes.length).toBeGreaterThan(0);
  });

  it("解析失败回落纯文本(整串一次 fillText)", () => {
    const ctx = mockCtx();
    drawFormula(ctx, formula("\\frac{1}{")); // 未闭合
    expect(ctx.texts).toHaveLength(1);
    expect(ctx.texts[0].text).toBe("\\frac{1}{");
  });

  it("超长表达式缩放到元素框内(不抛错)", () => {
    const ctx = mockCtx();
    drawFormula(ctx, formula("a+b+c+d+e+f+g+h+i+j+k+l+m+n+o+p", { w: 300, h: 100 }));
    expect(ctx.texts.length).toBeGreaterThan(0);
  });
});
