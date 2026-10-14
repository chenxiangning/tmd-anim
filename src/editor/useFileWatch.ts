import { useEffect, useState } from "react";
import type { Project } from "../core/types";
import { parseProjectText } from "../app/openProject";
import type { ProjectRepo } from "../store/projects";

/** 文件变化到采纳之间的防抖:agent 常按多次写入一个文件 */
const DEBOUNCE_MS = 300;

/**
 * watch 热重载:agent 直接改 ~/.tmd-anim/projects/<id>.json 后编辑器自动采纳。
 * 仅 Tauri 后端生效(local 后端 pathOf 为 null 直接返回);替换走 reloadOp 同款
 * 语义,直接 setProject 不进撤销栈。防自写回声闸:自己 600ms 防抖保存的就是
 * 内存内容,归一化后字符串比对相同则忽略。返回项目文件绝对路径(local 为 null),
 * 供 AI 提示词指路。
 */
export function useFileWatch(
  repo: ProjectRepo,
  projectId: string,
  projectRef: { current: Project },
  adopt: (project: Project) => void,
): string | null {
  const [projectPath, setProjectPath] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void repo.pathOf(projectId).then((path) => {
      if (alive) setProjectPath(path);
    });
    return () => {
      alive = false;
    };
  }, [repo, projectId]);
  useEffect(() => {
    let disposed = false;
    let stopWatch: (() => void) | null = null;
    let timer: number | undefined;
    void (async () => {
      const path = await repo.pathOf(projectId);
      if (!path || disposed) return;
      // 动态导入必要:Tauri 插件模块在纯浏览器环境加载即崩,须待 pathOf 判定后再进
      const fs = await import("@tauri-apps/plugin-fs");
      const stop = await fs.watchImmediate(path, () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          void fs
            .readTextFile(path)
            .then((text) => {
              const fresh = parseProjectText(text);
              if (JSON.stringify(fresh) !== JSON.stringify(projectRef.current)) adopt(fresh);
            })
            .catch(() => undefined);
        }, DEBOUNCE_MS);
      });
      if (disposed) stop();
      else stopWatch = stop;
    })().catch(() => undefined);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      stopWatch?.();
    };
  }, [repo, projectId, projectRef, adopt]);
  return projectPath;
}
