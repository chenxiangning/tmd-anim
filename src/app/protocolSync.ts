import schemaMd from "../../docs/schema.md?raw";
import bpeSample from "../samples/bpe.json";

/** 协议材料目录:$HOME/.tmd-anim/protocol/,coding agent 现场阅读用 */
const PROTOCOL_DIR = ".tmd-anim/protocol";

/** writeIfChanged 依赖的最小文件面,便于表达「不同才覆写」而不耦合整个 fs 模块 */
interface TextFileStore {
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, contents: string): Promise<void>;
}

/**
 * 协议材料投递:schema.md 与 bpe-example.json 落到 ~/.tmd-anim/protocol/,
 * 内容与盘上不同才覆写。仅 Tauri 后端;任何失败静默降级,不阻塞应用启动。
 */
export async function syncProtocol(): Promise<void> {
  try {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
    // 动态导入必要:Tauri 插件模块在纯浏览器环境加载即崩
    const fs = await import("@tauri-apps/plugin-fs");
    const { homeDir, join } = await import("@tauri-apps/api/path");
    const dir = await join(await homeDir(), PROTOCOL_DIR);
    await fs.mkdir(dir, { recursive: true });
    await writeIfChanged(fs, await join(dir, "schema.md"), schemaMd);
    await writeIfChanged(fs, await join(dir, "bpe-example.json"), JSON.stringify(bpeSample, null, 2));
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
