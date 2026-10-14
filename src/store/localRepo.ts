import type { Project } from "../core/types";
import { metaOf, type ProjectMeta, type ProjectRepo } from "./projects";

/** localStorage 后端:项目 JSON 与更新时间分键存放,存储面可注入便于单测。 */

const PROJECT_PREFIX = "tmd-anim:project:";
const META_PREFIX = "tmd-anim:meta:";

export interface KvStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  readonly length: number;
}

export function createLocalRepo(storage: KvStorage = window.localStorage): ProjectRepo {
  const ids = (): string[] => {
    const out: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(PROJECT_PREFIX)) out.push(key.slice(PROJECT_PREFIX.length));
    }
    return out;
  };
  return {
    backend: "local",
    async list(): Promise<ProjectMeta[]> {
      const metas: ProjectMeta[] = [];
      for (const id of ids()) {
        const raw = storage.getItem(PROJECT_PREFIX + id);
        if (!raw) continue;
        const updatedAt = Number(storage.getItem(META_PREFIX + id) ?? 0);
        try {
          metas.push(metaOf(id, JSON.parse(raw) as Project, updatedAt));
        } catch {
          // 坏数据跳过,不让单个项目拖垮主页
        }
      }
      return metas.sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async load(id: string): Promise<Project> {
      const raw = storage.getItem(PROJECT_PREFIX + id);
      if (!raw) throw new Error(`项目不存在:${id}`);
      return JSON.parse(raw) as Project;
    },
    async save(id: string, project: Project): Promise<void> {
      storage.setItem(PROJECT_PREFIX + id, JSON.stringify(project));
      storage.setItem(META_PREFIX + id, String(Date.now()));
    },
    async remove(id: string): Promise<void> {
      storage.removeItem(PROJECT_PREFIX + id);
      storage.removeItem(META_PREFIX + id);
    },
    async pathOf(_id: string): Promise<string | null> {
      return null; // 浏览器无项目文件,watch 等文件面功能关闭
    },
  };
}
