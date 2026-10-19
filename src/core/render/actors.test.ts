import { describe, expect, it } from "vitest";
import type { AvatarElement, PersonElement } from "../types";
import { drawAvatar, drawPerson } from "./actors";

const anim = { type: "fade" as const, start: 0, duration: 0.1 };

const avatar = (over: Partial<AvatarElement>): AvatarElement => ({
  id: "a1",
  kind: "avatar",
  x: 100,
  y: 100,
  w: 240,
  h: 80,
  anim,
  ...over,
});

const person = (over: Partial<PersonElement>): PersonElement => ({
  id: "p1",
  kind: "person",
  x: 100,
  y: 100,
  w: 120,
  h: 200,
  anim,
  ...over,
});

/** 记录 fillText / arc 的 mock 上下文(其余方法空实现) */
function mockCtx() {
  const texts: string[] = [];
  const arcs: Array<{ x: number; y: number; r: number }> = [];
  const noop = () => {};
  return {
    texts,
    arcs,
    fillText: (text: string) => texts.push(text),
    arc: (x: number, y: number, r: number) => arcs.push({ x, y, r }),
    save: noop, restore: noop, beginPath: noop, closePath: noop,
    roundRect: noop, ellipse: noop, moveTo: noop, lineTo: noop,
    stroke: noop, fill: noop, clip: noop, drawImage: noop,
    translate: noop, rotate: noop,
    measureText: (text: string) => ({ width: text.length * 12 }) as TextMetrics,
    globalAlpha: 1,
    fillStyle: "", strokeStyle: "", lineWidth: 1, lineJoin: "round", lineCap: "round",
    font: "", textAlign: "left", textBaseline: "middle",
  } as unknown as CanvasRenderingContext2D & { texts: string[]; arcs: Array<{ x: number; y: number; r: number }> };
}

describe("drawAvatar 头像", () => {
  it("无 src 时画 name 首字符作 initials", () => {
    const ctx = mockCtx();
    drawAvatar(ctx, avatar({ name: "阿明" }));
    expect(ctx.texts).toContain("阿");
  });

  it("无 src 且无 name 时画 \"?\"", () => {
    const ctx = mockCtx();
    drawAvatar(ctx, avatar({}));
    expect(ctx.texts).toContain("?");
  });

  it("initials 显式给出时优先于 name 首字符", () => {
    const ctx = mockCtx();
    drawAvatar(ctx, avatar({ name: "阿明", initials: "AM" }));
    expect(ctx.texts).toContain("AM");
    expect(ctx.texts).not.toContain("阿");
  });

  it("有 name 时画名称文本", () => {
    const ctx = mockCtx();
    drawAvatar(ctx, avatar({ name: "后端服务" }));
    expect(ctx.texts).toContain("后端服务");
  });

  it("status 点画白环 + 色点两个同心圆", () => {
    const ctx = mockCtx();
    drawAvatar(ctx, avatar({ status: "online" }));
    // 头像本体圆 + 白环 + 色点 = 3 个圆
    expect(ctx.arcs.length).toBe(3);
    expect(ctx.arcs[1].r).toBeCloseTo(ctx.arcs[2].r + 3);
  });

  it("无 status / 无 name 时只画头像本体圆与 initials", () => {
    const ctx = mockCtx();
    drawAvatar(ctx, avatar({}));
    expect(ctx.arcs.length).toBe(1);
    expect(ctx.texts).toEqual(["?"]);
  });
});

describe("drawPerson 方块人", () => {
  it("think 姿态画思考泡 \"?\"", () => {
    const ctx = mockCtx();
    drawPerson(ctx, person({ pose: "think" }));
    expect(ctx.texts).toContain("?");
  });

  it("point 姿态不画 \"?\"", () => {
    const ctx = mockCtx();
    drawPerson(ctx, person({ pose: "point" }));
    expect(ctx.texts).not.toContain("?");
  });

  it("stand 姿态不画 \"?\"(缺省即 stand)", () => {
    const ctx = mockCtx();
    drawPerson(ctx, person({}));
    expect(ctx.texts).not.toContain("?");
  });
});
