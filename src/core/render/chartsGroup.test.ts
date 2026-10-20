import { describe, expect, it } from "vitest";
import type { BarChartElement } from "../types";
import { drawGroupedBar } from "./chartsGroup";

const anim = { type: "fade" as const, start: 0, duration: 0.1 };

/** 记录 roundRect 几何与文本的 mock 上下文;rects 用于断言柱体位置 */
function mockCtx() {
  const rects: Array<{ x: number; y: number; w: number; h: number }> = [];
  const texts: string[] = [];
  const noop = () => {};
  return {
    rects,
    texts,
    fillText: (t: string) => texts.push(String(t)),
    measureText: (t: string) => ({ width: String(t).length * 10 }),
    roundRect: (x: number, y: number, w: number, h: number) => rects.push({ x, y, w, h }),
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, stroke: noop, fill: noop,
    arc: noop, save: noop, restore: noop, clip: noop, setLineDash: noop,
    quadraticCurveTo: noop, bezierCurveTo: noop, fillRect: noop,
    globalAlpha: 1,
    fillStyle: "", strokeStyle: "", lineWidth: 1, lineJoin: "round", lineCap: "round",
    font: "", textAlign: "left", textBaseline: "middle",
  } as unknown as CanvasRenderingContext2D & { rects: Array<{ x: number; y: number; w: number; h: number }>; texts: string[] };
}

const grouped = (over: Partial<BarChartElement>): BarChartElement => ({
  id: "g1", kind: "barChart", x: 0, y: 0, w: 900, h: 500,
  groups: [
    { label: "Code", values: [40, 60, 80], deltas: [null, null, "+7.4"] },
    { label: "Web", values: [50, 70, 90], deltas: [null, null, "+8.4"] },
  ],
  groupSeries: ["基线", "缓存", "缓存+预取"],
  anim,
  ...over,
});

/** 柱体与增益药丸/图例芯片共用 roundRect:按高度筛出柱体(药丸 32px、图例芯片 12px 都远矮于最矮柱) */
function barsOf(ctx: { rects: Array<{ x: number; y: number; w: number; h: number }> }) {
  return ctx.rects.filter((r) => r.h > 40);
}

describe("drawGroupedBar", () => {
  it("所有柱底贴在同一条基线上(回归:柱顶曾多减一次高度导致整体下沉)", () => {
    const ctx = mockCtx();
    drawGroupedBar(ctx, grouped({}));
    const bars = barsOf(ctx);
    expect(bars).toHaveLength(6);
    const bottoms = bars.map((b) => b.y + b.h);
    for (const bottom of bottoms) expect(Math.abs(bottom - bottoms[0])).toBeLessThan(0.5);
    // 柱底必须落在绘图区底边以内(不能戳出元素框)
    for (const b of bars) expect(b.y + b.h).toBeLessThanOrEqual(500);
  });

  it("柱高与数值成正比,且都在元素框内", () => {
    const ctx = mockCtx();
    drawGroupedBar(ctx, grouped({}));
    const bars = barsOf(ctx);
    expect(bars[5].h).toBeGreaterThan(bars[0].h);
    expect(bars[5].h / bars[0].h).toBeCloseTo(90 / 40, 1);
    for (const b of bars) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(900);
    }
  });

  it("progress 从基线向上生长:柱底不动,柱高变小", () => {
    const full = mockCtx();
    drawGroupedBar(full, grouped({}));
    const half = mockCtx();
    drawGroupedBar(half, grouped({}), 0.1);
    const f = barsOf(full);
    const h = barsOf(half).filter((b) => b.h > 0);
    expect(Math.abs((f[0].y + f[0].h) - (h[0].y + h[0].h))).toBeLessThan(0.5);
    expect(h[0].h).toBeLessThan(f[0].h);
  });

  it("组内柱数不一致时按最多柱数分宽,柱体不越界", () => {
    const ctx = mockCtx();
    drawGroupedBar(ctx, grouped({
      groups: [
        { label: "A", values: [10, 20] },
        { label: "B", values: [10, 20, 30, 40] },
      ],
    }));
    const bars = barsOf(ctx);
    expect(bars).toHaveLength(6);
    for (const b of bars) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(900);
    }
    // B 组 4 根柱互不重叠
    for (let i = 3; i < bars.length; i++) expect(bars[i].x).toBeGreaterThanOrEqual(bars[i - 1].x + bars[i - 1].w - 0.5);
  });

  it("脏数据(组缺 values)不抛错,只画合法组", () => {
    const ctx = mockCtx();
    const bad = { groups: [{ label: "空" }, { label: "B", values: [10] }] } as unknown as Partial<BarChartElement>;
    expect(() => drawGroupedBar(ctx, grouped(bad))).not.toThrow();
    expect(ctx.texts).toContain("B");
    expect(ctx.texts).not.toContain("空");
  });

  it("deltas 非空时画增益药丸文字", () => {
    const ctx = mockCtx();
    drawGroupedBar(ctx, grouped({}));
    expect(ctx.texts).toContain("+7.4");
    expect(ctx.texts).toContain("+8.4");
  });
});
