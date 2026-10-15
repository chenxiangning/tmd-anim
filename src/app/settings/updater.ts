import { useSyncExternalStore } from "react";
// 静态引入:包本体是纯 JS,只在调用时才触达 window.__TAURI_INTERNALS__;浏览器态由 isDesktop 门禁
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { openUrl } from "@tauri-apps/plugin-opener";

/** 是否在 Tauri 桌面壳内(浏览器 dev/播放器里 updater 插件不存在)。 */
export const isDesktop =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export type UpdateStage =
  | "idle"
  | "checking"
  | "latest"
  | "available"
  | "downloading"
  | "ready"
  | "error";

export interface UpdateState {
  stage: UpdateStage;
  /** available/ready 时的目标版本号 */
  version: string | null;
  /** 下载进度 0..1;未知总量时为 null(阶段内脉冲) */
  progress: number | null;
  /** stage=error 的人话原因 */
  error: string | null;
  /** 最近一次检查完成的时间;latest 态提示 GitHub 清单的传播延迟用 */
  checkedAt: number | null;
}

const initial: UpdateState = { stage: "idle", version: null, progress: null, error: null, checkedAt: null };
let state = initial;
const listeners = new Set<() => void>();

function patch(next: Partial<UpdateState>): void {
  state = { ...state, ...next };
  listeners.forEach((fn) => fn());
}

export function useUpdateState(): UpdateState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

/** 模块级流程:下载中离开设置页进度不丢(句柄不随组件卸载)。 */
let running = false;

/** 一键「检查 → 下载 → 安装」;完成落 ready,由用户点重启。绝不抛错。 */
export async function runUpdate(): Promise<void> {
  if (running || !isDesktop) return;
  running = true;
  patch({ stage: "checking", version: null, progress: null, error: null, checkedAt: null });
  try {
    const update = await check();
    if (!update) {
      // 「无更新」可能是服务端确实没有新版,也可能是刚发布、GitHub 清单还在
      // 传播窗口内;checkedAt 供 UI 展示检查时间,避免把延迟误读成故障。
      patch({ stage: "latest", checkedAt: Date.now() });
      return;
    }
    patch({ stage: "available", version: update.version, checkedAt: Date.now() });
    let total: number | null = null;
    let downloaded = 0;
    patch({ stage: "downloading", progress: null });
    await update.downloadAndInstall((event) => {
      if (event.event === "Started") {
        total = event.data.contentLength ?? null;
      } else if (event.event === "Progress") {
        downloaded += event.data.chunkLength;
        if (total) patch({ progress: Math.min(1, downloaded / total) });
      }
    });
    patch({ stage: "ready", progress: 1 });
  } catch (e) {
    patch({ stage: "error", error: e instanceof Error ? e.message : String(e) });
  } finally {
    running = false;
  }
}

/** 重启完成安装(ready 态后调用)。 */
export async function relaunchApp(): Promise<void> {
  await relaunch();
}

/** 外链经系统浏览器打开;浏览器态回落 window.open。 */
export async function openExternal(url: string): Promise<void> {
  if (isDesktop) {
    await openUrl(url);
  } else {
    window.open(url, "_blank", "noopener");
  }
}
