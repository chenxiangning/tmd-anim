import { describe, expect, it } from "vitest";
import type { ShapeElement } from "../types";
import { traceShape } from "./shapeGeo";

const anim = { type: "fade" as const, start: 0, duration: 0.1 };

const shape = (over: Partial<ShapeElement>): ShapeElement => ({
  id: "s1",
  kind: "shape",
  shape: "rect",
  x: 100,
  y: 100,
  w: 300,
  h: 200,
  anim,
  ...over,
});

/** 记录 lineTo 点的 mock 2D 上下文(手绘路径全走 lineTo) */
function mockCtx() {
  const pts: Array<[number, number]> = [];
  let ellipseCalls = 0;
  return {
    pts,
    ellipseCalls: () => ellipseCalls,
    beginPath: () => {},
    moveTo: (x: number, y: number) => pts.push([x, y]),
    lineTo: (x: number, y: number) => pts.push([x, y]),
    closePath: () => {},
    ellipse: () => {
      ellipseCalls++;
    },
    roundRect: () => {},
  } as unknown as CanvasRenderingContext2D & { pts: Array<[number, number]>; ellipseCalls(): number };
}

describe("traceShape 手绘(sketch)模式", () => {
  it("同一 id 两次描迹完全一致(确定性纯函数)", () => {
    const a = mockCtx();
    const b = mockCtx();
    traceShape(a, shape({ sketch: true }));
    traceShape(b, shape({ sketch: true }));
    expect(a.pts).toEqual(b.pts);
  });

  it("不同 id 抖出不同轮廓", () => {
    const a = mockCtx();
    const b = mockCtx();
    traceShape(a, shape({ sketch: true }));
    traceShape(b, shape({ id: "s2", sketch: true }));
    expect(a.pts).not.toEqual(b.pts);
  });

  it("抖动有界:顶点偏离原始矩形轮廓 ≤10 逻辑像素,且不外扩超过 10", () => {
    const ctx = mockCtx();
    traceShape(ctx, shape({ sketch: true }));
    for (const [px, py] of ctx.pts) {
      // 原始 rect 100..400 × 100..300(圆角 24 的采样点也在此框内)
      expect(px).toBeGreaterThanOrEqual(90);
      expect(px).toBeLessThanOrEqual(410);
      expect(py).toBeGreaterThanOrEqual(90);
      expect(py).toBeLessThanOrEqual(310);
    }
    // 确实有抖动(不是所有点都落在无抖动的采样网格上)
    const exact = ctx.pts.filter(([px, py]) => Number.isInteger(px) && Number.isInteger(py));
    expect(exact.length).toBeLessThan(ctx.pts.length);
  });

  it("非手绘路径不受影响:ellipse 走原生椭圆,不走折线", () => {
    const ctx = mockCtx();
    traceShape(ctx, shape({ shape: "ellipse" }));
    expect(ctx.ellipseCalls()).toBe(1);
    expect(ctx.pts.length).toBe(0);
  });

  it("手绘 ellipse 用采样折线且闭合点数 ≥14", () => {
    const ctx = mockCtx();
    traceShape(ctx, shape({ shape: "ellipse", sketch: true }));
    expect(ctx.ellipseCalls()).toBe(0);
    expect(ctx.pts.length).toBeGreaterThanOrEqual(14);
  });

  it("手绘 cylinder 主体 + 顶面子路径都展开(抖动后顶面与主体抖得不同)", () => {
    const ctx = mockCtx();
    traceShape(ctx, shape({ shape: "cylinder", sketch: true }));
    // 主体(≈17 点)+ 顶面椭圆(13 点)
    expect(ctx.pts.length).toBeGreaterThanOrEqual(28);
  });

  it("显式 sketchSeed:同种子同轮廓,换种子换轮廓(与 id 无关)", () => {
    const a = mockCtx();
    const b = mockCtx();
    const c = mockCtx();
    traceShape(a, shape({ id: "s1", sketch: true, sketchSeed: 42 }));
    traceShape(b, shape({ id: "s1", sketch: true, sketchSeed: 42 }));
    traceShape(c, shape({ id: "s1", sketch: true, sketchSeed: 43 }));
    expect(a.pts).toEqual(b.pts);
    expect(a.pts).not.toEqual(c.pts);
  });

  it("极端 sketchSeed(1e15/负值)钳制后仍有界,坐标不出 NaN", () => {
    for (const seed of [1e15, -1e15, Number.MAX_SAFE_INTEGER]) {
      const ctx = mockCtx();
      traceShape(ctx, shape({ sketch: true, sketchSeed: seed }));
      expect(ctx.pts.length).toBeGreaterThan(0);
      for (const [px, py] of ctx.pts) {
        expect(Number.isFinite(px)).toBe(true);
        expect(Number.isFinite(py)).toBe(true);
      }
    }
  });
});
