import { describe, expect, it } from "vitest";
import type { DevNodeElement } from "../types";
import { DEV_META, drawDevNode } from "./devNode";

const anim = { type: "fade" as const, start: 0, duration: 0.1 };

const node = (over: Partial<DevNodeElement>): DevNodeElement => ({
  id: "n1",
  kind: "devNode",
  dev: "database",
  x: 100,
  y: 100,
  w: 300,
  h: 96,
  anim,
  ...over,
});

/** 记录 fillText 的 mock 上下文(其余方法空实现) */
function mockCtx() {
  const texts: Array<{ text: string; x: number; y: number }> = [];
  const noop = () => {};
  return {
    texts,
    fillText: (text: string, x: number, y: number) => texts.push({ text, x, y }),
    save: noop, restore: noop, beginPath: noop, closePath: noop,
    roundRect: noop, ellipse: noop, arc: noop, moveTo: noop, lineTo: noop,
    stroke: noop, fill: noop,
    globalAlpha: 1,
    fillStyle: "", strokeStyle: "", lineWidth: 1, lineJoin: "round", lineCap: "round",
    font: "", textAlign: "left", textBaseline: "middle",
  } as unknown as CanvasRenderingContext2D & { texts: Array<{ text: string; x: number; y: number }> };
}

describe("drawDevNode 开发组件节点", () => {
  it("无 label 时用变体中文名,副标题单独一行", () => {
    const ctx = mockCtx();
    drawDevNode(ctx, node({ sub: "MySQL 8.0" }));
    expect(ctx.texts.map((t) => t.text)).toEqual(["数据库", "MySQL 8.0"]);
  });

  it("label 覆盖变体名;无 sub 时只画一行", () => {
    const ctx = mockCtx();
    drawDevNode(ctx, node({ dev: "redis", label: "热点缓存" }));
    expect(ctx.texts.map((t) => t.text)).toEqual(["热点缓存"]);
  });

  it("未知 dev 值回落 server 机架,不抛错", () => {
    const ctx = mockCtx();
    drawDevNode(ctx, node({ dev: "unknown" as never }));
    expect(ctx.texts.length).toBeGreaterThan(0);
    // 缺省名取回落变体(server)
    expect(ctx.texts[0].text).toBe(DEV_META.server.name);
  });

  it("窄节点(w ≤ h+26)只画图标不画字,不出负 maxWidth", () => {
    const ctx = mockCtx();
    drawDevNode(ctx, node({ w: 120, h: 96 }));
    expect(ctx.texts).toEqual([]);
  });

  it("DEV_META 十四个变体齐全且各有主色", () => {
    for (const v of ["database", "redis", "obs", "cloud", "server", "api", "queue", "container", "gateway", "loadBalancer", "cdn", "auth", "function", "git"] as const) {
      expect(DEV_META[v].color).toMatch(/^#/);
      expect(DEV_META[v].name.length).toBeGreaterThan(0);
    }
  });
});
