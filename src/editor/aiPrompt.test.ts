import { describe, expect, it, vi } from "vitest";
import { FALLBACK_PROTOCOL_PATHS, type ProtocolPaths } from "../app/agentPaths";
import { buildAiPrompt } from "./aiPrompt";

/** 提示词构建:协议路径必须来自传入真值,配音指引按系统分支 */

const WIN_PATHS: ProtocolPaths = {
  dir: "C:\\Users\\rei\\.tmd-anim\\protocol\\",
  schemaMd: "C:\\Users\\rei\\.tmd-anim\\protocol\\schema.md",
  httpExample: "C:\\Users\\rei\\.tmd-anim\\protocol\\http-example.json",
  xiaoheiStyleMd: "C:\\Users\\rei\\.tmd-anim\\protocol\\xiaohei-style.md",
  xiaoheiExample: "C:\\Users\\rei\\.tmd-anim\\protocol\\xiaohei-example.json",
  projectsDir: "C:\\Users\\rei\\.tmd-anim\\projects\\",
};

describe("buildAiPrompt", () => {
  it("协议路径用传入真值,不出现 ~ 简写", () => {
    const prompt = buildAiPrompt("/Users/rei/.tmd-anim/projects/p_x.json", WIN_PATHS);
    expect(prompt).toContain(WIN_PATHS.schemaMd);
    expect(prompt).toContain(WIN_PATHS.xiaoheiStyleMd);
    expect(prompt).toContain("目标项目文件:/Users/rei/.tmd-anim/projects/p_x.json");
    expect(prompt).not.toContain("~/");
  });

  it("需求非空时拼在身份行之后、路径指引之前,空白则省略", () => {
    const withReq = buildAiPrompt(null, FALLBACK_PROTOCOL_PATHS, "  标题改短  ");
    expect(withReq).toContain("本次需求:标题改短");
    expect(withReq.indexOf("本次需求:标题改短")).toBeLessThan(withReq.indexOf("先读协议文档"));
    expect(buildAiPrompt(null, FALLBACK_PROTOCOL_PATHS, "   ")).not.toContain("本次需求:");
  });

  it("浏览器版(无项目路径)给导入导出指引", () => {
    const prompt = buildAiPrompt(null, FALLBACK_PROTOCOL_PATHS);
    expect(prompt).toContain("浏览器版没有本地文件路径");
  });

  it("Windows 平台给 PowerShell System.Speech 指引,不给 macOS say", () => {
    vi.stubGlobal("navigator", { platform: "Win32", userAgent: "" });
    const prompt = buildAiPrompt(null, WIN_PATHS);
    vi.unstubAllGlobals();
    expect(prompt).toContain("System.Speech");
    expect(prompt).toContain("SetOutputToWaveFile");
    expect(prompt).not.toContain("say -o");
    expect(prompt).not.toContain("afconvert");
  });

  it("非 Windows 平台保留 macOS say 指引", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel", userAgent: "" });
    const prompt = buildAiPrompt(null, FALLBACK_PROTOCOL_PATHS);
    vi.unstubAllGlobals();
    expect(prompt).toContain("say -o /tmp/tmd-tts.aiff");
    expect(prompt).not.toContain("System.Speech");
  });

  it("元素选型速查覆盖全部 kind 与 dev 变体,且插在协议路径之后", () => {
    const prompt = buildAiPrompt(null, FALLBACK_PROTOCOL_PATHS);
    expect(prompt).toContain("元素选型速查");
    expect(prompt).toContain("aiChat");
    expect(prompt).toContain("loadBalancer");
    expect(prompt.indexOf("先读协议文档")).toBeLessThan(prompt.indexOf("元素选型速查"));
  });
});
