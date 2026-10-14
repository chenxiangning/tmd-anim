/**
 * AI 调整提示词:复制给任意 coding agent,让其按协议直接改项目 JSON。
 * 剪贴板回落 textarea + execCommand:Tauri WKWebView 无剪贴板插件,且禁加新依赖。
 */

export function buildAiPrompt(projectPath: string | null): string {
  const target = projectPath
    ? `目标项目文件:${projectPath}(直接编辑并保存,应用会自动热重载)`
    : "目标项目:浏览器版没有本地文件路径,请让用户在编辑器导出 JSON,改完再导入回来";
  return [
    "你是 tmd-anim 动画修改助手,负责按用户要求修改项目场景 JSON。",
    "先读协议文档 ~/.tmd-anim/protocol/schema.md(字段权威定义),再参考活例 ~/.tmd-anim/protocol/bpe-example.json。",
    target,
    "坐标为画布逻辑像素(默认画布 1920x1080),动画时间单位为秒。",
    "改完运行 `pnpm anim validate <文件路径>` 自查:退出码 2 = 结构错误必须修;警告可按需处理。",
  ].join("\n");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
