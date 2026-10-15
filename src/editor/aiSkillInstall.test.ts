import { describe, expect, it } from "vitest";
import { skillTargets } from "./aiSkillInstall";

/** 技能安装目标:只允许各宿主技能目录下的 tmd-anim 子目录,绝不指向其他技能的空间;
 *  路径以相对段表达,由调用方经平台 join 拼接(macOS/Linux 得 `/`,Windows 得 `\`) */

describe("skillTargets", () => {
  it("覆盖 Claude Code 与 .agents 兼容宿主,均为 tmd-anim 专用子目录", () => {
    expect(skillTargets()).toEqual([
      { segments: [".claude", "skills", "tmd-anim"], label: "Claude Code" },
      { segments: [".agents", "skills", "tmd-anim"], label: "ZCode 等兼容 agent" },
    ]);
  });

  it("全部路径段不含平台分隔符,首段为点开头目录,拼接语义交给 @tauri-apps/api/path", () => {
    for (const t of skillTargets()) {
      for (const seg of t.segments) {
        expect(seg).not.toMatch(/[/\\]/);
      }
      expect(t.segments[0].startsWith(".")).toBe(true);
      expect(t.segments[t.segments.length - 1]).toBe("tmd-anim");
    }
  });
});
