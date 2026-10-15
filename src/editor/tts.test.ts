import { describe, expect, it } from "vitest";
import { clampRate, sortVoices, type TtsVoice } from "./tts";

const v = (name: string, lang: string): TtsVoice => ({ name, lang, sample: "" });

describe("sortVoices", () => {
  it("zh_CN 最前,其余中文次之,之后按语言与名字", () => {
    const sorted = sortVoices([
      v("Samantha", "en_US"),
      v("Meijia", "zh_TW"),
      v("Tingting", "zh_CN"),
      v("Daniel", "en_GB"),
      v("Sinji", "zh_HK"),
      v("Anna", "de_DE"),
    ]);
    expect(sorted.map((x) => x.name)).toEqual(["Tingting", "Sinji", "Meijia", "Anna", "Daniel", "Samantha"]);
  });

  it("同语言内按名字排序,且不改入参", () => {
    const input = [v("Reed", "zh_CN"), v("Eddy", "zh_CN")];
    const sorted = sortVoices(input);
    expect(sorted.map((x) => x.name)).toEqual(["Eddy", "Reed"]);
    expect(input.map((x) => x.name)).toEqual(["Reed", "Eddy"]);
  });
});

describe("clampRate", () => {
  it("范围内取整,越界钳制,非法回默认", () => {
    expect(clampRate(180.4)).toBe(180);
    expect(clampRate(10)).toBe(80);
    expect(clampRate(999)).toBe(320);
    expect(clampRate("abc")).toBe(190);
    expect(clampRate(undefined)).toBe(190);
  });
});
