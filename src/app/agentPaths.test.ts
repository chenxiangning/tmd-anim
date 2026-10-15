import { describe, expect, it, vi } from "vitest";
import { FALLBACK_PROTOCOL_PATHS, isWindowsPlatform, protocolPaths, renderSkillMd } from "./agentPaths";

/** 路径真值:agent 可读文本一律按当前系统渲染,不允许 ~ 简写与未替换占位符泄漏 */

describe("isWindowsPlatform", () => {
  it("node 环境无 navigator.platform 命中,按非 Windows 处理", () => {
    expect(isWindowsPlatform()).toBe(false);
  });

  it("navigator.platform 为 Win32(WebView2 恒定值)判为 Windows", () => {
    vi.stubGlobal("navigator", { platform: "Win32", userAgent: "" });
    expect(isWindowsPlatform()).toBe(true);
    vi.unstubAllGlobals();
  });

  it("UA 含 Windows NT 兜底命中", () => {
    vi.stubGlobal("navigator", { platform: "Linux x86_64", userAgent: "Mozilla/5.0 (Windows NT 10.0)" });
    expect(isWindowsPlatform()).toBe(true);
    vi.unstubAllGlobals();
  });
});

describe("protocolPaths", () => {
  it("非 Tauri 环境回落 ~ 写法,形态与旧版文本一致", async () => {
    expect(await protocolPaths()).toBe(FALLBACK_PROTOCOL_PATHS);
    expect(FALLBACK_PROTOCOL_PATHS.dir).toBe("~/.tmd-anim/protocol/");
    expect(FALLBACK_PROTOCOL_PATHS.projectsDir).toBe("~/.tmd-anim/projects/");
  });
});

describe("renderSkillMd", () => {
  it("占位符全部替换为给定路径,不残留 {{", () => {
    const p = {
      dir: "C:\\Users\\rei\\.tmd-anim\\protocol\\",
      schemaMd: "C:\\Users\\rei\\.tmd-anim\\protocol\\schema.md",
      bpeExample: "C:\\Users\\rei\\.tmd-anim\\protocol\\bpe-example.json",
      xiaoheiStyleMd: "C:\\Users\\rei\\.tmd-anim\\protocol\\xiaohei-style.md",
      xiaoheiExample: "C:\\Users\\rei\\.tmd-anim\\protocol\\xiaohei-example.json",
      projectsDir: "C:\\Users\\rei\\.tmd-anim\\projects\\",
    };
    const rendered = renderSkillMd(p);
    expect(rendered).not.toContain("{{");
    expect(rendered).toContain(p.schemaMd);
    expect(rendered).toContain(p.projectsDir);
    expect(rendered).not.toContain("~/");
  });

  it("~ 回落渲染同样无占位符,保持旧版 ~ 形态", () => {
    const rendered = renderSkillMd(FALLBACK_PROTOCOL_PATHS);
    expect(rendered).not.toContain("{{");
    expect(rendered).toContain("~/.tmd-anim/protocol/schema.md");
  });

  it("模板内不含未覆盖的裸 ~ 路径(防止 Windows 侧漏出 Unix 写法)", () => {
    const rendered = renderSkillMd({
      dir: "X:\\p\\",
      schemaMd: "X:\\p\\schema.md",
      bpeExample: "X:\\p\\bpe.json",
      xiaoheiStyleMd: "X:\\p\\xs.md",
      xiaoheiExample: "X:\\p\\xe.json",
      projectsDir: "X:\\pr\\",
    });
    expect(rendered).not.toMatch(/~\/|~\\|\{\{/);
  });
});
