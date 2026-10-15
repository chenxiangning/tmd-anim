import type { Project } from "../core/types";
import { locate } from "../core/timeline";
import { CanvasStage } from "./CanvasStage";

interface PreviewModeProps {
  project: Project;
  t: number;
  liveUpdate: (next: Project) => void;
  onGestureBegin(): void;
  onGestureEnd(): void;
  onDropCreate(data: string, x: number, y: number): void;
  onExit(): void;
}

/** 全屏预览态:只读画布 + 底部进度提示,Esc 退出(键盘处理在 useEditorKeyboard)。 */
export function PreviewMode({ project, t, liveUpdate, onGestureBegin, onGestureEnd, onDropCreate, onExit }: PreviewModeProps) {
  return (
    <div className="flex h-full flex-col bg-neutral-900">
      <CanvasStage
        project={project}
        t={t}
        selIds={[]}
        previewing
        onSelectIds={() => undefined}
        onLivePatch={liveUpdate}
        onGestureBegin={onGestureBegin}
        onGestureEnd={onGestureEnd}
        onDropCreate={onDropCreate}
      />
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-xs text-neutral-400">
          {project.name} · {locate(project, t).index + 1}/{project.scenes.length} · {t.toFixed(1)}s
        </span>
        <button
          className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white transition-colors hover:bg-white/20"
          onClick={onExit}
        >
          退出预览(Esc)
        </button>
      </div>
    </div>
  );
}
