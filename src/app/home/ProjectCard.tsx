import { useMemo } from "react";
import type { Project } from "../../core/types";
import type { ProjectMeta, ProjectRepo } from "../../store/projects";
import { fmtStamp } from "./timeGroups";
import { renderCover } from "./cover";

export interface Entry {
  meta: ProjectMeta;
  project: Project;
}

/** 项目卡片:封面 + 名称/元信息 + 编辑/导出/复制/删除,紧凑尺寸。 */
export function ProjectCard({
  repo,
  entry,
  onOpen,
  onExport,
  onDuplicate,
  onRemove,
  confirm,
  onConfirmChange,
}: {
  repo: ProjectRepo;
  entry: Entry;
  onOpen(id: string): void;
  onExport(entry: Entry): void;
  onDuplicate(entry: Entry): void;
  onRemove(id: string): void;
  confirm: boolean;
  onConfirmChange(id: string | null): void;
}) {
  const cover = useMemo(() => renderCover(entry.project), [entry.project]);
  return (
    <div className="group overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition-all hover:border-neutral-300 hover:shadow-md">
      <button className="block w-full cursor-pointer border-b border-neutral-100 text-left" onClick={() => onOpen(entry.meta.id)} title="打开编辑">
        {cover ? (
          <img src={cover} alt="" className="aspect-[2/1] w-full bg-neutral-100 object-cover" />
        ) : (
          <div className="flex aspect-[2/1] w-full items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100">
            <svg viewBox="0 0 24 24" className="h-8 w-8 text-neutral-300" fill="currentColor">
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
          </div>
        )}
      </button>
      <div className="px-2.5 py-2">
        <div className="truncate text-[13px] font-medium text-neutral-900">{entry.project.name}</div>
        <div className="mt-0.5 text-[11px] text-neutral-400">
          {entry.meta.sceneCount} 个场景 · {entry.meta.duration.toFixed(1)}s · 生成 {fmtStamp(entry.meta.createdAt)}
        </div>
        <div className="mt-2 flex items-center gap-1">
          <button className="btn btn-primary flex-1" onClick={() => onOpen(entry.meta.id)}>
            编辑
          </button>
          {repo.backend === "local" && (
            <button className="btn btn-secondary" onClick={() => onExport(entry)}>
              导出
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => onDuplicate(entry)}>
            复制
          </button>
          <button
            className={confirm ? "btn bg-red-500 text-white hover:bg-red-600" : "btn btn-danger"}
            onClick={() => (confirm ? onRemove(entry.meta.id) : onConfirmChange(entry.meta.id))}
            onBlur={() => onConfirmChange(null)}
          >
            {confirm ? "确认删除" : "删除"}
          </button>
        </div>
      </div>
    </div>
  );
}
