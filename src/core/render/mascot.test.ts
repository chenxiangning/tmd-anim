import { describe, expect, it } from "vitest";
import type { ConfettiElement, MascotElement } from "../types";
import { drawConfetti } from "./confetti";
import { drawMascot } from "./mascot";

const anim = { type: "fade" as const, start: 0, duration: 0.1 };

const mascot = (over: Partial<MascotElement>): MascotElement => ({
  id: "m1",
  kind: "mascot",
  x: 100,
  y: 100,
  w: 240,
  h: 300,
  anim,
  ...over,
});

const confetti = (over: Partial<ConfettiElement>): ConfettiElement => ({
  id: "c1",
  kind: "confetti",
  x: 0,
  y: 0,
  w: 1920,
  h: 1080,
  anim,
  ...over,
});

/** 记录 fillText 与 fillRect 的 mock 上下文(其余方法空实现,与 actors.test 同模式) */
function mockCtx() {
  const texts: string[] = [];
  const rects: Array<{ x: number; y: number; w: number; h: number }> = [];
  const noop = () => {};
  return {
    texts,
    rects,
    fillText: (text: string) => texts.push(text),
    fillRect: (x: number, y: number, w: number, h: number) => rects.push({ x, y, w, h }),
    save: noop, restore: noop, beginPath: noop, closePath: noop,
    roundRect: noop, ellipse: noop, arc: noop,
    moveTo: noop, lineTo: noop, quadraticCurveTo: noop,
    stroke: noop, fill: noop, clip: noop, drawImage: noop,
    translate: noop, rotate: noop,
    measureText: (text: string) => ({ width: text.length * 12 }) as TextMetrics,
    globalAlpha: 1,
    fillStyle: "", strokeStyle: "", lineWidth: 1, lineJoin: "round", lineCap: "round",
    font: "", textAlign: "left", textBaseline: "middle",
  } as unknown as CanvasRenderingContext2D & {
    texts: string[];
    rects: Array<{ x: number; y: number; w: number; h: number }>;
  };
}

describe("drawMascot 吉祥物", () => {
  it("doc 变体画胸牌与脚下名牌", () => {
    const ctx = mockCtx();
    drawMascot(ctx, mascot({ variant: "doc", badge: "PDF", label: "最终版.pdf" }));
    expect(ctx.texts).toContain("PDF");
    expect(ctx.texts).toContain("最终版.pdf");
  });

  it("bot 变体铭牌在机身内,不另画脚下名牌", () => {
    const ctx = mockCtx();
    drawMascot(ctx, mascot({ variant: "bot", badge: "文枢", label: "知识加工站" }));
    expect(ctx.texts).toContain("文枢");
    expect(ctx.texts).toContain("知识加工站");
    // bot 名牌只出现一次(机身内),没有脚下重复
    expect(ctx.texts.filter((t) => t === "知识加工站")).toHaveLength(1);
  });

  it("worried 表情不抛错(汗滴与扁嘴分支)", () => {
    const ctx = mockCtx();
    expect(() => drawMascot(ctx, mascot({ mood: "worried" }))).not.toThrow();
  });

  it("未知 variant/mood 回落 doc/happy 不抛错", () => {
    const ctx = mockCtx();
    expect(() => drawMascot(ctx, mascot({ variant: "alien" as never, mood: "sleepy" as never }))).not.toThrow();
  });
});

describe("drawConfetti 纸屑", () => {
  it("rain 模式同种子同帧恒同(确定性)", () => {
    const a = mockCtx();
    const b = mockCtx();
    drawConfetti(a, confetti({ seed: 7, count: 40 }), 1.3);
    drawConfetti(b, confetti({ seed: 7, count: 40 }), 1.3);
    // 粒子走 fillRect:序列逐项相等 = 同种子同帧恒同;非空 = 确实画了粒子
    expect(a.rects.length).toBe(40);
    expect(a.rects).toEqual(b.rects);
  });

  it("不同种子撒法不同", () => {
    const a = mockCtx();
    const b = mockCtx();
    drawConfetti(a, confetti({ seed: 7, count: 40 }), 1.3);
    drawConfetti(b, confetti({ seed: 8, count: 40 }), 1.3);
    expect(a.rects).not.toEqual(b.rects);
  });

  it("burst 在 1.6s 后归于寂静(不再画粒子)", () => {
    const done = mockCtx();
    drawConfetti(done, confetti({ mode: "burst", seed: 3 }), 2.5);
    expect(done.rects.length).toBe(0);
    const mid = mockCtx();
    drawConfetti(mid, confetti({ mode: "burst", seed: 3 }), 0.8);
    expect(mid.rects.length).toBeGreaterThan(0);
  });

  it("count 越界钳到 10-200", () => {
    // normalize 负责钳制,绘制层对原始数据也要不崩:极大 count 不抛错
    const ctx = mockCtx();
    expect(() => drawConfetti(ctx, confetti({ count: 9999, seed: 1 }), 0.5)).not.toThrow();
  });
});
