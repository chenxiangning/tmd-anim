import { describe, expect, it } from "vitest";
import { installButtonLabel, skillTargets, summarizeCheck } from "./aiSkillInstall";

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

describe("summarizeCheck", () => {
  it("按 未安装/有新版/已最新 三类计数,驱动按钮文案与覆盖提示", () => {
    expect(
      summarizeCheck([
        { label: "Claude Code", path: "/u/.claude/skills/tmd-anim", installed: false, upToDate: false },
        { label: "ZCode 等兼容 agent", path: "/u/.agents/skills/tmd-anim", installed: true, upToDate: false },
      ]),
    ).toEqual({ missing: 1, outdated: 1, fresh: 0 });
  });

  it("未安装的目标即便误标 upToDate 也只计入缺失", () => {
    expect(summarizeCheck([{ label: "a", path: "/x", installed: false, upToDate: true }])).toEqual({
      missing: 1,
      outdated: 0,
      fresh: 0,
    });
  });

  it("全部已最新时 fresh 等于目标数,对应「重新安装(覆盖为最新)」分支", () => {
    expect(
      summarizeCheck([
        { label: "a", path: "/x", installed: true, upToDate: true },
        { label: "b", path: "/y", installed: true, upToDate: true },
      ]),
    ).toEqual({ missing: 0, outdated: 0, fresh: 2 });
  });
});

describe("installButtonLabel", () => {
  const statuses = {
    allMissing: [
      { label: "a", path: "/x", installed: false, upToDate: false },
      { label: "b", path: "/y", installed: false, upToDate: false },
    ],
    allFresh: [
      { label: "a", path: "/x", installed: true, upToDate: true },
      { label: "b", path: "/y", installed: true, upToDate: true },
    ],
    allOutdated: [
      { label: "a", path: "/x", installed: true, upToDate: false },
      { label: "b", path: "/y", installed: true, upToDate: false },
    ],
    mixed: [
      { label: "a", path: "/x", installed: false, upToDate: false },
      { label: "b", path: "/y", installed: true, upToDate: false },
    ],
  };
  const check = (targets: typeof statuses.allMissing) => ({ supported: true, targets });

  it("安装中/未检测到目标/全部未装,都显示基础安装文案", () => {
    expect(installButtonLabel(check(statuses.allMissing), true)).toBe("安装中…");
    expect(installButtonLabel(null, false)).toBe("安装到本机 AI 技能目录");
    expect(installButtonLabel({ supported: false, targets: [] }, false)).toBe("安装到本机 AI 技能目录");
    expect(installButtonLabel(check(statuses.allMissing), false)).toBe("安装到本机 AI 技能目录");
  });

  it("全部已最新提示重装覆盖,有新版提示覆盖更新,混合提示补缺并覆盖", () => {
    expect(installButtonLabel(check(statuses.allFresh), false)).toBe("重新安装(覆盖为最新)");
    expect(installButtonLabel(check(statuses.allOutdated), false)).toBe("覆盖更新到最新");
    expect(installButtonLabel(check(statuses.mixed), false)).toBe("补装缺失,已装的覆盖更新");
  });
});
