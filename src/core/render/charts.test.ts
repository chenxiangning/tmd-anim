import { describe, expect, it } from "vitest";
import type { BarChartElement, LineChartElement, PieChartElement } from "../types";
import { drawBarChart, drawLineChart, drawPieChart } from "./charts";

const anim = { type: "fade" as const, start: 0, duration: 0.1 };

/** 记录 fillText/fillRect/arc 的 mock 上下文(与 devNode.test.ts 同一套路) */
function mockCtx() {
  const texts: string[] = [];
  const fills: string[] = [];
  const arcs: number[] = [];
  const noop = () => {};
  return {
    texts,
    fills,
    arcs,
    fillText: (t: string) => texts.push(String(t)),
    fillRect: noop,
    measureText: (t: string) => ({ width: String(t).length * 10 }),
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, stroke: noop, fill: noop,
    arc: (_x: number, _y: number, r: number) => arcs.push(r),
    roundRect: noop, save: noop, restore: noop, clip: noop,
    quadraticCurveTo: noop, bezierCurveTo: noop,
    setLineDash: noop,
    globalAlpha: 1,
    fillStyle: "", strokeStyle: "", lineWidth: 1, lineJoin: "round", lineCap: "round",
    font: "", textAlign: "left", textBaseline: "middle", shadowBlur: 0, shadowColor: "",
  } as unknown as CanvasRenderingContext2D & { texts: string[]; fills: string[]; arcs: number[] };
}

const bar = (over: Partial<BarChartElement>): BarChartElement => ({
  id: "b1", kind: "barChart", x: 0, y: 0, w: 600, h: 400,
  series: [
    { label: "甲", value: 30 },
    { label: "乙", value: 80 },
  ],
  anim,
  ...over,
});

describe("drawBarChart", () => {
  it("画标题与全部类别名与数值", () => {
    const ctx = mockCtx();
    drawBarChart(ctx, bar({ title: "性能对比", showValue: true }));
    expect(ctx.texts).toContain("性能对比");
    expect(ctx.texts).toContain("甲");
    expect(ctx.texts).toContain("乙");
    expect(ctx.texts).toContain("30");
    expect(ctx.texts).toContain("80");
  });

  it("progress=0 时不画数值标签(柱尚未生长)", () => {
    const ctx = mockCtx();
    drawBarChart(ctx, bar({ showValue: true }), 0);
    expect(ctx.texts).not.toContain("30");
    expect(ctx.texts).not.toContain("80");
  });
});

describe("drawLineChart", () => {
  it("多序列画图例,超 3 条截断", () => {
    const ctx = mockCtx();
    const el: LineChartElement = {
      id: "l1", kind: "lineChart", x: 0, y: 0, w: 600, h: 400,
      series: [
        { label: "CPU", points: [1, 3, 2] },
        { label: "MEM", points: [2, 1, 4] },
        { label: "IO", points: [0, 2, 1] },
        { label: "NET", points: [1, 1, 1] },
      ],
      anim,
    };
    drawLineChart(ctx, el);
    expect(ctx.texts).toContain("CPU");
    expect(ctx.texts).toContain("MEM");
    expect(ctx.texts).toContain("IO");
    expect(ctx.texts).not.toContain("NET");
  });

  it("progress 中段只画部分点(arc 点数 < 总点数)", () => {
    const ctx = mockCtx();
    const el: LineChartElement = {
      id: "l2", kind: "lineChart", x: 0, y: 0, w: 600, h: 400,
      series: [{ label: "A", points: [1, 2, 3, 4, 5] }],
      anim,
    };
    drawLineChart(ctx, el, 0.4);
    expect(ctx.arcs.length).toBeLessThan(5);
    expect(ctx.arcs.length).toBeGreaterThan(0);
  });

  it("smooth 曲线穿过每个数据点(圆点不飘在线外)", () => {
    // 旧实现用「中点二次贝塞尔」:曲线只穿过相邻点的中点,数据点圆点会落在曲线外侧。
    const dots: Array<{ x: number; y: number }> = [];
    const ends: Array<{ x: number; y: number }> = [];
    const r = 26 * 0.16; // 数据点半径(缺省 fontSize 26)
    const ctx = {
      ...mockCtx(),
      arc: (x: number, y: number, radius: number) => {
        if (Math.abs(radius - r) < 1e-6) dots.push({ x, y });
      },
      // 首点由 moveTo 起笔,其余点为各段贝塞尔终点,两者都算「曲线经过的点」
      moveTo: (x: number, y: number) => ends.push({ x, y }),
      bezierCurveTo: (_a: number, _b: number, _c: number, _d: number, x: number, y: number) => {
        ends.push({ x, y });
      },
    } as unknown as CanvasRenderingContext2D;
    drawLineChart(ctx, {
      id: "l3", kind: "lineChart", x: 0, y: 0, w: 600, h: 400,
      smooth: true,
      series: [{ label: "A", points: [3, 7, 2, 8, 5] }],
      anim,
    });
    expect(dots).toHaveLength(5);
    for (const d of dots) {
      const hit = ends.some((e) => Math.abs(e.x - d.x) < 0.01 && Math.abs(e.y - d.y) < 0.01);
      expect(hit).toBe(true);
    }
  });
});

describe("drawPieChart", () => {
  it("画图例标签与百分比,过滤非正 slice", () => {
    const ctx = mockCtx();
    const el: PieChartElement = {
      id: "p1", kind: "pieChart", x: 0, y: 0, w: 600, h: 400,
      slices: [
        { label: "缓存命中", value: 80 },
        { label: "回源", value: 20 },
        { label: "零值", value: 0 },
      ],
      anim,
    };
    drawPieChart(ctx, el);
    expect(ctx.texts.some((t) => t.includes("缓存命中"))).toBe(true);
    expect(ctx.texts.some((t) => t.includes("回源"))).toBe(true);
    expect(ctx.texts.some((t) => t.includes("80%"))).toBe(true);
    expect(ctx.texts.some((t) => t.includes("零值"))).toBe(false);
  });
});
