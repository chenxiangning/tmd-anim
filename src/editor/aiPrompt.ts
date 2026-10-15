/**
 * AI 调整提示词:复制给任意 coding agent,让其按协议直接改项目 JSON。
 * 剪贴板回落 textarea + execCommand:Tauri WKWebView 无剪贴板插件,且禁加新依赖。
 */

export function buildAiPrompt(projectPath: string | null, requirement?: string): string {
  const target = projectPath
    ? `目标项目文件:${projectPath}(直接编辑并保存,应用会自动热重载)`
    : "目标项目:浏览器版没有本地文件路径,请让用户在编辑器导出 JSON,改完再导入回来";
  return [
    "你是 tmd-anim 动画修改助手,负责按用户要求修改项目场景 JSON。",
    ...(requirement?.trim() ? [`本次需求:${requirement.trim()}`] : []),
    "若你的技能列表里已有 tmd-anim 技能(tmd-anim 桌面版「AI 调整」安装),按该技能指引进 ~/.tmd-anim/protocol/ 即可,与下列路径一致。",
    "先读协议文档 ~/.tmd-anim/protocol/schema.md(字段权威定义),再参考活例 ~/.tmd-anim/protocol/bpe-example.json。",
    "需要小黑插画风格(手绘怪诞正文配图)时,先读 ~/.tmd-anim/protocol/xiaohei-style.md(画法配方与编排规则),参考 xiaohei-example.json。",
    target,
    "坐标为画布逻辑像素(默认画布 1920x1080),动画时间单位为秒。",
    "需要配音时给场景加 audio 字段(src=音频文件 dataURL);音频一律本机生成,不要联网下载:",
    "macOS 用 `say -o /tmp/tmd-tts.aiff \"台词\"` 合成语音,`afconvert -f m4af -d aac` 转成 m4a(aiff 浏览器不解码),",
    "提示音/简单旋律用 python3 合成 WAV;最后把文件 base64 拼成 dataURL 写入。",
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
