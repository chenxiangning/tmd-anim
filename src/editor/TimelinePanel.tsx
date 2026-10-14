import { useRef, useState } from "react";
import type { Project, SceneElement } from "../core/types";
import { projectDuration, sceneDuration } from "../core/timeline";
import { animTypeLabel } from "./animMeta";
import { elementLabel, kindColor } from "./defaults";
import { updateElement } from "./editOps";
import { SceneStrip } from "./SceneStrip";
import { TransportBar } from "./TransportBar";
import { usePanelResize } from "./usePanelResize";

const ROW_H = 24;
const BAR_H = 18;
const RULER_H = 22;
const SNAP_STEP = 0.1;
const PPS_MIN = 20;
const PPS_MAX = 240;

interface TimelinePanelProps {
  project: Project;
  sceneIdx: number;
  t: number;
  localT: number;
  selIds: string[];
  playing: boolean;
  onSelect(id: string): void;
  onSeekLocal(localT: number): void;
  onLivePatch(next: Project): void;
  onGestureBegin(): void;
  onGestureEnd(): void;
  onTogglePlay(): void;
  onPrevScene(): void;
  onNextScene(): void;
  onToggleCollapse(): void;
  onSelectScene(index: number): void;
  onAddScene(): void;
  onDuplicateScene(): void;
  onRemoveScene(): void;
  onMoveScene(delta: -1 | 1): void;
  onRenameScene(name: string): void;
  onDwell(seconds: number): void;
  onSetAudio(audio: { src: string; volume?: number } | undefined): void;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function quantize(v: number): number {
  return Math.round(v / SNAP_STEP) * SNAP_STEP;
}

/** 底部动画操作台:单行工具栏(播放控制 + 场景管理)+ 元素时间线,可折叠,顶边可拖拽调高度。 */
export function TimelinePanel({
  project, sceneIdx, t, localT, selIds, playing,
  onSelect, onSeekLocal, onLivePatch, onGestureBegin, onGestureEnd,
  onTogglePlay, onPrevScene, onNextScene, onToggleCollapse,
  onSelectScene, onAddScene, onDuplicateScene, onRemoveScene, onMoveScene, onRenameScene, onDwell, onSetAudio,
}: TimelinePanelProps) {
  const scene = project.scenes[sceneIdx];
  const { size: height, startResize, resetSize: resetHeight } = usePanelResize({
    axis: "y",
    key: "tmd-anim:timeline-h",
    def: 240,
    min: 140,
    maxRatio: 0.7,
    dir: -1,
  });
  const innerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const scrollSyncing = useRef(false);
  const [pps, setPps] = useState(90);
  if (!scene) {
    return (
      <div className="flex h-44 shrink-0 items-center justify-center border-t border-neutral-200 bg-white text-xs text-neutral-400">
        当前没有场景
      </div>
    );
  }
  const duration = sceneDuration(scene);
  const total = projectDuration(project);
  const contentEnd = scene.elements.reduce((m, el) => Math.max(m, el.anim.start + el.anim.duration), 0);
  const trackWidth = Math.max(duration * pps + 40, 360);
  const rowsHeight = RULER_H + scene.elements.length * ROW_H + 8;

  const localAt = (clientX: number): number => {
    const rect = innerRef.current?.getBoundingClientRect();
    return rect ? clamp((clientX - rect.left) / pps, 0, duration) : 0;
  };

  const startSeek = (e: React.PointerEvent): void => {
    onSeekLocal(localAt(e.clientX));
    const onMove = (ev: PointerEvent) => onSeekLocal(localAt(ev.clientX));
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const startBarDrag = (e: React.PointerEvent, el: SceneElement, mode: "move" | "resize-start" | "resize-end") => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(el.id);
    onGestureBegin();
    const startX = e.clientX;
    const origin = el;
    const onMove = (ev: PointerEvent) => {
      const dxPx = ev.clientX - startX;
      if (Math.abs(dxPx) < 3) return;
      const snap = !ev.shiftKey;
      const dSec = dxPx / pps;
      let anim;
      if (mode === "move") {
        let start = clamp(origin.anim.start + dSec, 0, Math.max(0, duration - origin.anim.duration));
        if (snap) start = clamp(quantize(start), 0, Math.max(0, duration - origin.anim.duration));
        anim = { ...origin.anim, start };
      } else if (mode === "resize-start") {
        const end = origin.anim.start + origin.anim.duration;
        let start = clamp(origin.anim.start + dSec, 0, end - 0.05);
        if (snap) start = clamp(quantize(start), 0, end - 0.05);
        anim = { ...origin.anim, start, duration: end - start };
      } else {
        let nextDuration = clamp(origin.anim.duration + dSec, 0.05, duration - origin.anim.start);
        if (snap) nextDuration = clamp(quantize(nextDuration), 0.05, duration - origin.anim.start);
        anim = { ...origin.anim, duration: nextDuration };
      }
      onLivePatch(updateElement(project, sceneIdx, el.id, { anim }));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      onGestureEnd();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const zoom = (factor: number) => setPps((p) => clamp(p * factor, PPS_MIN, PPS_MAX));
  const fit = () => {
    const w = scrollRef.current?.clientWidth ?? 600;
    setPps(clamp((w - 48) / Math.max(duration, 0.1), PPS_MIN, PPS_MAX));
  };
  // 左列元素名与右侧轨道共用一条竖向滚动,互相跟随且不做二次触发
  const syncScroll = (from: "left" | "right") => {
    if (scrollSyncing.current) return;
    scrollSyncing.current = true;
    const src = from === "left" ? leftScrollRef.current : scrollRef.current;
    const dst = from === "left" ? scrollRef.current : leftScrollRef.current;
    if (src && dst) dst.scrollTop = src.scrollTop;
    scrollSyncing.current = false;
  };
  const tickStep = pps >= 48 ? 0.5 : 1;
  const ticks: number[] = [];
  for (let tick = 0; tick <= duration + 1e-6; tick += tickStep) ticks.push(Number(tick.toFixed(2)));

  return (
    <div className="flex shrink-0 flex-col overflow-hidden border-t border-neutral-200 bg-white" style={{ height }}>
      <div
        className="h-1.5 shrink-0 cursor-row-resize bg-neutral-100 transition-colors hover:bg-slate-400"
        title="拖拽调整高度,双击复位"
        onPointerDown={startResize}
        onDoubleClick={resetHeight}
      />
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-neutral-100 px-2">
        <TransportBar
          playing={playing}
          t={t}
          total={total}
          pps={pps}
          onZoom={zoom}
          onFit={fit}
          onTogglePlay={onTogglePlay}
          onPrevScene={onPrevScene}
          onNextScene={onNextScene}
          onToggleCollapse={onToggleCollapse}
        />
        <span className="h-4 w-px shrink-0 bg-neutral-200" />
        <SceneStrip
          project={project}
          sceneIdx={sceneIdx}
          onSelectScene={onSelectScene}
          onAddScene={onAddScene}
          onDuplicateScene={onDuplicateScene}
          onRemoveScene={onRemoveScene}
          onMoveScene={onMoveScene}
          onRenameScene={onRenameScene}
          onDwell={onDwell}
          onSetAudio={onSetAudio}
        />
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="relative w-36 shrink-0 border-r border-neutral-200">
          <div
            className="absolute inset-x-0 top-0 z-10 flex items-center border-b border-neutral-100 bg-white px-2 text-[10px] text-neutral-400"
            style={{ height: RULER_H }}
          >
            元素 / 时间线
          </div>
          <div
            ref={leftScrollRef}
            className="h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ paddingTop: RULER_H }}
            onScroll={() => syncScroll("left")}
          >
            {scene.elements.map((el) => (
              <button
                key={el.id}
                onClick={() => onSelect(el.id)}
                className={`flex w-full items-center gap-1.5 px-2 text-left text-[11px] ${selIds.includes(el.id) ? "bg-amber-50 text-neutral-900" : "text-neutral-500 hover:bg-neutral-50"}`}
                style={{ height: ROW_H }}
              >
                <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: kindColor(el.kind) }} />
                <span className="truncate">{elementLabel(el)}</span>
              </button>
            ))}
          </div>
        </div>
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto" onScroll={() => syncScroll("right")}>
          <div
            ref={innerRef}
            className="relative"
            style={{ width: trackWidth, height: "100%", minHeight: rowsHeight }}
            onPointerDown={(e) => {
              if (e.target === innerRef.current) startSeek(e);
            }}
          >
            <div className="absolute inset-x-0 top-0 z-10 cursor-pointer border-b border-neutral-100 bg-white" style={{ height: RULER_H }} onPointerDown={startSeek}>
              {ticks.map((tick, i) => (
                <div key={tick} className="absolute top-0 h-full" style={{ left: tick * pps }}>
                  <div className={`w-px ${i % 2 === 0 ? "h-3 bg-neutral-300" : "h-1.5 bg-neutral-200"}`} />
                  {i % 2 === 0 && <span className="absolute left-1 top-0 text-[9px] text-neutral-400">{tick.toFixed(1)}s</span>}
                </div>
              ))}
            </div>
            {duration - contentEnd > 0.01 && (
              <div
                className="pointer-events-none absolute bottom-0 flex items-center justify-center"
                style={{
                  left: contentEnd * pps,
                  width: (duration - contentEnd) * pps,
                  top: RULER_H,
                  backgroundImage: "repeating-linear-gradient(45deg, rgba(0,0,0,0.045) 0 6px, transparent 6px 12px)",
                }}
              >
                {(duration - contentEnd) * pps > 44 && (
                  <span className="text-[9px] text-neutral-400">停留 {(duration - contentEnd).toFixed(1)}s</span>
                )}
              </div>
            )}
            {scene.elements.map((el, i) => (
              <div
                key={el.id}
                className={`absolute cursor-grab rounded ${selIds.includes(el.id) ? "ring-2 ring-amber-400" : ""}`}
                style={{
                  left: el.anim.start * pps,
                  width: Math.max(el.anim.duration * pps, 8),
                  top: RULER_H + i * ROW_H + (ROW_H - BAR_H) / 2,
                  height: BAR_H,
                  background: kindColor(el.kind),
                }}
                title={`${elementLabel(el)} · ${animTypeLabel(el.anim.type)} ${el.anim.start.toFixed(1)}s + ${el.anim.duration.toFixed(1)}s`}
                onPointerDown={(e) => startBarDrag(e, el, "move")}
              >
                <span className="pointer-events-none block truncate px-1.5 text-[10px] leading-[18px] text-white">
                  {elementLabel(el)}
                </span>
                <div className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize" onPointerDown={(e) => startBarDrag(e, el, "resize-start")} />
                <div className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize" onPointerDown={(e) => startBarDrag(e, el, "resize-end")} />
              </div>
            ))}
            <div className="pointer-events-none absolute bottom-0 top-0 z-20 w-[2px] bg-red-500" style={{ left: localT * pps }}>
              <div className="absolute -left-[5px] top-0 h-3.5 w-3.5 rounded-sm bg-red-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
