import { describe, expect, it } from "vitest";
import { ProjectParseError, normalizeProject } from "./normalize";

describe("normalizeProject", () => {
  it("补默认值:anim 缺省为 fade/0/0.5,dwell 缺省 1.5", () => {
    const p = normalizeProject({
      version: 1,
      name: "t",
      scenes: [{ id: "sc", name: "s", elements: [{ kind: "badge", text: "x" }] }],
    });
    const el = p.scenes[0].elements[0];
    expect(el.anim).toEqual({ type: "fade", start: 0, duration: 0.5 });
    expect(p.scenes[0].dwell).toBe(1.5);
    expect(el.id).toBe("el-1");
  });

  it("钳边界:start 负值归零,duration 下限 0.05,未知动画类型回落 fade", () => {
    const p = normalizeProject({
      version: 1,
      scenes: [
        {
          elements: [
            { kind: "badge", text: "x", anim: { type: "nope", start: -3, duration: -1 } },
          ],
        },
      ],
    });
    expect(p.scenes[0].elements[0].anim).toEqual({ type: "fade", start: 0, duration: 0.05 });
  });

  it("未知元素类型跳过不崩", () => {
    const p = normalizeProject({
      version: 1,
      scenes: [{ elements: [{ kind: "hologram" }, { kind: "badge", text: "x" }] }],
    });
    expect(p.scenes[0].elements).toHaveLength(1);
  });

  it("mascot/confetti 收录为合法 kind,纸屑字段钳边界,caption 非空才保留", () => {
    const p = normalizeProject({
      version: 1,
      scenes: [
        {
          caption: "一句旁白",
          elements: [
            { kind: "mascot", variant: "bot", mood: "worried", badge: "文枢", label: "加工站" },
            { kind: "confetti", mode: "burst", count: 9999, seed: "x", colors: ["#fff", 3] },
          ],
        },
        { caption: "  ", elements: [] },
        { caption: 42, elements: [] },
      ],
    });
    expect(p.scenes.map((s) => s.caption)).toEqual(["一句旁白", undefined, undefined]);
    const scene = p.scenes[0];
    expect(scene.elements.map((e) => e.kind)).toEqual(["mascot", "confetti"]);
    const c = scene.elements[1] as { count?: number; seed?: number; colors?: unknown[]; mode?: string };
    expect([c.count, c.seed, c.colors, c.mode]).toEqual([200, undefined, undefined, "burst"]);
  });

  it("float 悬浮:true 简写转空对象,对象钳参数,脏值丢弃,新入场类型收录", () => {
    const p = normalizeProject({
      version: 1,
      scenes: [
        {
          elements: [
            { kind: "badge", text: "a", float: true, anim: { type: "flip", start: 0, duration: 0.5 } },
            { kind: "badge", text: "b", float: { amp: 999, period: 0.1, swing: "yes" }, anim: { type: "wobble" } },
            { kind: "badge", text: "c", float: "yes", anim: { type: "swing" } },
            { kind: "badge", text: "d", float: false, anim: { type: "bounce" } },
          ],
        },
      ],
    });
    const els = p.scenes[0].elements as unknown as Array<Record<string, unknown>>;
    expect([els[0].float, els[1].float]).toEqual([{}, { amp: 40, period: 1 }]);
    expect([els[2].float, els[3].float]).toEqual([undefined, undefined]);
    expect(els.map((e) => (e.anim as { type: string }).type)).toEqual(["flip", "wobble", "swing", "bounce"]);
  });

  it("连线绑定字段:合法字符串保留,非字符串丢弃", () => {
    const p = normalizeProject({
      version: 1,
      scenes: [
        {
          elements: [
            { kind: "connector", from: [0, 0], to: [10, 10], fromEl: "el-2", toEl: 42 },
            { kind: "badge", text: "x" },
          ],
        },
      ],
    });
    const line = p.scenes[0].elements[0];
    expect((line as { fromEl?: unknown }).fromEl).toBe("el-2");
    expect((line as { toEl?: unknown }).toEl).toBeUndefined();
  });

  it("新动画类型与缓动校验:合法保留,非法 easing 丢弃", () => {
    const p = normalizeProject({
      version: 1,
      scenes: [
        {
          elements: [
            { kind: "badge", text: "x", anim: { type: "spinIn", easing: "back" } },
            { kind: "badge", text: "y", anim: { type: "fade", easing: "nope" } },
          ],
        },
      ],
    });
    expect(p.scenes[0].elements[0].anim).toEqual({ type: "spinIn", start: 0, duration: 0.5, easing: "back" });
    expect(p.scenes[0].elements[1].anim).toEqual({ type: "fade", start: 0, duration: 0.5 });
  });

  it("artText 是合法元素类型", () => {
    const p = normalizeProject({
      version: 1,
      scenes: [{ elements: [{ kind: "artText", text: "艺术字" }] }],
    });
    expect(p.scenes[0].elements[0].kind).toBe("artText");
  });

  it("shape 与连线 curve 合法透传", () => {
    const p = normalizeProject({
      version: 1,
      scenes: [
        {
          elements: [
            { kind: "shape", shape: "ellipse", fill: "#FDE68A" },
            { kind: "connector", from: [0, 0], to: [100, 0], curve: -80 },
          ],
        },
      ],
    });
    expect(p.scenes[0].elements[0].kind).toBe("shape");
    expect(p.scenes[0].elements[1]).toMatchObject({ curve: -80 });
  });

  it("新增元素类型(list/stepCard/terminal/progress/kbd/browser)合法透传", () => {
    const p = normalizeProject({
      version: 1,
      scenes: [
        {
          elements: [
            { kind: "list", items: ["甲", "乙"], marker: "check" },
            { kind: "stepCard", num: "01", title: "标题", desc: "描述" },
            { kind: "terminal", code: "$ ls", title: "zsh" },
            { kind: "progress", label: "进度", percent: 72 },
            { kind: "kbd", text: "Cmd + K" },
            { kind: "browser", url: "https://example.com" },
          ],
        },
      ],
    });
    expect(p.scenes[0].elements.map((e) => e.kind)).toEqual([
      "list",
      "stepCard",
      "terminal",
      "progress",
      "kbd",
      "browser",
    ]);
  });

  it("list.items 宽容纠正:缺失归空数组,非字符串项转字符串", () => {
    const p = normalizeProject({
      version: 1,
      scenes: [
        {
          elements: [{ kind: "list", items: ["甲", 42, null] }, { kind: "list" }],
        },
      ],
    });
    expect(p.scenes[0].elements[0]).toMatchObject({ items: ["甲", "42", "null"] });
    expect(p.scenes[0].elements[1]).toMatchObject({ items: [] });
  });

  it("场景配音:合法保留并钳音量,src 缺失/非法视为无配音", () => {
    const p = normalizeProject({
      version: 1,
      scenes: [
        { elements: [], audio: { src: "data:audio/mp3;base64,AA", volume: 5 } },
        { elements: [], audio: { volume: 1 } },
        { elements: [], audio: "narration.mp3" },
      ],
    });
    expect(p.scenes[0].audio).toEqual({ src: "data:audio/mp3;base64,AA", volume: 2, rate: 1 });
    expect(p.scenes[1].audio).toBeUndefined();
    expect(p.scenes[2].audio).toBeUndefined();
  });

  it("场景配音:rate 钳 0.25-4,duration 仅收正数", () => {
    const p = normalizeProject({
      version: 1,
      scenes: [
        { elements: [], audio: { src: "a", rate: 99, duration: -3 } },
        { elements: [], audio: { src: "b", rate: 0.1, duration: 12.5 } },
        { elements: [], audio: { src: "c", duration: "6" } },
      ],
    });
    expect(p.scenes[0].audio).toEqual({ src: "a", volume: 1, rate: 4 });
    expect(p.scenes[1].audio).toEqual({ src: "b", volume: 1, rate: 0.25, duration: 12.5 });
    expect(p.scenes[2].audio).toEqual({ src: "c", volume: 1, rate: 1 });
  });

  it("结构损坏抛 ProjectParseError", () => {
    expect(() => normalizeProject([])).toThrow(ProjectParseError);
    expect(() => normalizeProject({ version: 2, scenes: [] })).toThrow(/version/);
    expect(() => normalizeProject({ version: 1 })).toThrow(/scenes/);
    expect(() => normalizeProject({ version: 1, scenes: [{ elements: "x" }] })).toThrow(/elements/);
  });

  it("画布缺省 1920x1080", () => {
    const p = normalizeProject({ version: 1, scenes: [] });
    expect(p.canvas).toEqual({ width: 1920, height: 1080, bg: "#F4F4F1" });
  });

  it("rotate 通用字段:数字归一到 0.1 度,非法值丢弃", () => {
    const p = normalizeProject({
      version: 1,
      scenes: [{ elements: [
        { kind: "badge", text: "a", rotate: 12.345 },
        { kind: "badge", text: "b", rotate: "三十" },
      ] }],
    });
    const els = p.scenes[0].elements as Array<{ rotate?: number }>;
    expect(els[0].rotate).toBe(12.3);
    expect("rotate" in els[1]).toBe(false);
  });

  it("fromFocus/toFocus:合法二元组钳 0..1,脏数据丢弃", () => {
    const p = normalizeProject({
      version: 1,
      scenes: [{ elements: [
        { kind: "connector", from: [0, 0], to: [10, 10], fromEl: "a", fromFocus: [1.5, -0.2], toFocus: [0.25, 0.75] },
        { kind: "connector", from: [0, 0], to: [10, 10], fromFocus: ["x"] },
      ] }],
    });
    const els = p.scenes[0].elements as Array<{ fromFocus?: unknown; toFocus?: unknown }>;
    expect(els[0].fromFocus).toEqual([1, 0]);
    expect(els[0].toFocus).toEqual([0.25, 0.75]);
    expect("fromFocus" in els[1]).toBe(false);
  });

  it("形状内嵌文本:text 非字符串丢弃", () => {
    const p = normalizeProject({
      version: 1,
      scenes: [{ elements: [{ kind: "shape", shape: "rect", text: 42 }] }],
    });
    const el = p.scenes[0].elements[0] as { text?: unknown };
    expect("text" in el).toBe(false);
  });

  it("sketchSeed:有限数保留,非数丢弃", () => {
    const p = normalizeProject({
      version: 1,
      scenes: [{ elements: [
        { kind: "shape", shape: "rect", sketch: true, sketchSeed: 123 },
        { kind: "shape", shape: "rect", sketch: true, sketchSeed: "abc" },
      ] }],
    });
    const els = p.scenes[0].elements as Array<{ sketchSeed?: unknown }>;
    expect(els[0].sketchSeed).toBe(123);
    expect("sketchSeed" in els[1]).toBe(false);
  });

  it("draw 入场类型保留,shape shadow 非布尔丢弃", () => {
    const p = normalizeProject({
      version: 1,
      scenes: [{ elements: [
        { kind: "connector", from: [0, 0], to: [100, 0], anim: { type: "draw" } },
        { kind: "shape", shape: "rect", shadow: true },
        { kind: "shape", shape: "rect", shadow: "yes" },
      ] }],
    });
    const els = p.scenes[0].elements as Array<{ anim?: { type: string }; shadow?: unknown }>;
    expect(els[0].anim?.type).toBe("draw");
    expect(els[1].shadow).toBe(true);
    expect("shadow" in els[2]).toBe(false);
  });

  it("phone 与 aiChat 合法透传,aiChat 文本字段非字符串丢弃", () => {
    const p = normalizeProject({
      version: 1,
      scenes: [{ elements: [
        { kind: "phone", body: "#FFFFFF", frame: "#0F172A" },
        { kind: "aiChat", title: "AI 助手", prompt: "总结", reply: "好的" },
        { kind: "aiChat", title: 7, prompt: true, reply: {} },
      ] }],
    });
    const els = p.scenes[0].elements as Array<{ kind: string; title?: unknown; prompt?: unknown; reply?: unknown }>;
    expect(els[0].kind).toBe("phone");
    expect(els[1].title).toBe("AI 助手");
    for (const key of ["title", "prompt", "reply"] as const) {
      expect(key in els[2]).toBe(false);
    }
  });
});
