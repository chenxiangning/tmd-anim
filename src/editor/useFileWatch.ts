import { useEffect, useState } from "react";
import type { Project } from "../core/types";
import { parseProjectText } from "../app/openProject";
import type { ProjectRepo } from "../store/projects";

/** 文件变化到采纳之间的防抖:agent 常按多次写入一个文件 */
const DEBOUNCE_MS = 300;

/**
 * watch 热重载:agent 直接改项目文件后编辑器自动采纳。
 * 盯项目目录而非单文件:Windows 上「临时文件+改名替换」的原子写会让单文件
 * 监听句柄静默失效,目录事件按文件名过滤则两种写法都能收到。
 * 读取一律经 repo.readRaw:每次读到的原文都登记为守卫写的观察基线,
 * 无论随后是否采纳。采纳走 setProject 同款替换语义,不进撤销栈。
 * 防自写回声闸:自己保存的就是内存内容,归一化后字符串比对相同则忽略。
 * 返回项目文件绝对路径(local 为 null),供 AI 提示词指路。
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
      const cut = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
      const dir = path.slice(0, cut);
      const suffix = path.slice(cut); // 含开头分隔符,按平台原样匹配事件路径
      const stop = await fs.watchImmediate(dir, (e: { paths?: string[] }) => {
        if (!(e.paths ?? []).some((p) => p.endsWith(suffix))) return;
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          void repo
            .readRaw(projectId)
            .then((text) => {
              if (text === null) return;
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
