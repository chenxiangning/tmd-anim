import type { Project } from "../core/types";
import { alignElements, type AlignMode } from "./editOps";

/** 多选时的对齐/分布工具条(渲染在属性面板空选分支);分布按钮仅在 ≥3 选时出现。 */

const ALIGN_LABELS: Array<[AlignMode, string]> = [
  ["left", "左对齐"], ["hcenter", "水平居中"], ["right", "右对齐"],
  ["top", "顶对齐"], ["vcenter", "垂直居中"], ["bottom", "底对齐"],
  ["distH", "横向分布"], ["distV", "纵向分布"],
];

const btnCls = "rounded-md border border-neutral-200 py-1 text-[11px] text-neutral-600 transition-colors hover:bg-neutral-100";

export function AlignToolbar({ project, sceneIdx, selIds, onPatch, canDistribute }: {
  project: Project;
  sceneIdx: number;
  selIds: string[];
  canDistribute: boolean;
  onPatch: (next: Project, coalesceKey?: string) => void;
}) {
  const run = (mode: AlignMode) => onPatch(alignElements(project, sceneIdx, selIds, mode), `align:${mode}`);
  return (
    <div className="mt-4 w-full">
      <span className="mb-1 block text-[11px] font-medium text-neutral-500">对齐</span>
      <div className="mb-1.5 grid grid-cols-3 gap-1.5">
        {ALIGN_LABELS.slice(0, 6).map(([mode, label]) => (
          <button key={mode} className={btnCls} onClick={() => run(mode)}>{label}</button>
        ))}
      </div>
      {canDistribute && (
        <div className="grid grid-cols-2 gap-1.5">
          {ALIGN_LABELS.slice(6).map(([mode, label]) => (
            <button key={mode} className={btnCls} onClick={() => run(mode)}>{label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
