import { useRef } from "react";
import type { Project } from "../core/types";
import { sceneDuration } from "../core/timeline";

interface SceneStripProps {
  project: Project;
  sceneIdx: number;
  onSelectScene: (idx: number) => void;
  onAddScene: () => void;
  onDuplicateScene: () => void;
  onRemoveScene: () => void;
  onMoveScene: (delta: -1 | 1) => void;
  onRenameScene: (name: string) => void;
  onDwell: (seconds: number) => void;
  onSetAudio: (audio: { src: string; volume?: number } | undefined) => void;
}

/** 操作台场景组:场景芯片 + 管理 + 停留秒数 + 场景配音;外框由 TimelinePanel 统一提供。 */
export function SceneStrip({
  project,
  sceneIdx,
  onSelectScene,
  onAddScene,
  onDuplicateScene,
  onRemoveScene,
  onMoveScene,
  onRenameScene,
  onDwell,
  onSetAudio,
}: SceneStripProps) {
  const scene = project.scenes[sceneIdx];
  const fileRef = useRef<HTMLInputElement>(null);
  const btn =
    "shrink-0 whitespace-nowrap rounded-md border border-neutral-200 px-1.5 py-0.5 text-[10px] text-neutral-600 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40";

  const pickAudio = (): void => {
    const input = fileRef.current;
    if (!input) return;
    input.value = "";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => onSetAudio({ src: String(reader.result), volume: 1 });
      reader.readAsDataURL(file);
    };
    input.click();
  };
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
      <span className="shrink-0 text-[10px] text-neutral-400">场景</span>
      {project.scenes.map((s, i) => {
        const active = i === sceneIdx;
        return active ? (
          <input
            key={s.id}
            className="w-20 shrink-0 whitespace-nowrap rounded-md bg-slate-900 px-2 py-0.5 text-[10px] text-white outline-none"
            value={s.name}
            title="场景名,直接编辑"
            onChange={(e) => onRenameScene(e.target.value)}
          />
        ) : (
          <button
            key={s.id}
            onClick={() => onSelectScene(i)}
            className="shrink-0 whitespace-nowrap rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600 transition-colors hover:bg-neutral-200"
          >
            {i + 1}. {s.name}
          </button>
        );
      })}
      <span className="mx-0.5 h-4 w-px shrink-0 bg-neutral-200" />
      <button className={btn} onClick={onAddScene}>
        + 新建
      </button>
      <button className={btn} onClick={onDuplicateScene}>
        复制
      </button>
      <button className={btn} onClick={onRemoveScene} disabled={project.scenes.length <= 1}>
        删除
      </button>
      <button className={btn} onClick={() => onMoveScene(-1)} disabled={sceneIdx === 0}>
        左移
      </button>
      <button className={btn} onClick={() => onMoveScene(1)} disabled={sceneIdx === project.scenes.length - 1}>
        右移
      </button>
      {scene && (
        <label className="ml-auto flex shrink-0 items-center gap-1 text-[10px] text-neutral-500">
          {scene.audio?.src ? (
            <button className={`${btn} !text-emerald-600`} onClick={() => onSetAudio(undefined)} title="点击移除当前场景配音">
              配音 ✓
            </button>
          ) : (
            <button className={btn} onClick={pickAudio} title="选择音频文件作为本场景配音,随场景起点播放">
              配音
            </button>
          )}
          <input ref={fileRef} type="file" accept="audio/*" className="hidden" />
          停留
          <input
            type="number"
            min={0}
            step={0.5}
            className="w-12 rounded-md border border-neutral-200 px-1.5 py-0.5 text-[10px] outline-none focus:border-slate-400"
            value={scene.dwell ?? 1.5}
            onChange={(e) => onDwell(Number(e.target.value) || 0)}
          />
          秒
          <span className="ml-1 font-mono text-neutral-400">本幕 {sceneDuration(scene).toFixed(1)}s</span>
        </label>
      )}
    </div>
  );
}
