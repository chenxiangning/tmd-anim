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
    expect(p.scenes[0].audio).toEqual({ src: "data:audio/mp3;base64,AA", volume: 2 });
    expect(p.scenes[1].audio).toBeUndefined();
    expect(p.scenes[2].audio).toBeUndefined();
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
});
