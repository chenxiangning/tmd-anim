import type { Project } from "../core/types";
import { normalizeProject } from "../core/normalize";
import { metaOf, type ProjectMeta, type ProjectRepo } from "./projects";

/**
 * Tauri plugin-fs 后端:项目落盘 $HOME/.tmd-anim/projects/<id>.json。
 * 纯场景 JSON 落盘,coding agent 可直接读写该目录(见 docs/schema.md)。
 * lastSeen 按项目记录「本应用最后一次观察/写入的盘上原文」,是守卫写的依据:
 * 读(load/readRaw)与写(save/saveIfUnchanged)都刷新它,盘上与之不同即视为外部修改。
 */

const RELATIVE_DIR = ".tmd-anim/projects";

export async function createTauriRepo(): Promise<ProjectRepo> {
  const fs = await import("@tauri-apps/plugin-fs");
  const { homeDir, join } = await import("@tauri-apps/api/path");
  const dir = await join(await homeDir(), RELATIVE_DIR);
  await fs.mkdir(dir, { recursive: true });
  const fileOf = (id: string): string => `${id}.json`;
  const pathOf = async (id: string): Promise<string> => join(dir, fileOf(id));
  const lastSeen = new Map<string, string>();
  const canonical = (project: Project): string => JSON.stringify(project, null, 2);
  return {
    backend: "tauri",
    async list(): Promise<ProjectMeta[]> {
      const entries = await fs.readDir(dir);
      const metas: ProjectMeta[] = [];
      for (const entry of entries) {
        if (!entry.name || !entry.name.endsWith(".json")) continue;
        const id = entry.name.slice(0, -".json".length);
        try {
          const raw = await fs.readTextFile(await join(dir, entry.name));
          const modifiedAt = (entry as { modifiedAt?: Date | null }).modifiedAt;
          metas.push(metaOf(id, JSON.parse(raw) as Project, modifiedAt?.getTime() ?? 0));
        } catch {
          // 坏文件跳过
        }
      }
      return metas.sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async load(id: string): Promise<Project> {
      const raw = await fs.readTextFile(await pathOf(id));
      lastSeen.set(id, raw);
      return normalizeProject(JSON.parse(raw));
    },
    async save(id: string, project: Project): Promise<void> {
      const text = canonical(project);
      await fs.writeTextFile(await pathOf(id), text);
      lastSeen.set(id, text);
    },
    async saveIfUnchanged(id: string, project: Project): Promise<"saved" | "conflict"> {
      const path = await pathOf(id);
      const expected = lastSeen.get(id);
      let disk: string;
      try {
        disk = await fs.readTextFile(path);
      } catch {
        disk = null as unknown as string; // 文件不存在(首次保存),没有外部内容可覆盖
      }
      // 读-比对-写之间存在毫秒级窗口,plugin-fs 无原子 CAS;窗口量级远小于盲写,可接受。
      // 基线缺失(从未在本会话观察过)但盘上有内容时同样拒写:宁可误报冲突也不覆盖来路不明的修改
      if (disk !== null && disk !== expected) return "conflict";
      const text = canonical(project);
      await fs.writeTextFile(path, text);
      lastSeen.set(id, text);
      return "saved";
    },
    async readRaw(id: string): Promise<string | null> {
      try {
        const raw = await fs.readTextFile(await pathOf(id));
        lastSeen.set(id, raw);
        return raw;
      } catch {
        return null;
      }
    },
    async remove(id: string): Promise<void> {
      await fs.remove(await pathOf(id));
      lastSeen.delete(id);
    },
    async pathOf(id: string): Promise<string | null> {
      return pathOf(id);
    },
  };
}
