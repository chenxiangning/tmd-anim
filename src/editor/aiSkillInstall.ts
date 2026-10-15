import skillMd from "../../docs/skill.md?raw";

/**
 * tmd-anim 指路技能安装:把 docs/skill.md 写入各家 agent 的个人技能目录,
 * 仅在用户于「AI 调整」弹窗显式点击时执行;技能本体是薄指路牌,权威内容
 * 永远以 ~/.tmd-anim/protocol/ 为准,应用升级后重装一次即刷新。
 */

export interface SkillTarget {
  /** 相对 home 的路径段:经 @tauri-apps/api/path join 按平台分隔符拼接,避免 Windows 混合分隔符 */
  segments: string[];
  /** 面向用户的宿主名 */
  label: string;
}

/** 已知支持 SKILL.md 约定的个人技能目录;只写各自的 tmd-anim 子目录,不碰其他技能 */
export function skillTargets(): SkillTarget[] {
  return [
    { segments: [".claude", "skills", "tmd-anim"], label: "Claude Code" },
    { segments: [".agents", "skills", "tmd-anim"], label: "ZCode 等兼容 agent" },
  ];
}

/** writeIfChanged 依赖的最小文件面,便于浏览器环境降级而不耦合整个 fs 模块 */
interface TextFileStore {
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, contents: string): Promise<void>;
  mkdir(path: string, options: { recursive: boolean }): Promise<void>;
}

async function tauriFs(): Promise<TextFileStore | null> {
  try {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return null;
    const fs = await import("@tauri-apps/plugin-fs");
    return fs;
  } catch {
    return null;
  }
}

async function tauriPath(): Promise<{ homeDir(): Promise<string>; join(...parts: string[]): Promise<string> } | null> {
  try {
    const { homeDir, join } = await import("@tauri-apps/api/path");
    return { homeDir, join };
  } catch {
    return null;
  }
}

export interface SkillInstallResult {
  /** 安装成功的宿主与 SKILL.md 路径 */
  installed: Array<{ label: string; path: string }>;
  /** 失败的宿主与原因(权限/磁盘错误),不中断其他目标 */
  failed: Array<{ label: string; reason: string }>;
  /** true = 当前环境(浏览器版)不支持本地文件写入 */
  unsupported: boolean;
}

/** 安装到全部已知技能目录;逐目标容错,部分失败不影响其余 */
export async function installAgentSkill(): Promise<SkillInstallResult> {
  const fs = await tauriFs();
  if (!fs) return { installed: [], failed: [], unsupported: true };
  const pathMod = await tauriPath();
  if (!pathMod) return { installed: [], failed: [], unsupported: true };
  const home = await pathMod.homeDir();
  const result: SkillInstallResult = { installed: [], failed: [], unsupported: false };
  for (const target of skillTargets()) {
    try {
      const dir = await pathMod.join(home, ...target.segments);
      await fs.mkdir(dir, { recursive: true });
      const file = await pathMod.join(dir, "SKILL.md");
      await fs.writeTextFile(file, skillMd);
      result.installed.push({ label: target.label, path: file });
    } catch (e) {
      result.failed.push({ label: target.label, reason: e instanceof Error ? e.message : String(e) });
    }
  }
  return result;
}

/** 探测已安装状态(弹窗打开时的灰字提示);任何失败视为未安装 */
export async function detectInstalledSkill(): Promise<string[]> {
  const fs = await tauriFs();
  if (!fs) return [];
  const pathMod = await tauriPath();
  if (!pathMod) return [];
  const home = await pathMod.homeDir();
  const found: string[] = [];
  for (const target of skillTargets()) {
    try {
      const dir = await pathMod.join(home, ...target.segments);
      await fs.readTextFile(await pathMod.join(dir, "SKILL.md"));
      found.push(target.label);
    } catch {
      // 未安装或无权限,静默跳过
    }
  }
  return found;
}
