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
  /** 无条件写(显式覆盖,仅用于用户明确选择的场景) */
  save(id: string, project: Project): Promise<void>;
  /**
   * 守卫写:盘上内容与仓库「上次观察到」的不一致(被外部如 coding agent 改过)时
   * 拒写并返回 "conflict",盘上外部内容得以保留;一致则写入返回 "saved"。
   * 观察(读原文)与写入都会刷新「上次观察到」的基线。
   */
  saveIfUnchanged(id: string, project: Project): Promise<"saved" | "conflict">;
  /** 读项目文件原文并登记为最新观察基线;local 后端返回 null(无外部写入者) */
  readRaw(id: string): Promise<string | null>;
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
