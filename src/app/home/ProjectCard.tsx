import { useMemo } from "react";
import type { Project } from "../../core/types";
import type { ProjectMeta, ProjectRepo } from "../../store/projects";
import { fmtTime } from "./timeGroups";
import { renderCover } from "./cover";

export interface Entry {
  meta: ProjectMeta;
  project: Project;
}

const btn = "rounded-lg px-3 py-1 text-xs font-medium transition-colors";

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
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition-all hover:border-neutral-300 hover:shadow-md">
      <button className="block w-full text-left" onClick={() => onOpen(entry.meta.id)} title="打开编辑">
        {cover ? (
          <img src={cover} alt="" className="aspect-[2/1] w-full bg-neutral-100 object-cover" />
        ) : (
          <div className="aspect-[2/1] w-full bg-neutral-100" />
        )}
      </button>
      <div className="px-2.5 py-2">
        <div className="truncate text-[13px] font-medium text-neutral-900">{entry.project.name}</div>
        <div className="mt-0.5 text-[11px] text-neutral-400">
          {entry.meta.sceneCount} 个场景 · {entry.meta.duration.toFixed(1)}s · {fmtTime(entry.meta.updatedAt)}
        </div>
        <div className="mt-2 flex items-center gap-1">
          <button className={`${btn} flex-1 bg-slate-900 text-white hover:bg-slate-700`} onClick={() => onOpen(entry.meta.id)}>
            编辑
          </button>
          {repo.backend === "local" && (
            <button className={`${btn} border border-neutral-200 text-neutral-600 hover:bg-neutral-100`} onClick={() => onExport(entry)}>
              导出
            </button>
          )}
          <button className={`${btn} border border-neutral-200 text-neutral-600 hover:bg-neutral-100`} onClick={() => onDuplicate(entry)}>
            复制
          </button>
          <button
            className={`${btn} ${confirm ? "bg-red-500 text-white hover:bg-red-600" : "border border-neutral-200 text-neutral-500 hover:bg-red-50 hover:text-red-500"}`}
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
