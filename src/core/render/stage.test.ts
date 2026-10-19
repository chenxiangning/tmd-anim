import { describe, expect, it } from "vitest";
import type { GridBgElement, GroupPanelElement, LaneElement, SpotlightElement } from "../types";
import { drawGridBg, drawGroupPanel, drawLane, drawSpotlight } from "./stage";

const anim = { type: "fade" as const, start: 0, duration: 0.1 };

/** 记录调用序列的 mock 上下文(其余方法空实现,measureText 按字符数近似) */
function mockCtx() {
  const texts: Array<{ text: string; x: number; y: number }> = [];
  const fills: unknown[][] = [];
  const fillStyles: string[] = [];
  const fillRects: Array<{ x: number; y: number; w: number; h: number }> = [];
  const lineTos: Array<{ x: number; y: number }> = [];
  const dashes: number[][] = [];
  const noop = () => {};
  let fillStyleValue = "";
  const mock = {
    texts, fills, fillStyles, fillRects, lineTos, dashes,
    fillText: (text: string, x: number, y: number) => texts.push({ text, x, y }),
    fill: (...args: unknown[]) => {
      fills.push(args);
      fillStyles.push(fillStyleValue);
    },
    fillRect: (x: number, y: number, w: number, h: number) => fillRects.push({ x, y, w, h }),
    lineTo: (x: number, y: number) => lineTos.push({ x, y }),
    setLineDash: (d: number[]) => dashes.push(d),
    save: noop, restore: noop, beginPath: noop, closePath: noop,
    rect: noop, roundRect: noop, ellipse: noop, arc: noop, moveTo: noop, stroke: noop,
    measureText: (text: string) => ({ width: text.length * 12 }),
    globalAlpha: 1,
    get fillStyle() { return fillStyleValue; },
    set fillStyle(v: string) { fillStyleValue = v; },
    strokeStyle: "", lineWidth: 1, lineJoin: "round", lineCap: "round",
    font: "", textAlign: "left", textBaseline: "middle",
  } as unknown as CanvasRenderingContext2D & {
    texts: Array<{ text: string; x: number; y: number }>;
    fills: unknown[][];
    fillStyles: string[];
    fillRects: Array<{ x: number; y: number; w: number; h: number }>;
    lineTos: Array<{ x: number; y: number }>;
    dashes: number[][];
  };
  return mock;
}

const spot = (over: Partial<SpotlightElement>): SpotlightElement => ({
  id: "s1", kind: "spotlight", x: 100, y: 100, w: 400, h: 200, anim, ...over,
});

describe("drawSpotlight 聚光暗角", () => {
  it("fillStyle 用 strength 换算 rgba,且以 evenodd 规则填充挖孔", () => {
    const ctx = mockCtx();
    drawSpotlight(ctx, spot({ strength: 0.65 }));
    expect(ctx.fillStyle).toBe("rgba(15,23,42,0.65)");
    expect(ctx.fills.length).toBe(1);
    expect(ctx.fills[0]).toContain("evenodd");
  });

  it("strength 缺省 0.65;椭圆孔与矩形孔都只产生一次 evenodd 填充", () => {
    const ctxRect = mockCtx();
    drawSpotlight(ctxRect, spot({}));
    expect(ctxRect.fillStyle).toBe("rgba(15,23,42,0.65)");
    const ctxEllipse = mockCtx();
    drawSpotlight(ctxEllipse, spot({ shape: "ellipse" }));
    expect(ctxEllipse.fills.length).toBe(1);
    expect(ctxEllipse.fills[0]).toContain("evenodd");
  });
});

describe("drawGridBg 网格背景", () => {
  it("细线模式下线数 = (w/step+1) + (h/step+1)", () => {
    const ctx = mockCtx();
    const el: GridBgElement = { id: "g1", kind: "gridBg", x: 0, y: 0, w: 400, h: 200, anim };
    drawGridBg(ctx, el);
    expect(ctx.lineTos.length).toBe(400 / 40 + 1 + (200 / 40 + 1));
  });

  it("axis=true 时额外画过中心的两条加重线", () => {
    const ctx = mockCtx();
    const el: GridBgElement = { id: "g2", kind: "gridBg", x: 0, y: 0, w: 400, h: 200, axis: true, anim };
    drawGridBg(ctx, el);
    const base = 400 / 40 + 1 + (200 / 40 + 1);
    expect(ctx.lineTos.length).toBe(base + 2);
    expect(ctx.strokeStyle).toContain("0.6");
  });

  it("dot=true 时不画细线,改画交点小圆", () => {
    const ctx = mockCtx();
    const el: GridBgElement = { id: "g3", kind: "gridBg", x: 0, y: 0, w: 80, h: 80, dot: true, anim };
    drawGridBg(ctx, el);
    expect(ctx.lineTos.length).toBe(0);
  });
});

describe("drawGroupPanel 分组面板", () => {
  it("有 title 时画出 title 文本,胶囊用 accent 填充", () => {
    const ctx = mockCtx();
    const el: GroupPanelElement = { id: "p1", kind: "groupPanel", x: 50, y: 50, w: 500, h: 300, title: "订单链路", anim };
    drawGroupPanel(ctx, el);
    expect(ctx.texts.map((t) => t.text)).toContain("订单链路");
    expect(ctx.fillStyles).toContain("#3B82F6");
  });

  it("无 title 时不画任何文本", () => {
    const ctx = mockCtx();
    const el: GroupPanelElement = { id: "p2", kind: "groupPanel", x: 50, y: 50, w: 500, h: 300, anim };
    drawGroupPanel(ctx, el);
    expect(ctx.texts).toEqual([]);
  });
});

describe("drawLane 泳道", () => {
  it("count=3 时 fillRect 次数 ≥ 3", () => {
    const ctx = mockCtx();
    const el: LaneElement = { id: "l1", kind: "lane", x: 0, y: 0, w: 600, h: 300, count: 3, anim };
    drawLane(ctx, el);
    expect(ctx.fillRects.length).toBeGreaterThanOrEqual(3);
  });

  it("labels 驱动标签文本与分隔虚线", () => {
    const ctx = mockCtx();
    const el: LaneElement = { id: "l2", kind: "lane", x: 0, y: 0, w: 600, h: 300, labels: ["研发", "测试", "上线"], anim };
    drawLane(ctx, el);
    expect(ctx.texts.map((t) => t.text)).toEqual(["研发", "测试", "上线"]);
    expect(ctx.dashes).toContainEqual([6, 6]);
  });

  it("direction=v 时纵向排带,fillRect 次数同样等于 count", () => {
    const ctx = mockCtx();
    const el: LaneElement = { id: "l3", kind: "lane", x: 0, y: 0, w: 600, h: 300, count: 4, direction: "v", anim };
    drawLane(ctx, el);
    expect(ctx.fillRects.length).toBe(4);
  });
});
