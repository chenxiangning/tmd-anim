import schemaMd from "../../docs/schema.md?raw";
import xiaoheiStyleMd from "../../docs/xiaohei-style.md?raw";
import { protocolPaths, renderSkillMd } from "./agentPaths";
import bpeSample from "../samples/bpe.json";
import xiaoheiSample from "../samples/xiaohei.json";

/** writeIfChanged 依赖的最小文件面,便于表达「不同才覆写」而不耦合整个 fs 模块 */
interface TextFileStore {
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, contents: string): Promise<void>;
}

/**
 * 协议材料投递:schema.md、xiaohei-style.md、skill.md 与两个示例 JSON 落到
 * 当前用户主目录的 .tmd-anim/protocol/(mac 与 Windows 各自解析,见 agentPaths),
 * 内容与盘上不同才覆写。仅 Tauri 后端;任何失败静默降级,不阻塞应用启动。
 */
export async function syncProtocol(): Promise<void> {
  try {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
    // 动态导入必要:Tauri 插件模块在纯浏览器环境加载即崩
    const fs = await import("@tauri-apps/plugin-fs");
    const p = await protocolPaths();
    await fs.mkdir(p.dir, { recursive: true });
    await writeIfChanged(fs, p.schemaMd, schemaMd);
    await writeIfChanged(fs, p.bpeExample, JSON.stringify(bpeSample, null, 2));
    await writeIfChanged(fs, p.xiaoheiStyleMd, xiaoheiStyleMd);
    await writeIfChanged(fs, p.xiaoheiExample, JSON.stringify(xiaoheiSample, null, 2));
    await writeIfChanged(fs, p.dir + "skill.md", renderSkillMd(p));
  } catch {
    // 协议投递失败不影响应用功能
  }
}

async function writeIfChanged(fs: TextFileStore, path: string, content: string): Promise<void> {
  let current: string | null = null;
  try {
    current = await fs.readTextFile(path);
  } catch {
    current = null; // 文件尚不存在
  }
  if (current !== content) await fs.writeTextFile(path, content);
}
