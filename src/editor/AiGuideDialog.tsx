import { useEffect, useState } from "react";
import { openExternal } from "../app/settings/updater";
import { FALLBACK_PROTOCOL_PATHS, protocolPaths, type ProtocolPaths } from "../app/agentPaths";
import { lintProject, statsOf } from "../core/lint";
import type { Project } from "../core/types";
import { buildAiPrompt, copyText } from "./aiPrompt";
import {
  checkSkillTargets,
  installAgentSkill,
  installButtonLabel,
  type SkillCheckResult,
  type SkillInstallResult,
} from "./aiSkillInstall";

/** 小黑插画风格的上游开源仓库,署名按其 NOTICE 要求保留。 */
const XIAOHEI_REPO_URL = "https://github.com/helloianneo/ian-xiaohei-illustrations";

/** 项目体检摘要:进提示词让 agent 改前就知道现状与 lint 问题(归一化后的项目上跑,组合类规则照常生效) */
function digestOf(project: Project): string {
  const stats = statsOf(project);
  const issues = lintProject(project);
  const lines = [`统计:${stats.scenes} 场景 / ${stats.elements} 元素 / 总时长 ${stats.duration.toFixed(1)}s`];
  if (issues.length === 0) {
    lines.push("lint:干净");
  } else {
    lines.push(`lint 警告 ${issues.length} 条(前 5 条,完整跑 validate --json):`);
    for (const i of issues.slice(0, 5)) lines.push(`- 场景${i.scene + 1}/${i.element}:${i.message}`);
  }
  return lines.join("\n");
}

interface AiGuideDialogProps {
  open: boolean;
  onClose(): void;
  /** 项目文件绝对路径;浏览器版为 null,提示词改用导入指引 */
  projectPath: string | null;
  /** 当前项目:体检摘要(统计 + lint)注入提示词,agent 改前即知构图问题 */
  project: Project;
  /** tauri 后端才开放技能安装;浏览器版无本地文件能力 */
  backend: "local" | "tauri";
}

/** 单条安装位置的状态徽标:未安装灰 / 已最新绿 / 有更新琥珀 */
function statusBadge(target: SkillCheckResult["targets"][number]) {
  if (!target.installed) return <span className="text-neutral-400">未安装</span>;
  if (target.upToDate) return <span className="text-emerald-700">已安装 · 已是最新</span>;
  return <span className="text-amber-600">已安装 · 有新版,可覆盖更新</span>;
}

