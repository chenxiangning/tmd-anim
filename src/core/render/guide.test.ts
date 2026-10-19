import { describe, expect, it } from "vitest";
import type { CodeDiffElement, CursorElement, FolderTreeElement } from "../types";
import { drawCodeDiff, drawCursor, drawFolderTree } from "./guide";

const anim = { type: "fade" as const, start: 0, duration: 1 };

/** 记录 fillText/stroke/arc/fillRect 的 mock 上下文(其余方法空实现) */
function mockCtx() {
  const texts: Array<{ text: string; x: number; y: number; style: string }> = [];
  const arcs: Array<{ x: number; y: number; r: number }> = [];
  const rects: Array<{ x: number; y: number; w: number; h: number; style: string }> = [];
  const fills: string[] = [];
  let strokes = 0;
  const noop = () => {};
  const self = {
    texts, arcs, rects,
    get strokes() { return strokes; },
    get fills() { return fills; },
    fillText: (text: string, x: number, y: number) => texts.push({ text, x, y, style: String(self.fillStyle) }),
    arc: (x: number, y: number, r: number) => arcs.push({ x, y, r }),
    fillRect: (x: number, y: number, w: number, h: number) => rects.push({ x, y, w, h, style: String(self.fillStyle) }),
    fill: () => { fills.push(String(self.fillStyle)); },
    stroke: () => { strokes += 1; },
    measureText: (text: string) => ({ width: text.length * 10 }),
    save: noop, restore: noop, beginPath: noop, closePath: noop, translate: noop, scale: noop,
    roundRect: noop, ellipse: noop, moveTo: noop, lineTo: noop, clip: noop,
    globalAlpha: 1,
    fillStyle: "", strokeStyle: "", lineWidth: 1, lineJoin: "round", lineCap: "round",
    font: "", textAlign: "left", textBaseline: "middle",
  } as unknown as CanvasRenderingContext2D & {
    texts: Array<{ text: string; x: number; y: number; style: string }>;
    arcs: Array<{ x: number; y: number; r: number }>;
    rects: Array<{ x: number; y: number; w: number; h: number; style: string }>;
    readonly strokes: number;
    readonly fills: string[];
  };
  return self;
}

const cursor = (over: Partial<CursorElement>): CursorElement => ({
  id: "c1", kind: "cursor", x: 0, y: 0, w: 40, h: 40,
  points: [[100, 100], [300, 100], [300, 300]],
  clicks: [0.5],
  anim,
  ...over,
});

const folder = (over: Partial<FolderTreeElement>): FolderTreeElement => ({
  id: "f1", kind: "folderTree", x: 100, y: 100, w: 400, h: 300,
  items: [
    { name: "src", icon: "dir" },
    { name: "guide.ts", depth: 1 },
    { name: "dist", icon: "dir", comment: "构建产物" },
  ],
  anim,
  ...over,
});

const diff = (over: Partial<CodeDiffElement>): CodeDiffElement => ({
  id: "d1", kind: "codeDiff", x: 100, y: 100, w: 600, h: 300,
  filename: "guide.ts",
  hunks: [
    { ctx: "@@ fn draw", lines: [{ tag: " ", text: "keep()" }, { tag: "-", text: "old()" }, { tag: "+", text: "new()" }] },
  ],
  anim,
  ...over,
});

describe("drawCursor 鼠标光标", () => {
  it("localT = start+duration 时停在末点,涟漪只画有效 click", () => {
    const ctx = mockCtx();
    // localT=1:click 0.5 的 dt=0.5 仍有效,1.2 无效
    drawCursor(ctx, cursor({ clicks: [0.5, 1.2] }), 1);
    expect(ctx.arcs.length).toBe(1);
    // 涟漪圆心 = click 时刻的 tip 位置(t=0.5 在第二段中点)
    expect(ctx.arcs[0].x).toBe(300);
    expect(ctx.arcs[0].y).toBe(100);
  });

  it("localT 早于所有 click 时不画涟漪", () => {
    const ctx = mockCtx();
    drawCursor(ctx, cursor({ clicks: [0.5] }), 0.2);
    expect(ctx.arcs.length).toBe(0);
    // 箭头本体仍绘制(填充白 + 描边黑)
    expect(ctx.strokes).toBeGreaterThanOrEqual(1);
  });
});

describe("drawFolderTree 文件树", () => {
  it("按 items 行数画名称文本,root 缺省用 project", () => {
    const ctx = mockCtx();
    drawFolderTree(ctx, folder({}));
    const names = ctx.texts.filter((t) => ["src", "guide.ts", "dist"].includes(t.text));
    expect(names).toHaveLength(3);
    expect(ctx.texts[0].text).toBe("project");
    // comment 跟在名称后
    expect(ctx.texts.some((t) => t.text.includes("// 构建产物"))).toBe(true);
  });

  it("progress 控制逐行显隐:0.2 只显第一行", () => {
    const ctx = mockCtx();
    drawFolderTree(ctx, folder({}), 0.2);
    const names = ctx.texts.filter((t) => ["src", "guide.ts", "dist"].includes(t.text));
    expect(names.map((t) => t.text)).toEqual(["src"]);
  });
});

describe("drawCodeDiff 代码 diff", () => {
  it("画出 + 与 - 前缀文本及 ctx 行", () => {
    const ctx = mockCtx();
    drawCodeDiff(ctx, diff({}));
    const texts = ctx.texts.map((t) => t.text);
    expect(texts).toContain("+ new()");
    expect(texts).toContain("- old()");
    expect(texts).toContain("@@ fn draw");
    expect(ctx.texts.some((t) => t.text === "guide.ts")).toBe(true);
    // 增删行各画一行底色
    expect(ctx.rects.length).toBeGreaterThanOrEqual(2);
  });

  it("progress 控制逐行显隐:0.5 只显前两行", () => {
    const ctx = mockCtx();
    drawCodeDiff(ctx, diff({}), 0.5);
    const texts = ctx.texts.map((t) => t.text);
    expect(texts).toContain("@@ fn draw");
    expect(texts).toContain("keep()");
    expect(texts).not.toContain("+ new()");
    expect(texts).not.toContain("- old()");
  });

  it("dark:false 浅色主题:白底、调浅行色与行底", () => {
    const ctx = mockCtx();
    drawCodeDiff(ctx, diff({ dark: false }));
    // 窗口底色(fill)
    expect(ctx.fills[0]).toBe("#FFFFFF");
    // 增删行底色 alpha 0.12
    const bgs = ctx.rects.map((r) => r.style);
    expect(bgs).toContain("rgba(34,197,94,0.12)");
    expect(bgs).toContain("rgba(239,68,68,0.12)");
    // 深绿/深红前缀字
    expect(ctx.texts.find((t) => t.text === "+ new()")?.style).toBe("#16A34A");
    expect(ctx.texts.find((t) => t.text === "- old()")?.style).toBe("#DC2626");
    expect(ctx.texts.find((t) => t.text === "keep()")?.style).toBe("#334155");
  });
});
