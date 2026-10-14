import type { ReactNode } from "react";
import pkg from "../../../package.json";
import { isDesktop, openExternal, relaunchApp, runUpdate, useUpdateState } from "./updater";

const REPO_URL = pkg.homepage;
const RELEASES_URL = `${pkg.homepage}/releases`;

const LAYOUT_KEYS = ["tmd-anim:panels", "tmd-anim:lib-w", "tmd-anim:prop-w", "tmd-anim:timeline-h"];

function GithubMark({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-[13px] font-semibold text-neutral-800">{title}</h2>
      {children}
    </section>
  );
}

/** 更新卡:浏览器态给 releases 兜底;桌面态一键 检查→下载→安装→重启。 */
function UpdateCard() {
  const s = useUpdateState();
  if (!isDesktop) {
    return (
      <Card title="更新">
        <p className="mb-3 text-xs leading-relaxed text-neutral-500">
          当前为浏览器版,应用内更新仅在桌面版可用。可前往 Releases 下载最新构建。
        </p>
        <button className="btn btn-secondary" onClick={() => void openExternal(RELEASES_URL)}>
          前往 Releases
        </button>
      </Card>
    );
  }
  return (
    <Card title="更新">
      <div className="mb-3 flex items-center gap-2 text-xs text-neutral-500">
        <span>
          当前版本 <span className="font-mono text-neutral-700">v{pkg.version}</span>
        </span>
        {s.stage === "latest" && <span className="flex items-center gap-1 text-emerald-600">已是最新</span>}
        {s.stage === "available" && (
          <span className="text-neutral-700">
            发现新版本 <span className="font-mono">v{s.version}</span>
          </span>
        )}
      </div>
      {(s.stage === "downloading" || s.stage === "available") && (
        <div className="mb-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
            <div
              className={`h-full rounded-full bg-slate-900 ${s.progress === null ? "w-1/3 animate-pulse" : "transition-[width] duration-150"}`}
              style={s.progress === null ? undefined : { width: `${Math.max(s.progress * 100, 4)}%` }}
            />
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">
            {s.progress === null ? "正在下载…" : `正在下载… ${Math.round(s.progress * 100)}%`}
          </div>
        </div>
      )}
      {s.stage === "error" && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-600">
          更新失败:{s.error}
        </p>
      )}
      <div className="flex items-center gap-2">
        {s.stage === "ready" ? (
          <button className="btn btn-primary" onClick={() => void relaunchApp()}>
            重启完成安装(v{s.version})
          </button>
        ) : (
          <button
            className="btn btn-primary"
            disabled={s.stage === "checking" || s.stage === "downloading" || s.stage === "available"}
            onClick={() => void runUpdate()}
          >
            {s.stage === "checking" ? "正在检查…" : s.stage === "error" ? "重试更新" : "检查更新"}
          </button>
        )}
        {s.stage === "error" && (
          <button className="btn btn-secondary" onClick={() => void openExternal(RELEASES_URL)}>
            前往 Releases 手动下载
          </button>
        )}
      </div>
    </Card>
  );
}

/** 设置页:关于 / 更新 / 界面 / 存储。主页与编辑器顶栏齿轮进入,返回回到来源页。 */
export function SettingsView({ backend, onExit }: { backend: "local" | "tauri"; onExit(): void }) {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-neutral-200 bg-white px-6 py-3">
        <button className="btn btn-ghost -ml-2" onClick={onExit} title="返回">
          ← 返回
        </button>
        <h1 className="text-sm font-semibold text-neutral-900">设置</h1>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto bg-neutral-50">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6">
          <Card title="关于">
            <div className="flex items-center gap-3">
              <img src="/icon.png" alt="tmd-anim" className="h-12 w-12 rounded-xl" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-neutral-900">
                  tmd-anim <span className="ml-1 font-mono text-xs font-normal text-neutral-400">v{pkg.version}</span>
                </div>
                <div className="mt-0.5 text-xs text-neutral-400">技术动画视频制作:场景 JSON 进,确定性视频出</div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button className="btn btn-secondary" onClick={() => void openExternal(REPO_URL)}>
                <GithubMark className="h-3.5 w-3.5" />
                GitHub 仓库
              </button>
              <button className="btn btn-secondary" onClick={() => void openExternal(`${REPO_URL}/issues`)}>
                问题反馈
              </button>
              <button className="btn btn-secondary" onClick={() => void openExternal(`${REPO_URL}/blob/main/README.md`)}>
                使用文档
              </button>
            </div>
          </Card>

          <UpdateCard />

          <Card title="界面">
            <p className="mb-3 text-xs leading-relaxed text-neutral-500">
              面板开合状态与宽度/高度记忆在本地;布局调乱后可一键复位。
            </p>
            <button
              className="btn btn-secondary"
              onClick={() => {
                LAYOUT_KEYS.forEach((k) => localStorage.removeItem(k));
                location.reload();
              }}
            >
              重置面板布局
            </button>
          </Card>

          <Card title="存储">
            <p className="text-xs leading-relaxed text-neutral-500">
              {backend === "tauri" ? (
                <>
                  项目以 JSON 文件落盘 <span className="font-mono text-neutral-700">~/.tmd-anim/projects/</span>
                  ,可直接用编辑器或 agent 读写;编辑器顶栏「重新载入」拉回磁盘改动。
                </>
              ) : (
                "项目保存在浏览器 localStorage,清理站点数据会丢失;桌面版使用文件存储。"
              )}
            </p>
          </Card>
        </div>
      </main>
    </div>
  );
}
