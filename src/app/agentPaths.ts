import skillMd from "../../docs/skill.md?raw";

/**
 * 面向 agent 与用户的本机路径真值:提示词、技能正文、弹窗徽标一律给当前系统
 * 解析后的绝对路径,不写 ~ 简写(Windows cmd 不展开 ~,agent 直传文件 API 也
 * 不识别),macOS 与 Windows 各得各的形态。桌面版经 @tauri-apps/api/path 解析;
 * 浏览器版或解析失败回落 ~ 写法,形态与旧版文本一致。
 */

/** 协议与项目目录的完整路径;dir/projectsDir 以分隔符结尾,可直接拼文件名 */
export interface ProtocolPaths {
  dir: string;
  schemaMd: string;
  recipesMd: string;
  httpExample: string;
  showcaseExample: string;
  xiaoheiStyleMd: string;
  xiaoheiExample: string;
  projectsDir: string;
}

/** ~ 写法回落:非 Tauri 环境(浏览器版)无本机路径可言,仅作形态示意 */
export const FALLBACK_PROTOCOL_PATHS: ProtocolPaths = {
  dir: "~/.tmd-anim/protocol/",
  schemaMd: "~/.tmd-anim/protocol/schema.md",
  recipesMd: "~/.tmd-anim/protocol/recipes.md",
  httpExample: "~/.tmd-anim/protocol/http-example.json",
  showcaseExample: "~/.tmd-anim/protocol/showcase-example.json",
  xiaoheiStyleMd: "~/.tmd-anim/protocol/xiaohei-style.md",
  xiaoheiExample: "~/.tmd-anim/protocol/xiaohei-example.json",
  projectsDir: "~/.tmd-anim/projects/",
};

/** Windows 判定:WebView2 的 navigator.platform 恒为 Win32,UA 兜底;node 环境恒 false */
export function isWindowsPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /^win/i.test(navigator.platform) || /Windows NT/i.test(navigator.userAgent);
}

/** 解析当前系统真值;任何一步失败都回落 ~ 写法,不抛错(路径只是文本展示用) */
export async function protocolPaths(): Promise<ProtocolPaths> {
  try {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return FALLBACK_PROTOCOL_PATHS;
    const { homeDir, join, sep } = await import("@tauri-apps/api/path");
    const s = await sep();
    const root = (await join(await homeDir(), ".tmd-anim")) + s;
    return {
      dir: root + "protocol" + s,
      schemaMd: root + "protocol" + s + "schema.md",
      recipesMd: root + "protocol" + s + "recipes.md",
      httpExample: root + "protocol" + s + "http-example.json",
      showcaseExample: root + "protocol" + s + "showcase-example.json",
      xiaoheiStyleMd: root + "protocol" + s + "xiaohei-style.md",
      xiaoheiExample: root + "protocol" + s + "xiaohei-example.json",
      projectsDir: root + "projects" + s,
    };
  } catch {
    return FALLBACK_PROTOCOL_PATHS;
  }
}

/** skill.md 是模板:占位符在写入/展示前替换为当前系统真值,Windows 得 C:\Users\… 形态 */
export function renderSkillMd(p: ProtocolPaths): string {
  return skillMd
    .replaceAll("{{PROTOCOL_DIR}}", p.dir)
    .replaceAll("{{PROJECTS_DIR}}", p.projectsDir)
    .replaceAll("{{SCHEMA_MD}}", p.schemaMd)
    .replaceAll("{{RECIPES_MD}}", p.recipesMd)
    .replaceAll("{{HTTP_EXAMPLE_JSON}}", p.httpExample)
    .replaceAll("{{XIAOHEI_STYLE_MD}}", p.xiaoheiStyleMd)
    .replaceAll("{{XIAOHEI_EXAMPLE_JSON}}", p.xiaoheiExample);
}
