import skillMd from "../../docs/skill.md?raw";

/**
 * tmd-anim 指路技能安装:把 docs/skill.md 写入各家 agent 的个人技能目录,
 * 仅在用户于「AI 调整」弹窗显式点击时执行;技能本体是薄指路牌,权威内容
 * 永远以 ~/.tmd-anim/protocol/ 为准,应用升级后重装一次即刷新。
 * 目录一律相对用户主目录表达,经 @tauri-apps/api/path homeDir+join 取真值,
 * macOS/Linux 与 Windows、不同用户名均各自解析,不硬编码任何绝对路径。
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

/** 解析后的单目标:dir/file 为按当前用户与平台拼出的绝对路径 */
interface ResolvedTarget {
  label: string;
  dir: string;
  file: string;
  fs: TextFileStore;
}

async function resolveTargets(): Promise<ResolvedTarget[] | null> {
  const fs = await tauriFs();
  const pathMod = await tauriPath();
  if (!fs || !pathMod) return null;
  let home: string;
  try {
    home = await pathMod.homeDir();
  } catch {
    return null;
  }
  const resolved: ResolvedTarget[] = [];
  for (const target of skillTargets()) {
    const dir = await pathMod.join(home, ...target.segments);
    resolved.push({ label: target.label, dir, file: await pathMod.join(dir, "SKILL.md"), fs });
  }
  return resolved;
}

export interface SkillTargetStatus {
  label: string;
  /** 当前用户、当前平台下的绝对安装路径,可直接展示 */
  path: string;
  /** SKILL.md 可读 = 已安装 */
  installed: boolean;
  /** 已安装且内容与随应用捆绑的 skill.md 一致 = 已是最新;未安装时恒为 false */
  upToDate: boolean;
}

export interface SkillCheckResult {
  /** true = 当前环境(桌面版)支持本地文件读写 */
  supported: boolean;
  targets: SkillTargetStatus[];
}

/** 逐目标检查:是否已装、内容是否为最新版;读失败一律按未安装呈现 */
export async function checkSkillTargets(): Promise<SkillCheckResult> {
  const resolved = await resolveTargets();
  if (!resolved) return { supported: false, targets: [] };
  const targets: SkillTargetStatus[] = [];
  for (const t of resolved) {
    let installed = false;
    let upToDate = false;
    try {
      upToDate = (await t.fs.readTextFile(t.file)) === skillMd;
      installed = true;
    } catch {
      // 未安装或无权限,按未安装呈现
    }
    targets.push({ label: t.label, path: t.dir, installed, upToDate });
  }
  return { supported: true, targets };
}

/** 检测结果三分类计数,供弹窗推导按钮文案与覆盖提示 */
export function summarizeCheck(targets: SkillTargetStatus[]): { missing: number; outdated: number; fresh: number } {
  const count = { missing: 0, outdated: 0, fresh: 0 };
  for (const t of targets) {
    if (!t.installed) count.missing++;
    else if (t.upToDate) count.fresh++;
    else count.outdated++;
  }
  return count;
}

/** 按检测结果定安装按钮文案:全新装 / 补缺失并覆盖 / 全覆盖更新 / 已最新重装 */
export function installButtonLabel(check: SkillCheckResult | null, installing: boolean): string {
  if (installing) return "安装中…";
  const targets = check?.supported ? check.targets : [];
  if (targets.length === 0) return "安装到本机 AI 技能目录";
  const { missing, outdated } = summarizeCheck(targets);
  if (missing === targets.length) return "安装到本机 AI 技能目录";
  if (missing === 0 && outdated === 0) return "重新安装(覆盖为最新)";
  if (missing === 0) return "覆盖更新到最新";
  return "补装缺失,已装的覆盖更新";
}

export interface SkillInstallResult {
  /** 安装成功的宿主;overwritten=true 表示覆盖了已有版本(可能同内容重写) */
  installed: Array<{ label: string; path: string; overwritten: boolean }>;
  /** 失败的宿主与原因(权限/磁盘错误),不中断其他目标 */
  failed: Array<{ label: string; reason: string }>;
  /** true = 当前环境(浏览器版)不支持本地文件写入 */
  unsupported: boolean;
}

/** 安装到全部已知技能目录;逐目标容错,部分失败不影响其余 */
export async function installAgentSkill(): Promise<SkillInstallResult> {
  const resolved = await resolveTargets();
  if (!resolved) return { installed: [], failed: [], unsupported: true };
  const result: SkillInstallResult = { installed: [], failed: [], unsupported: false };
  for (const t of resolved) {
    try {
      let overwritten = false;
      try {
        await t.fs.readTextFile(t.file);
        overwritten = true;
      } catch {
        // 原无 SKILL.md,按新装记录
      }
      await t.fs.mkdir(t.dir, { recursive: true });
      await t.fs.writeTextFile(t.file, skillMd);
      result.installed.push({ label: t.label, path: t.file, overwritten });
    } catch (e) {
      result.failed.push({ label: t.label, reason: e instanceof Error ? e.message : String(e) });
    }
  }
  return result;
}
