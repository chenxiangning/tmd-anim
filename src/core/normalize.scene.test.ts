import { describe, expect, it } from "vitest";
import { normalizeProject } from "./normalize";

/** 场景级字段(转场/相机)与背景/逐字字段的宽容归一 */
describe("场景级归一", () => {
  it("场景转场:合法类型与时长钳位保留,非法丢弃", () => {
    const p = normalizeProject({
      version: 1,
      scenes: [
        { elements: [], transition: { type: "pushLeft", duration: 9 } },
        { elements: [], transition: { type: "nope" } },
        { elements: [] },
      ],
    });
    expect(p.scenes[0].transition).toEqual({ type: "pushLeft", duration: 2 });
    expect(p.scenes[1].transition).toBeUndefined();
    expect(p.scenes[2].transition).toBeUndefined();
  });

  it("场景相机:pose 收有限数并钳位,双端皆空丢弃,spring 缓动保留", () => {
    const p = normalizeProject({
      version: 1,
      scenes: [
        { elements: [], camera: { from: { zoom: 9, x: 1 }, to: { zoom: 0.2 }, easing: "spring" } },
        { elements: [], camera: { from: {} } },
        { elements: [], camera: { from: "x" } },
      ],
    });
    expect(p.scenes[0].camera).toEqual({ from: { zoom: 3, x: 1 }, to: { zoom: 1 }, easing: "spring" });
    expect(p.scenes[1].camera).toBeUndefined();
    expect(p.scenes[2].camera).toBeUndefined();
  });

  it("aurora 字段:colors 收 2-3 色,opacity/speed 钳位,seed 非数丢弃;kinetic 非布尔丢弃", () => {
    const p = normalizeProject({
      version: 1,
      scenes: [{ elements: [
        { kind: "aurora", colors: ["#818CF8", "#67E8F9", "#F9A8D4"], opacity: 5, speed: 0.01, seed: 3 },
        { kind: "aurora", colors: ["#FFF"] },
        { kind: "aurora", seed: "x" },
        { kind: "title", text: "t", kinetic: "yes" },
        { kind: "title", text: "t", kinetic: true },
      ] }],
    });
    const els = p.scenes[0].elements as unknown as Array<Record<string, unknown>>;
    expect(els[0].colors).toHaveLength(3);
    expect(els[0].opacity).toBe(1);
    expect(els[0].speed).toBe(0.1);
    expect(els[0].seed).toBe(3);
    expect("colors" in els[1]).toBe(false);
    expect("seed" in els[2]).toBe(false);
    expect("kinetic" in els[3]).toBe(false);
    expect(els[4].kinetic).toBe(true);
  });
});
