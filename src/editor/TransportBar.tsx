interface TransportBarProps {
  playing: boolean;
  t: number;
  total: number;
  pps: number;
  onZoom(factor: number): void;
  onFit(): void;
  onTogglePlay(): void;
  onPrevScene(): void;
  onNextScene(): void;
  onToggleCollapse(): void;
}

function fmt(sec: number): string {
  return `${sec.toFixed(1)}s`;
}

const btn =
  "flex h-6 items-center justify-center rounded-md border border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-100";

/** 操作台工具组:折叠 / 场景跳转 / 播放暂停 / 全局时间 / 时间轴缩放;外框由 TimelinePanel 统一提供。 */
export function TransportBar({ playing, t, total, pps, onZoom, onFit, onTogglePlay, onPrevScene, onNextScene, onToggleCollapse }: TransportBarProps) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button className={`${btn} w-6`} onClick={onToggleCollapse} title="折叠动画操作台">
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 15l-6-6-6 6" />
        </svg>
      </button>
      <span className="mx-0.5 h-4 w-px bg-neutral-200" />
      <button className={`${btn} w-7`} onClick={onPrevScene} title="上一场景">
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
          <path d="M6 6h2v12H6z" />
          <path d="M20 6l-9 6 9 6z" />
        </svg>
      </button>
      <button
        className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-white transition-colors hover:bg-slate-700"
        onClick={onTogglePlay}
        title={playing ? "暂停(空格)" : "播放(空格)"}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
            <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <button className={`${btn} w-7`} onClick={onNextScene} title="下一场景">
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
          <path d="M16 6h2v12h-2z" />
          <path d="M4 6l9 6-9 6z" />
        </svg>
      </button>
      <span className="ml-1.5 font-mono text-[11px] text-neutral-700">
        {fmt(t)} <span className="text-neutral-300">/ {fmt(total)}</span>
      </span>
      <span className="mx-1.5 h-4 w-px bg-neutral-200" />
      <button className={`${btn} w-6 text-xs`} onClick={() => onZoom(1 / 1.25)} title="缩小时间轴">
        −
      </button>
      <span className="w-12 text-center font-mono text-[10px] text-neutral-500">{Math.round(pps)}px/s</span>
      <button className={`${btn} w-6 text-xs`} onClick={() => onZoom(1.25)} title="放大时间轴">
        +
      </button>
      <button className={`${btn} px-1.5 text-[10px]`} onClick={onFit} title="缩放到整个场景">
        适应
      </button>
    </div>
  );
}
