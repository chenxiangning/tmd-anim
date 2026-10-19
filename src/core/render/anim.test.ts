import { describe, expect, it } from "vitest";
import { animVisual, applyTweens, emphasisFx, exitState, exitVisual } from "./anim";
import type { Anim, ArrayCellsElement, ProgressElement } from "../types";

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

describe("时间轴三段:离场/强调/补间", () => {
  it("exitState:窗口前 in、窗口内 out、窗口后 gone", () => {
    
    const exit = { type: "fadeOut" as const, start: 2, duration: 0.5 };
    expect(exitState(1.9, exit).phase).toBe("in");
    expect(exitState(2.25, exit).phase).toBe("out");
    expect(exitState(2.25, exit).q).toBeCloseTo(0.5);
    expect(exitState(2.6, exit).phase).toBe("gone");
  });

  it("exitVisual:fadeOut 终点全透明,wipeOut 宽度归零", () => {
    
    const fade = { type: "fadeOut" as const, start: 0, duration: 1 };
    expect(exitVisual(fade, 0).alpha).toBe(1);
    expect(exitVisual(fade, 1).alpha).toBeCloseTo(0);
    const wipe = { type: "wipeOut" as const, start: 0, duration: 1 };
    expect(exitVisual(wipe, 0.5).wipeWidth).toBeCloseTo(0.5);
    expect(exitVisual(wipe, 1).wipeWidth).toBeCloseTo(0);
  });

  it("emphasisFx:pulse 中点有缩放、事件外归零,叠加取合成", () => {
    
    const pulse = [{ type: "pulse" as const, start: 1, duration: 0.6 }];
    expect(emphasisFx(0.5, pulse).scaleMul).toBe(1);
    const mid = emphasisFx(1.3, pulse);
    expect(mid.scaleMul).toBeGreaterThan(1);
    expect(emphasisFx(2, pulse).scaleMul).toBe(1);
    const fx = emphasisFx(0.5, [
      { type: "shake" as const, start: 0, duration: 1, strength: 2 },
      { type: "glow" as const, start: 0, duration: 1 },
    ]);
    expect(fx.glow).toBeGreaterThan(0);
    expect(typeof fx.dx).toBe("number");
  });

  it("emphasisFx:highlightLines/dashFlow 只命中专属事件", () => {
    
    const fx = emphasisFx(0.5, [
      { type: "highlightLines" as const, start: 0, duration: 1, lines: [2, 4] },
      { type: "dashFlow" as const, start: 0, duration: 1 },
    ]);
    expect(fx.highlightLines?.lines).toEqual([2, 4]);
    expect(fx.dashFlow).toBeGreaterThan(0);
  });

  it("applyTweens:percent 从静态值插值,窗口外不拷贝原样返回", () => {
    const el: ProgressElement = {
      id: "p1", kind: "progress", x: 0, y: 0, w: 400, h: 60,
      percent: 20,
      anim: { type: "fade", start: 0, duration: 0.5 },
      tweens: [{ field: "percent", to: 80, start: 1, duration: 2, easing: "linear" }],
    };
    expect(applyTweens(el, 0.5)).toBe(el);
    const mid = applyTweens(el, 2) as ProgressElement;
    expect(mid.percent).toBeCloseTo(50);
    const done = applyTweens(el, 3.5) as ProgressElement;
    expect(done.percent).toBeCloseTo(80);
  });

  it("applyTweens:activeIndex 支持 from 覆盖", () => {
    const cells: ArrayCellsElement = {
      id: "c1", kind: "arrayCells", x: 0, y: 0, w: 400, h: 100,
      cells: ["a", "b", "c", "d"],
      anim: { type: "fade", start: 0, duration: 0.5 },
      tweens: [{ field: "activeIndex", from: 0, to: 3, start: 0, duration: 1 }],
    };
    expect((applyTweens(cells, 0.5) as ArrayCellsElement).activeIndex).toBeCloseTo(1.5);
  });
});
