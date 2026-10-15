import { useEffect, useRef, useState } from "react";
import type { Scene } from "../core/types";
import { sceneDuration } from "../core/timeline";
import {
  TTS_MAX_CHARS,
  TTS_RATE_RANGE,
  clampRate,
  generateTts,
  isTauri,
  listTtsVoices,
  loadTtsDraft,
  saveTtsDraft,
  wavToDataUrl,
  type TtsVoice,
} from "./tts";

interface TtsDialogProps {
  scene: Scene;
  onSet: (audio: Scene["audio"] | undefined) => void;
  onClose: () => void;
}

/**
 * 文字转语音配音弹窗:输入文字 → 系统 say 本机合成 → dataURL 写入 scene.audio。
 * 文本按 sceneId 留底,嗓音/语速全局记忆;试听只播不嵌,「生成并嵌入」替换现有配音(保留音量)。
 */
export function TtsDialog({ scene, onSet, onClose }: TtsDialogProps) {
  const draft = loadTtsDraft(scene.id);
  const [text, setText] = useState(draft.text ?? "");
  const [voices, setVoices] = useState<TtsVoice[] | null>(null);
  const [voice, setVoice] = useState(draft.voice ?? "");
  const [rate, setRate] = useState(() => clampRate(draft.rate));
  const [busy, setBusy] = useState<null | "preview" | "embed">(null);
  const [error, setError] = useState("");
  const [previewSec, setPreviewSec] = useState<number | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef("");
  const sceneSec = sceneDuration(scene);

  useEffect(() => {
    if (!isTauri) return;
    let alive = true;
    listTtsVoices()
      .then((vs) => {
        if (!alive) return;
        setVoices(vs);
        // 已记嗓音失效时回落:第一个中文嗓音 → 第一个嗓音 → 系统默认
        setVoice((cur) =>
          cur && vs.some((x) => x.name === cur)
            ? cur
            : (vs.find((x) => x.lang === "zh_CN")?.name ?? vs[0]?.name ?? ""),
        );
      })
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, []);

  // 卸载时停播试听并回收 objectURL
  useEffect(
    () => () => {
      previewRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const run = async (embed: boolean): Promise<void> => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    previewRef.current?.pause();
    setBusy(embed ? "embed" : "preview");
    setError("");
    try {
      const bytes = await generateTts(trimmed, voice || undefined, rate);
      if (embed) {
        const src = await wavToDataUrl(bytes);
        saveTtsDraft(scene.id, trimmed, voice, rate);
        // duration 留空待探测回填;volume/rate 沿用场景现值
        onSet({ src, volume: scene.audio?.volume ?? 1, rate: scene.audio?.rate });
        onClose();
        return;
      }
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
      urlRef.current = url;
      const audio = new Audio(url);
      audio.onloadedmetadata = () => setPreviewSec(Number.isFinite(audio.duration) ? audio.duration : null);
      previewRef.current = audio;
      setPreviewSec(null);
      void audio.play().catch(() => setError("试听播放失败"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40" onClick={() => !busy && onClose()}>
      <div className="w-96 rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-sm font-semibold text-neutral-800">文字配音(TTS)</span>
          <span className="text-[10px] text-neutral-400">{scene.name} · 本机合成</span>
        </div>
        <p className="mb-3 text-[10px] leading-relaxed text-neutral-500">
          输入要朗读的文字,系统嗓音本机生成音频并嵌入本场景,随场景起点播放。
          {scene.audio?.src && " 生成后将替换现有配音(保留音量)。"}
        </p>
        {!isTauri ? (
          <div className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">TTS 依赖 macOS 系统语音,仅桌面版可用;浏览器预览态请用「＋ 配音」选文件。</div>
        ) : (
          <>
            <textarea
              autoFocus
              rows={4}
              maxLength={TTS_MAX_CHARS}
              value={text}
              placeholder="输入要朗读的文字…"
              onChange={(e) => setText(e.target.value)}
              className="mb-1 w-full resize-y rounded-lg border border-neutral-200 p-2.5 text-xs leading-relaxed outline-none focus:border-slate-400"
            />
            <div className="mb-3 text-right text-[10px] text-neutral-400">
              {text.length}/{TTS_MAX_CHARS}
            </div>
            <div className="mb-2 flex items-center gap-2 text-xs">
              <label htmlFor="tts-voice" className="w-8 shrink-0 text-neutral-500">嗓音</label>
              <select
                id="tts-voice"
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                className="min-w-0 flex-1 rounded-md border border-neutral-200 px-1.5 py-1 text-xs outline-none focus:border-slate-400"
              >
                {voices === null ? (
                  <option>加载系统嗓音中…</option>
                ) : (
                  <>
                    <option value="">系统默认</option>
                    {groupByLang(voices).map(([lang, items]) => (
                      <optgroup key={lang} label={lang}>
                        {items.map((x) => (
                          <option key={x.name} value={x.name}>
                            {x.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </>
                )}
              </select>
            </div>
            <div className="mb-3 flex items-center gap-2 text-xs">
              <label htmlFor="tts-rate" className="w-8 shrink-0 text-neutral-500">语速</label>
              <input
                id="tts-rate"
                type="range"
                min={TTS_RATE_RANGE.min}
                max={TTS_RATE_RANGE.max}
                step={10}
                value={rate}
                onChange={(e) => setRate(clampRate(e.target.value))}
                className="h-1 min-w-0 flex-1 cursor-pointer accent-slate-900"
              />
              <span className="w-12 shrink-0 text-right font-mono text-neutral-500">{rate}/分</span>
            </div>
            <div className="mb-3 flex h-5 items-center gap-2 text-[10px]">
              {previewSec !== null && (
                <span className={`font-mono ${previewSec > sceneSec + 0.05 ? "text-amber-600" : "text-neutral-400"}`}>
                  ♪{previewSec.toFixed(1)}s / 本幕 {sceneSec.toFixed(1)}s
                  {previewSec > sceneSec + 0.05 && " 超出部分将被截断,可调大「停留」"}
                </span>
              )}
              {error && <span className="break-all text-red-600">{error}</span>}
            </div>
            <div className="flex gap-2">
              <button className="btn btn-secondary flex-1" disabled={!text.trim() || busy !== null} onClick={() => void run(false)}>
                {busy === "preview" ? "合成中…" : "试听"}
              </button>
              <button className="btn btn-primary flex-1" disabled={!text.trim() || busy !== null} onClick={() => void run(true)}>
                {busy === "embed" ? "合成中…" : "生成并嵌入"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** 按语言码分组(保序,入参已按中文优先排序) */
function groupByLang(voices: TtsVoice[]): Array<[string, TtsVoice[]]> {
  const groups: Array<[string, TtsVoice[]]> = [];
  for (const v of voices) {
    const last = groups[groups.length - 1];
    if (last && last[0] === v.lang) last[1].push(v);
    else groups.push([v.lang, [v]]);
  }
  return groups;
}
