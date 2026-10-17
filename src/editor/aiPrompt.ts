import { isWindowsPlatform, type ProtocolPaths } from "../app/agentPaths";

/**
 * AI 调整提示词:复制给任意 coding agent,让其按协议直接改项目 JSON。
 * 协议路径给当前系统解析后的绝对路径(见 agentPaths),不写 ~ 简写,
 * Windows 上 cmd 不展开 ~、文件 API 不识别,直给 C:\Users\… 才可读。
 * 剪贴板回落 textarea + execCommand:Tauri WKWebView 无剪贴板插件,且禁加新依赖。
 */

export function buildAiPrompt(projectPath: string | null, protocol: ProtocolPaths, requirement?: string): string {
  const target = projectPath
    ? `目标项目文件:${projectPath}(直接编辑并保存,应用会自动热重载)`
    : "目标项目:浏览器版没有本地文件路径,请让用户在编辑器导出 JSON,改完再导入回来";
  return [
    "你是 tmd-anim 动画修改助手,负责按用户要求修改项目场景 JSON。",
    ...(requirement?.trim() ? [`本次需求:${requirement.trim()}`] : []),
    `若你的技能列表里已有 tmd-anim 技能(tmd-anim 桌面版「AI 调整」安装),按该技能指引进 ${protocol.dir} 即可,与下列路径一致。`,
    `先读协议文档 ${protocol.schemaMd}(字段权威定义),再参考活例 ${protocol.httpExample}。`,
    ...selectionCheatSheet(),
    `需要小黑插画风格(手绘怪诞正文配图)时,先读 ${protocol.xiaoheiStyleMd}(画法配方与编排规则),参考 ${protocol.xiaoheiExample}。`,
    target,
    "坐标为画布逻辑像素(默认画布 1920x1080),动画时间单位为秒。",
    ...ttsLines(),
    "改完运行 `pnpm anim validate <文件路径>` 自查:退出码 2 = 结构错误必须修;警告可按需处理。",
  ].join("\n");
}

/** 元素选型速查:让 agent 不用逐字段读 schema 就能选对 kind;新增组件时同步此表(与 docs/schema.md 元素表一致) */
function selectionCheatSheet(): string[] {
  return [
    "元素选型速查(kind → 用途;全部字段见 schema 元素表):",
    "- 文字=title 标题/text 正文(支持 highlight 高亮芯片)/artText 艺术字",
    "- 流程节点=shape(9 变体 rect/ellipse/triangle/diamond/hexagon/star/cylinder/blockArrow/speechBubble;"
    + "sketch:true 手绘抖动,sketchSeed 换一份;节点文字写 shape.text,画布双击可改)",
    "- 架构资源=devNode dev:database/redis/obs/cloud/server/api/queue/container/gateway/loadBalancer/cdn/auth/function/git,配 label 主名 + sub 规格",
    "- 设备与界面=phone 手机(屏幕区可叠其他元素)/browser 浏览器窗口(url);AI 对话=aiChat(prompt 用户问/reply AI 答)",
    "- 步骤与要点=stepCard 步骤卡/list 要点;数据=table 表格/arrayCells 色块数组;终端=terminal,代码=code;状态=progress 进度/kbd 按键/badge 徽章/note 便签/input 输入框",
    "- 连线=connector:fromEl/toEl 绑元素自动跟随(fromFocus/toFocus 固定锚点),route:elbow 直角,被其他元素遮挡自动绕行;label 挂线中点",
  ];
}

/** 配音指引按系统分支:macOS 走 say + afconvert,Windows 走 PowerShell 的 System.Speech */
function ttsLines(): string[] {
  if (isWindowsPlatform()) {
    return [
      "需要配音时给场景加 audio 字段(src=音频文件 dataURL);音频一律本机生成,不要联网下载:",
      `Windows 用 PowerShell 合成 WAV:powershell -c "Add-Type -AssemblyName System.Speech; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SetOutputToWaveFile('tmd-tts.wav'); $s.Speak('台词'); $s.Dispose()"(在可写目录执行,WAV 浏览器可直接解码,无需转码),`,
      "提示音/简单旋律用 python3 合成 WAV;最后把文件 base64 拼成 dataURL 写入。",
    ];
  }
  return [
    "需要配音时给场景加 audio 字段(src=音频文件 dataURL);音频一律本机生成,不要联网下载:",
    "macOS 用 `say -o /tmp/tmd-tts.aiff \"台词\"` 合成语音,`afconvert -f m4af -d aac` 转成 m4a(aiff 浏览器不解码),",
    "提示音/简单旋律用 python3 合成 WAV;最后把文件 base64 拼成 dataURL 写入。",
  ];
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
