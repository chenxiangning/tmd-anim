import { memo, useMemo } from "react";
import type { Scene } from "../core/types";
import { useAudioDuration } from "./sceneAudio";
import { resamplePeaks, useAudioPeaks } from "./audioWaveform";

/** 音轨行高:与元素行一致,保持时间线网格整齐 */
export const AUDIO_ROW_H = 24;
const AUDIO_BAR_H = 18;

/** 左列音轨标签:元素名列表末尾的固定行,与右侧音轨条同行滚动;点击选中配音 */
export const AudioLaneLabel = memo(function AudioLaneLabel({
  hasAudio,
  selected,
  onSelect,
}: {
  hasAudio: boolean;
  selected: boolean;
  onSelect(): void;
}) {
  return (
    <button
      onClick={onSelect}
      title="选中配音,在属性面板调音量与语速(压缩/拉伸)"
      className={`flex w-full items-center gap-1.5 px-2 text-left text-[11px] ${
        selected ? "bg-amber-50 text-neutral-900" : "text-neutral-400 hover:bg-neutral-50"
      }`}
      style={{ height: AUDIO_ROW_H }}
    >
      <span className={`h-2 w-2 shrink-0 rounded-sm ${hasAudio ? "bg-emerald-500" : "bg-neutral-300"}`} />
      <span className="truncate">配音</span>
    </button>
  );
});

/** 右侧音轨条:从场景起点铺开;配音比画面长时场景自动延长(不会截断),条宽按有效时长(时长/语速)。
 *  点击选中配音;无配音画虚线空轨占位。 */
export const AudioLaneTrack = memo(function AudioLaneTrack({
  audio,
  sceneDur,
  pps,
  top,
  selected,
  onSelect,
}: {
  audio: Scene["audio"] | undefined;
  sceneDur: number;
  pps: number;
  top: number;
  selected: boolean;
  onSelect(): void;
}) {
  const probed = useAudioDuration(audio?.src);
  if (!audio?.src) {
    return (
      <div
        className="pointer-events-none absolute inset-x-0 flex items-center justify-center rounded-[5px] border border-dashed border-emerald-200"
        style={{ top, height: AUDIO_BAR_H }}
      >
        <span className="text-[9px] text-emerald-300">未设置配音 · 顶部「＋ 配音」选文件或「TTS」合成</span>
      </div>
    );
  }
  const rate = audio.rate ?? 1;
  const raw = audio.duration ?? probed;
  const eff = raw !== null ? raw / rate : null;
  const over = eff !== null && eff > sceneDur + 0.05;
  const shown = Math.min(eff ?? sceneDur, sceneDur);
  const width = Math.max(shown * pps, 8);
  const label = `♪ 配音 ${eff !== null ? `${eff.toFixed(1)}s` : "?"}${
    rate !== 1 && raw !== null ? `(${raw.toFixed(1)}s×${rate.toFixed(2)})` : ""
  }${over ? " · 探测中" : ""}`;
  return (
    <AudioBar src={audio.src} width={width} over={over} selected={selected} onSelect={onSelect} label={label} top={top} />
  );
});

/** 波形条:峰值按 ~3px 一列二次采样,列数随缩放宽度变化(峰值本身有缓存);点按选中 */
function AudioBar({
  src,
  width,
  over,
  selected,
  onSelect,
  label,
  top,
}: {
  src: string;
  width: number;
  over: boolean;
  selected: boolean;
  onSelect(): void;
  label: string;
  top: number;
}) {
  const peaks = useAudioPeaks(src);
  const cols = Math.max(0, Math.min(160, Math.floor((width - 12) / 3)));
  const bars = useMemo(() => (peaks && cols > 0 ? resamplePeaks(peaks, cols) : []), [peaks, cols]);
  return (
    <div
      className={`absolute cursor-pointer overflow-hidden rounded-[5px] shadow-sm transition-[filter] hover:brightness-110 ${
        selected ? "ring-2 ring-amber-400" : ""
      } ${over ? "bg-amber-600" : "bg-emerald-600"}`}
      style={{ left: 0, top, width, height: AUDIO_BAR_H }}
      title="点击选中配音,属性面板可调音量与语速"
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <div className="absolute inset-x-1.5 inset-y-[3px] flex items-center gap-px overflow-hidden">
        {bars.map((p, i) => (
          <div key={i} className="w-[2px] shrink-0 rounded-full bg-white/35" style={{ height: `${Math.max(15, p * 100)}%` }} />
        ))}
      </div>
      <span className="pointer-events-none relative block truncate px-1.5 text-[10px] leading-[18px] font-medium text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]">
        {label}
      </span>
    </div>
  );
}
