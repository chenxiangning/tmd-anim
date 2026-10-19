import { useEffect, useRef, useState } from "react";
import type { Project } from "../core/types";
import { GearButton } from "../app/GearButton";
import { AiGuideDialog } from "./AiGuideDialog";

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
  /** 导出当前帧 PNG,resolve 为落盘路径(或浏览器下载文件名),reject 为失败原因 */
  onExportFrame(): Promise<string>;
  /** 项目文件绝对路径;local 后端为 null(AI 提示词改用导入指引) */
  aiPromptPath: string | null;
  onOpenSettings(): void;
}

const segBtn = "px-2.5 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50";

/** 编辑器顶栏:返回 / 项目名 / 保存态 / 存储后端 / 重载(文件后端) / 导出分段组 / AI 调整 / 预览 / 设置。 */
export function EditorHeader({ project, saveState, backend, previewing, onRename, onExit, onTogglePreview, onReload, onExport, onExportHtml, onExportVideo, onExportFrame, aiPromptPath, onOpenSettings }: EditorHeaderProps) {
  // 瞬时提示文案(导出帧落盘路径),几秒后自动消失
  const [flash, setFlash] = useState<string | null>(null);
  const [aiGuideOpen, setAiGuideOpen] = useState(false);
  const flashTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);
  const showFlash = (message: string) => {
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 4000);
    setFlash(message);
  };
  const handleExportFrame = () => {
    onExportFrame()
      .then((path) => showFlash(`帧已导出:${path}`))
      .catch((e: unknown) => showFlash(`导出失败:${e instanceof Error ? e.message : String(e)}`));
  };
  return (
    <header className="relative flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-2.5">
      <button className="btn btn-ghost" onClick={onExit} title="返回项目主页(已自动保存)">
        ← 主页
      </button>
      <input
        className="w-64 rounded-lg border border-transparent px-2 py-1.5 text-sm font-semibold text-neutral-900 outline-none transition-colors hover:border-neutral-200 focus:border-slate-400"
        value={project.name}
        onChange={(e) => onRename(e.target.value)}
        title="项目名"
      />
      <span
        className={`flex items-center gap-1 text-[11px] ${saveState === "saved" ? "text-emerald-600" : "text-neutral-400"}`}
        title={saveState === "saved" ? "所有修改已写入存储" : "正在写入存储…"}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${saveState === "saved" ? "bg-emerald-500" : "animate-pulse bg-amber-400"}`} />
        {saveState === "saved" ? "已保存" : "保存中…"}
      </span>
      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-400" title={backend === "tauri" ? "项目文件落盘 ~/.tmd-anim/projects/,agent 可直接读写" : "浏览器 localStorage"}>
        {backend === "tauri" ? "文件存储 ~/.tmd-anim/projects/" : "浏览器存储"}
      </span>
      <div className="ml-auto flex items-center gap-2">
        {flash && (
          <span className="absolute right-3 top-full z-10 mt-1 max-w-96 truncate rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-[11px] text-neutral-500 shadow-sm" title={flash}>
            {flash}
          </span>
        )}
        {backend === "tauri" && (
          <button className="btn btn-secondary" onClick={onReload} title="磁盘文件可能被 agent 改过,点此重新载入">
            重新载入
          </button>
        )}
        <button className="btn btn-secondary" onClick={handleExportFrame} title="把当前播放头这一帧渲染为 PNG,落盘 ~/.tmd-anim/frames/ 并下载">
          导出帧
        </button>
        <div className="flex overflow-hidden rounded-lg border border-neutral-200 bg-white">
          {backend === "local" && (
            <button className={segBtn} onClick={onExport} title="下载项目 JSON">
              JSON
            </button>
          )}
          <button className={`${segBtn} border-l border-neutral-200 first:border-l-0`} onClick={onExportHtml} title="下载单文件 HTML,双击即可在浏览器播放动画">
            网页
          </button>
          <button className={`${segBtn} border-l border-neutral-200`} onClick={onExportVideo} title="逐帧渲染并编码为 mp4(WebCodecs)">
            视频
          </button>
        </div>
        <button className="btn btn-secondary" onClick={() => setAiGuideOpen(true)} title="弹出引导:复制提示词给 coding agent,或一键安装小黑技能到本机 AI">
          AI 调整
        </button>
        <button className="btn btn-primary" onClick={onTogglePreview}>
          {previewing ? "退出预览" : "预览"}
        </button>
        <GearButton onClick={onOpenSettings} />
      </div>
      <AiGuideDialog
        open={aiGuideOpen}
        onClose={() => setAiGuideOpen(false)}
        projectPath={aiPromptPath}
        project={project}
        backend={backend}
      />
    </header>
  );
}
