/**
 * TTS 配音前端封装:调用 Rust 侧 tts_voices / tts_speak(macOS 系统 say,本机合成不联网),
 * 产物 WAV 转 dataURL 后写入 scene.audio.src,与手工导入配音共用同步/导出链路。
 */

/** TTS 嗓音(`say -v '?'` 的一行,Rust 已按名字+语言去重) */
export interface TtsVoice {
  name: string;
  lang: string;
  sample: string;
}

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** 语速默认值与钳制范围(字/分),与 Rust 侧 RATE_RANGE 对齐 */
export const TTS_DEFAULT_RATE = 190;
export const TTS_RATE_RANGE = { min: 80, max: 320 } as const;
/** 文本上限,与 Rust 侧 MAX_TEXT_CHARS 对齐 */
export const TTS_MAX_CHARS = 2000;

/** 枚举系统嗓音,中文嗓音排前 */
export async function listTtsVoices(): Promise<TtsVoice[]> {
  if (!isTauri) throw new Error("TTS 仅桌面版可用");
  const { invoke } = await import("@tauri-apps/api/core");
  return sortVoices(await invoke<TtsVoice[]>("tts_voices"));
}

/** 合成语音,返回 WAV 字节(voice 传 undefined = 系统默认嗓音) */
export async function generateTts(text: string, voice: string | undefined, rate: number): Promise<ArrayBuffer> {
  if (!isTauri) throw new Error("TTS 仅桌面版可用");
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<ArrayBuffer>("tts_speak", { text, voice: voice || null, rate });
}

/** WAV 字节 → dataURL;项目 JSON 里配音统一以 dataURL 存放 */
export function wavToDataUrl(bytes: ArrayBuffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("音频编码失败"));
    reader.readAsDataURL(new Blob([bytes], { type: "audio/wav" }));
  });
}

/* ── 纯函数(可单测)────────────────────────────────────────── */

/** 嗓音排序:zh_CN 最前,其余中文次之,之后按语言码、名字字典序 */
export function sortVoices(voices: TtsVoice[]): TtsVoice[] {
  const rank = (lang: string): number => (lang === "zh_CN" ? 0 : lang.startsWith("zh") ? 1 : 2);
  return [...voices].sort((a, b) => {
    const byLang = rank(a.lang) - rank(b.lang) || a.lang.localeCompare(b.lang);
    return byLang || a.name.localeCompare(b.name);
  });
}

/** 语速钳制:非法回默认值 */
export function clampRate(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return TTS_DEFAULT_RATE;
  return Math.min(TTS_RATE_RANGE.max, Math.max(TTS_RATE_RANGE.min, Math.round(v)));
}

/* ── 草稿与偏好(场景文本按 sceneId 留底,嗓音/语速全局记忆)────── */

const DRAFT_PREFIX = "tmd-anim:tts-draft:";
const PREFS_KEY = "tmd-anim:tts-prefs";

export interface TtsDraft {
  text?: string;
  voice?: string;
  rate?: number;
}

export function loadTtsDraft(sceneId: string): TtsDraft {
  try {
    if (typeof localStorage === "undefined") return {};
    const scene = JSON.parse(localStorage.getItem(DRAFT_PREFIX + sceneId) ?? "{}") as TtsDraft;
    const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as TtsDraft;
    return { text: scene.text, voice: prefs.voice, rate: prefs.rate };
  } catch {
    return {};
  }
}

export function saveTtsDraft(sceneId: string, text: string, voice: string, rate: number): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(DRAFT_PREFIX + sceneId, JSON.stringify({ text }));
    localStorage.setItem(PREFS_KEY, JSON.stringify({ voice, rate }));
  } catch {
    /* localStorage 不可用(隐私模式等)时静默放弃 */
  }
}
