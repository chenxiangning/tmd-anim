import type { Project } from "../core/types";
import { normalizeProject } from "../core/normalize";
import { projectDuration } from "../core/timeline";

/**
 * 项目仓库:统一 list/load/save/remove 面,双后端。
 * - local:浏览器 localStorage(开发/纯 web 场景)
 * - tauri:plugin-fs 落盘 ~/.tmd-anim/projects/<id>.json —— 文件即 agent 可写契约,
 *   项目文件永远是纯场景 JSON(项目元信息不入文件)。
 */

export interface ProjectMeta {
  id: string;
  name: string;
  updatedAt: number;
  sceneCount: number;
  duration: number;
}

export interface ProjectRepo {
  backend: "local" | "tauri";
  list(): Promise<ProjectMeta[]>;
  load(id: string): Promise<Project>;
  save(id: string, project: Project): Promise<void>;
  remove(id: string): Promise<void>;
  /** 项目文件绝对路径;local 后端无文件系统,返回 null(watch 等文件面功能据此关闭) */
  pathOf(id: string): Promise<string | null>;
}

export function newProjectId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function metaOf(id: string, project: Project, updatedAt: number): ProjectMeta {
  // 列表元信息直接读原始文件:必须先归一化,否则缺省字段(如 anim.start)会算出 NaN 时长
  const p = normalizeProject(project);
  return {
    id,
    name: p.name,
    updatedAt,
    sceneCount: p.scenes.length,
    duration: projectDuration(p),
  };
}

export async function createRepo(): Promise<ProjectRepo> {
  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  if (isTauri) {
    try {
      const mod = await import("./tauriRepo");
      return await mod.createTauriRepo();
    } catch (e) {
      console.warn("tmd-anim: 文件仓库初始化失败,回落浏览器存储", e);
    }
  }
  const mod = await import("./localRepo");
  return mod.createLocalRepo();
}
