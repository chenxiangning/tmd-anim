import type { Project } from "../core/types";
import { metaOf, type ProjectMeta, type ProjectRepo } from "./projects";

/**
 * Tauri plugin-fs 后端:项目落盘 $HOME/.tmd-anim/projects/<id>.json。
 * 纯场景 JSON 落盘,coding agent 可直接读写该目录(见 docs/schema.md)。
 */

const RELATIVE_DIR = ".tmd-anim/projects";

export async function createTauriRepo(): Promise<ProjectRepo> {
  const fs = await import("@tauri-apps/plugin-fs");
  const { homeDir, join } = await import("@tauri-apps/api/path");
  const dir = await join(await homeDir(), RELATIVE_DIR);
  await fs.mkdir(dir, { recursive: true });
  const fileOf = (id: string): string => `${id}.json`;
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
      const raw = await fs.readTextFile(await join(dir, fileOf(id)));
      return JSON.parse(raw) as Project;
    },
    async save(id: string, project: Project): Promise<void> {
      await fs.writeTextFile(await join(dir, fileOf(id)), JSON.stringify(project, null, 2));
    },
    async remove(id: string): Promise<void> {
      await fs.remove(await join(dir, fileOf(id)));
    },
    async pathOf(id: string): Promise<string | null> {
      return join(dir, fileOf(id));
    },
  };
}
