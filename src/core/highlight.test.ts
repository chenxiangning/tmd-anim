import { describe, expect, it } from "vitest";
import { atomsOf, splitRuns } from "./highlight";

describe("splitRuns", () => {
  it("无高亮时整段一个 run", () => {
    expect(splitRuns("abc")).toEqual([{ text: "abc", hl: false }]);
  });

  it("命中短语切成三段", () => {
    expect(splitRuns("abcdef", ["cd"])).toEqual([
      { text: "ab", hl: false },
      { text: "cd", hl: true },
      { text: "ef", hl: false },
    ]);
  });

  it("多短语互不重叠,按出现顺序", () => {
    expect(splitRuns("把海量文本切成一段一段", ["切成一段一段", "海量"])).toEqual([
      { text: "把", hl: false },
      { text: "海量", hl: true },
      { text: "文本", hl: false },
      { text: "切成一段一段", hl: true },
    ]);
  });

  it("重叠时先到者得", () => {
    expect(splitRuns("abcde", ["abc", "cde"])).toEqual([
      { text: "abc", hl: true },
      { text: "de", hl: false },
    ]);
  });

  it("未命中的短语被忽略", () => {
    expect(splitRuns("abc", ["zzz"])).toEqual([{ text: "abc", hl: false }]);
  });
});

describe("atomsOf", () => {
  it("CJK 单字成原子,连续字母数字成词", () => {
    expect(atomsOf("温度38度").map((a) => a.text)).toEqual(["温", "度", "38", "度"]);
  });

  it("英文按词分组,空白独立成原子", () => {
    expect(atomsOf("hello world").map((a) => a.text)).toEqual(["hello", " ", "world"]);
  });

  it("高亮标记透传到原子", () => {
    expect(atomsOf("把海量切成一段", ["切成"])).toEqual([
      { text: "把", hl: false },
      { text: "海", hl: false },
      { text: "量", hl: false },
      { text: "切", hl: true },
      { text: "成", hl: true },
      { text: "一", hl: false },
      { text: "段", hl: false },
    ]);
  });
});
