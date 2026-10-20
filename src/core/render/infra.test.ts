import { describe, expect, it } from "vitest";
import type { ChipRowElement, LoopArrowElement, RingNodeElement, StackListElement } from "../types";
import { drawLoopArrow } from "./arrows";
import { drawChipRow, drawRingNode, drawStackList } from "./infra";

const noop = () => {};

/** 记录文本、字串字号、路径点与弧的 mock 上下文 */
function mockCtx() {
  const texts: string[] = [];
  const sizes: number[] = [];
  const pts: Array<[number, number]> = [];
  let font = "";
  let arcs = 0;
  return {
    texts,
    sizes,
    pts,
    arcs: () => arcs,
    fillText: (t: string) => {
      texts.push(String(t));
      const m = /(\d+(?:\.\d+)?)px/.exec(font);
      sizes.push(m ? Number(m[1]) : 0);
    },
    measureText: (t: string) => ({ width: String(t).length * 12 }),
    roundRect: noop, rect: noop, clip: noop, fillRect: noop,
    beginPath: noop, closePath: noop, stroke: noop, fill: noop, save: noop, restore: noop,
    setLineDash: noop, quadraticCurveTo: noop,
    arc: () => { arcs += 1; },
    moveTo: (x: number, y: number) => { pts.push([x, y]); },
    lineTo: (x: number, y: number) => { pts.push([x, y]); },
    arcTo: (x: number, y: number) => { pts.push([x, y]); },
    get font() { return font; },
    set font(v: string) { font = v; },
    globalAlpha: 1, fillStyle: "", strokeStyle: "", lineWidth: 1, lineJoin: "round", lineCap: "round",
    textAlign: "left", textBaseline: "middle",
  } as unknown as CanvasRenderingContext2D & { texts: string[]; sizes: number[]; pts: Array<[number, number]>; arcs: () => number };
}

const chipRow = (over: Partial<ChipRowElement>): ChipRowElement => ({
  id: "c1", kind: "chipRow", x: 100, y: 50, w: 600, h: 56,
  items: [{ text: "DOM 1", color: "#84CC16" }, { text: "INV 1", color: "#3B82F6", style: "outline" }],
  anim: { type: "fade", start: 0, duration: 0.1 },
  ...over,
});

describe("drawChipRow", () => {
  it("横向依次排布,首枚贴 el.x", () => {
    const ctx = mockCtx();
    drawChipRow(ctx, chipRow({}));
    expect(ctx.texts).toEqual(["DOM 1", "INV 1"]);
    expect(ctx.pts.length).toBe(0);
  });

  it("typewriter 逐枚显现:进度只到第一枚时第二枚不画", () => {
    const ctx = mockCtx();
    drawChipRow(ctx, chipRow({}), 0.5);
    expect(ctx.texts).toEqual(["DOM 1"]);
  });

  it("空 items 直接返回(不设状态、不抛错)", () => {
    const ctx = mockCtx();
    expect(() => drawChipRow(ctx, chipRow({ items: [] }))).not.toThrow();
    expect(ctx.texts).toHaveLength(0);
  });
});

const ring = (over: Partial<RingNodeElement>): RingNodeElement => ({
  id: "r1", kind: "ringNode", x: 0, y: 0, w: 300, h: 300,
  label: "模型", sub: "冻结", fontSize: 30,
  anim: { type: "fade", start: 0, duration: 0.1 },
  ...over,
});

describe("drawRingNode", () => {
  it("主文字与副文字都画,且字号按环内宽度收敛", () => {
    const ctx = mockCtx();
    drawRingNode(ctx, ring({}));
    expect(ctx.texts).toEqual(["模型", "冻结"]);
    expect(ctx.sizes[0]).toBe(30);
    const long = mockCtx();
    drawRingNode(long, ring({ label: "A very long model name here", fontSize: 30 }));
    expect(long.sizes[0]).toBeLessThan(30);
    expect(long.sizes[0]).toBeGreaterThanOrEqual(11);
  });

  it("无 sub 时只画一行", () => {
    const ctx = mockCtx();
    drawRingNode(ctx, ring({ sub: undefined }));
    expect(ctx.texts).toEqual(["模型"]);
  });
});

const stack = (over: Partial<StackListElement>): StackListElement => ({
  id: "s1", kind: "stackList", x: 0, y: 0, w: 300, h: 460,
  label: "执行记录", keys: ["1", "K"], sheets: 2,
  anim: { type: "fade", start: 0, duration: 0.1 },
  ...over,
});

describe("drawStackList", () => {
  it("画标题、两段编号与段间三点省略号", () => {
    const ctx = mockCtx();
    drawStackList(ctx, stack({}));
    expect(ctx.texts).toEqual(["执行记录", "1", "K"]);
    expect(ctx.arcs()).toBe(3);
  });

  it("单段时不出省略号;ellipsis:false 同理", () => {
    const one = mockCtx();
    drawStackList(one, stack({ keys: ["全部"] }));
    expect(one.arcs()).toBe(0);
    expect(one.texts).toEqual(["执行记录", "全部"]);
    const off = mockCtx();
    drawStackList(off, stack({ ellipsis: false }));
    expect(off.arcs()).toBe(0);
  });

  it("typewriter 逐段显现", () => {
    const ctx = mockCtx();
    drawStackList(ctx, stack({}), 0.5);
    expect(ctx.texts).toEqual(["执行记录", "1"]);
  });
});

describe("drawLoopArrow", () => {
  const loop = (over: Partial<LoopArrowElement>): LoopArrowElement => ({
    id: "l1", kind: "loopArrow", x: 0, y: 0, w: 400, h: 200,
    from: [100, 100], to: [400, 100], side: "bottom", depth: 80,
    anim: { type: "fade", start: 0, duration: 0.1 },
    ...over,
  });

  it("折返段伸到 from/to 之下(不是两点直连)", () => {
    const ctx = mockCtx();
    drawLoopArrow(ctx, loop({}));
    // 折返段在 from/to 下方 depth 处(拐角走 arcTo,取到的是拐角点)
    expect(Math.max(...ctx.pts.map((p) => p[1]))).toBeGreaterThanOrEqual(180);
    // 端点与箭头都在 from/to 附近(箭头三角会略微越出终点)
    expect(Math.min(...ctx.pts.map((p) => p[0]))).toBeGreaterThanOrEqual(100);
    expect(Math.max(...ctx.pts.map((p) => p[0]))).toBeLessThan(420);
  });

  it("side:top 时折返段在上方;dash 不影响路径", () => {
    const ctx = mockCtx();
    drawLoopArrow(ctx, loop({ side: "top", dash: true }));
    expect(Math.min(...ctx.pts.map((p) => p[1]))).toBeLessThan(100);
  });

  it("label 画成白底胶囊文字", () => {
    const ctx = mockCtx();
    drawLoopArrow(ctx, loop({ label: "下一轮" }));
    expect(ctx.texts).toContain("下一轮");
  });
});
