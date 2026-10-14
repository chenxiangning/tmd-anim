import { describe, expect, it } from "vitest";
import { animVisual } from "./anim";
import type { Anim } from "../types";

const anim = (over: Partial<Anim>): Anim => ({ type: "fade", start: 0, duration: 1, ...over });

describe("animVisual", () => {
  it("slideRight 从右滑入:位移为正且渐显", () => {
    const v = animVisual(anim({ type: "slideRight" }), 0.5);
    expect(v.dx).toBeGreaterThan(0);
    expect(v.alpha).toBeGreaterThan(0);
    expect(v.alpha).toBeLessThan(1);
  });

  it("spinIn 带旋转与缩放,终点归零/归一", () => {
    const start = animVisual(anim({ type: "spinIn" }), 0.01);
    const end = animVisual(anim({ type: "spinIn" }), 1);
    expect(start.rotation).toBeLessThan(0);
    expect(start.scale).toBeLessThan(1);
    expect(end.rotation).toBeCloseTo(0);
    expect(end.scale).toBeCloseTo(1);
  });

  it("dropDown 从上方落下", () => {
    expect(animVisual(anim({ type: "dropDown" }), 0.2).dy).toBeLessThan(0);
    expect(animVisual(anim({ type: "dropDown" }), 1).dy).toBeCloseTo(0);
  });

  it("easing 字段覆盖类型默认缓动", () => {
    // riseUp 默认 easeOut,改 linear 后中点位移恰为一半
    expect(animVisual(anim({ type: "riseUp", easing: "linear" }), 0.5).dy).toBeCloseTo(23);
  });

  it("typewriter 进度线性暴露,pop 保持过冲缩放", () => {
    expect(animVisual(anim({ type: "typewriter" }), 0.5).progress).toBeCloseTo(0.5);
    expect(animVisual(anim({ type: "pop" }), 0.85).scale).toBeGreaterThan(1);
  });

  it("wipe 全程不透明,进度由缓动驱动", () => {
    expect(animVisual(anim({ type: "wipe" }), 0.3).alpha).toBe(1);
    expect(animVisual(anim({ type: "wipe" }), 1).wipeWidth).toBe(1);
  });
});