/** 「AI 调整」引导弹窗:需求输入 + 提示词复制 + 小黑技能一键安装(显式点按,默认不动用户技能目录)+ 闭环说明。 */
export function AiGuideDialog({ open, onClose, projectPath, project, backend }: AiGuideDialogProps) {
  const [requirement, setRequirement] = useState("");
  const [copied, setCopied] = useState(false);
  const [installedNow, setInstalledNow] = useState<SkillInstallResult | null>(null);
  const [installing, setInstalling] = useState(false);
  const [check, setCheck] = useState<SkillCheckResult | null>(null);
  /** 协议/项目目录真值:提示词与徽标按当前系统显示;浏览器版回落 ~ 写法 */
  const [paths, setPaths] = useState<ProtocolPaths>(FALLBACK_PROTOCOL_PATHS);

  useEffect(() => {
    if (!open) return;
    setRequirement("");
    setCopied(false);
    setInstalledNow(null);
    setInstalling(false);
    setCheck(null);
    void protocolPaths().then(setPaths);
    if (backend === "tauri") void checkSkillTargets().then(setCheck);
  }, [open, backend]);

  if (!open) return null;

  const fullPrompt = buildAiPrompt(projectPath, paths, requirement, digestOf(project));

  const handleInstall = () => {
    setInstalling(true);
    void installAgentSkill().then((result) => {
      setInstalledNow(result);
      setInstalling(false);
      if (backend === "tauri") void checkSkillTargets().then(setCheck);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[86vh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-6 shadow-xl">
        <header className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">AI 调整:让任意 coding agent 改这条动画</h2>
          <button className="btn btn-ghost px-2 py-1 text-xs" onClick={onClose}>
            关闭
          </button>
        </header>

        <section className="flex flex-col gap-2">
          <div className="text-xs text-neutral-600">
            <span className="font-semibold text-neutral-800">第 1 步 · 复制提示词</span>
            ,粘贴给任意能读写本机文件的 AI 会话(Claude Code / ZCode / omp 等)。它会按协议改项目
            JSON,本窗口自动热重载。
          </div>
          <pre className="max-h-44 select-all overflow-y-auto whitespace-pre-wrap rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-[11px] leading-relaxed text-neutral-700">
            {fullPrompt}
          </pre>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-neutral-700">这次要改成什么样?(会拼进提示词最前面,留空则只发基础指令)</span>
            <textarea
              value={requirement}
              onChange={(e) => {
                setRequirement(e.target.value);
                setCopied(false);
              }}
              rows={3}
              placeholder="例:把标题改为「三分钟看懂 HTTP」;加一幕前后对比;整体节奏加快,标注更口语"
              className="w-full resize-y rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs leading-relaxed text-neutral-800 outline-none transition-colors placeholder:text-neutral-400 focus:border-slate-400"
            />
          </label>
          <div>
            <button
              className="btn btn-primary"
              onClick={() => void copyText(fullPrompt).then((ok) => setCopied(ok))}
            >
              {copied ? "已复制,去粘贴给 AI" : "复制提示词"}
            </button>
          </div>
        </section>

        <section className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <div className="text-xs text-neutral-600">
            <span className="font-semibold text-neutral-800">可选 · 安装「小黑」技能到本机 AI</span>
            :把一份指路技能写入下方技能目录(macOS 与 Windows 均按当前用户主目录解析实际安装位置),
            支持的 AI 听到「做动画 / 小黑配图」会自动按协议执行,无需再粘贴提示词。默认
            <b>不动你已有的任何技能</b>,只新建 tmd-anim 子目录;技能内容指向
            <code className="mx-1 rounded bg-white px-1 py-0.5 text-[10px]">{paths.dir}</code>
            ,应用升级后重装一次即刷新。
          </div>
          {backend === "tauri" && check && check.targets.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-lg border border-neutral-200 bg-white p-2">
              {check.targets.map((t) => (
                <li key={t.path} className="flex flex-wrap items-baseline gap-x-2 text-[11px] leading-relaxed">
                  <span className="font-medium text-neutral-800">{t.label}</span>
                  <code className="rounded bg-neutral-100 px-1 py-0.5 text-[10px] text-neutral-500">{t.path}</code>
                  {statusBadge(t)}
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2">
            <button className="btn btn-secondary" onClick={handleInstall} disabled={backend !== "tauri" || installing}>
              {installButtonLabel(check, installing)}
            </button>
            {backend !== "tauri" && <span className="text-[11px] text-neutral-400">浏览器版无文件权限,请用桌面版</span>}
          </div>
          {backend === "tauri" && installedNow && (
            <div className="text-[11px] leading-relaxed">
              {installedNow.unsupported && <span className="text-neutral-400">当前环境不支持本地写入。</span>}
              {installedNow.installed.length > 0 && (
                <span className="text-emerald-700">
                  已写入:
                  {installedNow.installed
                    .map((i) => `${i.label}(${i.overwritten ? "覆盖更新" : "新建"}:${i.path})`)
                    .join("、")}
                </span>
              )}
              {installedNow.failed.length > 0 && (
                <span className="text-red-600">
                  失败:{installedNow.failed.map((f) => `${f.label}(${f.reason})`).join("、")}
                </span>
              )}
            </div>
          )}
          <div className="border-t border-neutral-200 pt-2 text-[11px] text-neutral-500">
            「小黑」插画风格改编自 Ian 的开源项目{" "}
            <button
              className="text-slate-600 underline underline-offset-2 transition-colors hover:text-slate-900"
              onClick={() => void openExternal(XIAOHEI_REPO_URL)}
            >
              github.com/helloianneo/ian-xiaohei-illustrations
            </button>
            (MIT License,点按在浏览器打开)。
          </div>
        </section>

        <section className="text-xs leading-relaxed text-neutral-500">
          <span className="font-semibold text-neutral-700">闭环说明</span>:agent 改
          <code className="mx-1 rounded bg-neutral-100 px-1 py-0.5 text-[10px]">{paths.projectsDir}&lt;id&gt;.json</code>
          → 本窗口自动热重载;「导出帧」出 PNG 给 agent 或你自己回看;自查命令
          <code className="mx-1 rounded bg-neutral-100 px-1 py-0.5 text-[10px]">pnpm anim validate</code>
          需要 tmd-anim 仓克隆。
        </section>
      </div>
    </div>
  );
}
