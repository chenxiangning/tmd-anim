import { describe, expect, it } from "vitest";
import type { AuroraBgElement } from "../types";
import { drawAurora } from "./stage";

const anim = { type: "fade" as const, start: 0, duration: 0.1 };

const aurora = (over: Partial<AuroraBgElement>): AuroraBgElement => ({
  id: "a1",
  kind: "aurora",
  x: 0,
  y: 0,
  w: 1920,
  h: 1080,
  anim,
  ...over,
});

/** 记录径向渐变与填充区域的 mock 上下文 */
function mockCtx() {
  const gradients: Array<{ stops: Array<[number, string]> }> = [];
  const rects: Array<[number, number, number, number]> = [];
  return {
    gradients,
    rects,
    save: () => {},
    restore: () => {},
    fillRect: (x: number, y: number, w: number, h: number) => rects.push([x, y, w, h]),
    createRadialGradient: () => {
      const g = { stops: [] as Array<[number, string]>, addColorStop: (o: number, c: string) => g.stops.push([o, c]) };
      gradients.push(g);
      return g;
    },
    globalAlpha: 1,
    fillStyle: "",
  } as unknown as CanvasRenderingContext2D & { gradients: Array<{ stops: Array<[number, string]> }>; rects: Array<[number, number, number, number]> };
}

describe("drawAurora 极光背景", () => {
  it("每色一团渐变,填充覆盖元素区域,端点 1→0 透明", () => {
    const ctx = mockCtx();
    drawAurora(ctx, aurora({ colors: ["#818CF8", "#67E8F9"] }), 3);
    expect(ctx.gradients).toHaveLength(2);
    expect(ctx.rects).toHaveLength(2);
    for (const g of ctx.gradients) {
      expect(g.stops[0]?.[0]).toBe(0);
      expect(g.stops[1]?.[0]).toBe(1);
      expect(g.stops[1]?.[1]).toContain("rgba(");
      expect(g.stops[1]?.[1]).toContain(", 0)");
    }
    for (const [x, y, w, h] of ctx.rects) {
      expect([x, y, w, h]).toEqual([0, 0, 1920, 1080]);
    }
  });

  it("同 seed 同时刻恒同画面(导出确定性),缺省色 3 团", () => {
    const a = mockCtx();
    const b = mockCtx();
    drawAurora(a, aurora({ seed: 5 }), 7.5);
    drawAurora(b, aurora({ seed: 5 }), 7.5);
    expect(a.rects).toHaveLength(3);
    expect(b.rects).toHaveLength(3);
    expect(a.gradients.map((g) => g.stops)).toEqual(b.gradients.map((g) => g.stops));
  });
});
