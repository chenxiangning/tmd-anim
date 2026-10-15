import type { Scene } from "../core/types";

const labelCls = "mb-1 block text-[11px] font-medium text-neutral-500";

/** 配音编辑卡(属性面板):语速做时长压缩/拉伸(变速不变调)+ 音量;
 *  配音有效时长超过画面时场景自动延长,保证播完再切幕。 */
export function AudioPropsCard({
  audio,
  sceneSec,
  onPatch,
  onRemove,
}: {
  audio: NonNullable<Scene["audio"]>;
  sceneSec: number;
  onPatch(next: NonNullable<Scene["audio"]>, coalesceKey: string): void;
  onRemove(): void;
}) {
  const rate = audio.rate ?? 1;
  const volume = audio.volume ?? 1;
  const raw = audio.duration;
  const eff = raw !== undefined && raw > 0 ? raw / rate : null;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <p className="mb-3 text-[11px] leading-relaxed text-neutral-400">
        配音随本场景起点播放。语速 &gt;1 压缩、&lt;1 拉伸,变速不变调;配音比画面长时本幕自动延长到配音结束。
      </p>
      <div className="mb-4 flex items-center justify-between font-mono text-[11px] text-neutral-500">
        <span>原始 {raw !== undefined ? `${raw.toFixed(1)}s` : "探测中…"}</span>
        <span>有效 {eff !== null ? `${eff.toFixed(1)}s` : "?"}</span>
        <span>本幕 {sceneSec.toFixed(1)}s</span>
      </div>
      <label className="mb-4 block">
        <span className={labelCls}>语速(压缩 / 拉伸)</span>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0.25}
            max={2}
            step={0.05}
            value={rate}
            onChange={(e) => onPatch({ ...audio, rate: Number(e.target.value) }, "audioRate")}
            className="h-1 flex-1 cursor-pointer accent-emerald-600"
          />
          <span className="w-12 shrink-0 text-right font-mono text-xs text-neutral-600">{rate.toFixed(2)}x</span>
        </div>
      </label>
      <label className="mb-4 block">
        <span className={labelCls}>音量</span>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={volume}
            onChange={(e) => onPatch({ ...audio, volume: Number(e.target.value) }, "audioVolume")}
            className="h-1 flex-1 cursor-pointer accent-emerald-600"
          />
          <span className="w-12 shrink-0 text-right font-mono text-xs text-neutral-600">{volume.toFixed(1)}x</span>
        </div>
      </label>
      <button
        className="w-full rounded-md border border-red-200 py-1.5 text-[11px] text-red-500 transition-colors hover:bg-red-50"
        onClick={onRemove}
      >
        移除配音
      </button>
    </div>
  );
}
