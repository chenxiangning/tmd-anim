import { memo, useMemo } from "react";
import { useAudioDuration } from "./sceneAudio";
import { resamplePeaks, useAudioPeaks } from "./audioWaveform";

/** 音轨行高:与元素行一致,保持时间线网格整齐 */
export const AUDIO_ROW_H = 24;
const AUDIO_BAR_H = 18;

/** 左列音轨标签:元素名列表末尾的固定行,与右侧音轨条同行滚动 */
export const AudioLaneLabel = memo(function AudioLaneLabel({ hasAudio }: { hasAudio: boolean }) {
  return (
    <div className="flex w-full items-center gap-1.5 px-2 text-[11px] text-neutral-400" style={{ height: AUDIO_ROW_H }}>
      <span className={`h-2 w-2 shrink-0 rounded-sm ${hasAudio ? "bg-emerald-500" : "bg-neutral-300"}`} />
      <span className="truncate">配音</span>
    </div>
  );
});

/** 右侧音轨条:从场景起点铺开,超出场景时长截断;无配音画虚线空轨占位。
 *  整体 pointer-events-none,点它等于点时间线空白处(拖拽擦洗),时长信息直接写进条内。 */
export const AudioLaneTrack = memo(function AudioLaneTrack({
  src,
  sceneDur,
  pps,
  top,
}: {
  src: string | undefined;
  sceneDur: number;
  pps: number;
  top: number;
}) {
  const audioDur = useAudioDuration(src);
  if (!src) {
    return (
      <div
        className="pointer-events-none absolute inset-x-0 flex items-center justify-center rounded-[5px] border border-dashed border-emerald-200"
        style={{ top, height: AUDIO_BAR_H }}
      >
        <span className="text-[9px] text-emerald-300">未设置配音 · 顶部「＋ 配音」选文件或「TTS」合成</span>
      </div>
    );
  }
  const over = audioDur !== null && audioDur > sceneDur + 0.05;
  const shown = Math.min(audioDur ?? sceneDur, sceneDur);
  const width = Math.max(shown * pps, 8);
  return <AudioBar src={src} width={width} over={over} label={`♪ 配音 ${audioDur !== null ? `${audioDur.toFixed(1)}s` : "?"}${over ? " · 超出截断" : ""}`} top={top} />;
});

/** 波形条:峰值按 ~3px 一列二次采样,列数随缩放宽度变化(峰值本身有缓存) */
function AudioBar({
  src,
  width,
  over,
  label,
  top,
}: {
  src: string;
  width: number;
  over: boolean;
  label: string;
  top: number;
}) {
  const peaks = useAudioPeaks(src);
  const cols = Math.max(0, Math.min(160, Math.floor((width - 12) / 3)));
  const bars = useMemo(() => (peaks && cols > 0 ? resamplePeaks(peaks, cols) : []), [peaks, cols]);
  return (
    <div
      className={`pointer-events-none absolute overflow-hidden rounded-[5px] shadow-sm ${over ? "bg-amber-600" : "bg-emerald-600"}`}
      style={{ left: 0, top, width, height: AUDIO_BAR_H }}
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
