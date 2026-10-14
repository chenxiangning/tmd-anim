import type { Project } from "../core/types";

interface EditorHeaderProps {
  project: Project;
  saveState: "saved" | "saving";
  backend: "local" | "tauri";
  previewing: boolean;
  onRename(name: string): void;
  onExit(): void;
  onTogglePreview(): void;
  onReload(): void;
  onExport(): void;
  onExportHtml(): void;
  onExportVideo(): void;
}

const btn =
  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";

/** 编辑器顶栏:返回 / 项目名 / 保存态 / 存储后端 / 重载(文件后端) / 导出(JSON/网页/视频) / 预览。 */
export function EditorHeader({ project, saveState, backend, previewing, onRename, onExit, onTogglePreview, onReload, onExport, onExportHtml, onExportVideo }: EditorHeaderProps) {
  return (
    <header className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-2.5">
      <button
        className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100"
        onClick={onExit}
        title="返回项目主页(已自动保存)"
      >
        ← 主页
      </button>
      <input
        className="w-64 rounded-lg border border-transparent px-2 py-1.5 text-sm font-semibold text-neutral-900 outline-none transition-colors hover:border-neutral-200 focus:border-slate-400"
        value={project.name}
        onChange={(e) => onRename(e.target.value)}
        title="项目名"
      />
      <span className={`text-[11px] ${saveState === "saved" ? "text-emerald-600" : "text-neutral-400"}`}>
        {saveState === "saved" ? "已保存" : "保存中…"}
      </span>
      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-400" title={backend === "tauri" ? "项目文件落盘 ~/.tmd-anim/projects/,agent 可直接读写" : "浏览器 localStorage"}>
        {backend === "tauri" ? "文件存储 ~/.tmd-anim/projects/" : "浏览器存储"}
      </span>
      <div className="ml-auto flex items-center gap-2">
        {backend === "tauri" && (
          <button className={`${btn} text-neutral-600 hover:bg-neutral-100`} onClick={onReload} title="磁盘文件可能被 agent 改过,点此重新载入">
            重新载入
          </button>
        )}
        {backend === "local" && (
          <button className={`${btn} text-neutral-600 hover:bg-neutral-100`} onClick={onExport} title="下载项目 JSON">
            导出 JSON
          </button>
        )}
        <button className={`${btn} text-neutral-600 hover:bg-neutral-100`} onClick={onExportHtml} title="下载单文件 HTML,双击即可在浏览器播放动画">
          导出网页
        </button>
        <button className={`${btn} text-neutral-600 hover:bg-neutral-100`} onClick={onExportVideo} title="逐帧渲染并编码为 mp4(WebCodecs)">
          导出视频
        </button>
        <button className={`${btn} ${previewing ? "bg-slate-700 text-white hover:bg-slate-600" : "bg-slate-900 text-white hover:bg-slate-700"}`} onClick={onTogglePreview}>
          {previewing ? "退出预览" : "预览"}
        </button>
      </div>
    </header>
  );
}
