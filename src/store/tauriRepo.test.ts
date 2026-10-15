import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "../core/types";
import { createTauriRepo } from "./tauriRepo";

/** 守卫写:盘上内容与「本应用上次观察到」不一致(外部改过)时必须拒写,保住 agent 的修改 */

const files = vi.hoisted(() => ({ map: new Map<string, string>() }));

vi.mock("@tauri-apps/plugin-fs", () => ({
  mkdir: async () => undefined,
  readDir: async () => [],
  readTextFile: async (p: string) => {
    const t = files.map.get(p);
    if (t === undefined) throw new Error("NotFound");
    return t;
  },
  writeTextFile: async (p: string, t: string) => void files.map.set(p, t),
  remove: async (p: string) => void files.map.delete(p),
}));

vi.mock("@tauri-apps/api/path", () => ({
  homeDir: async () => "/home/u",
  join: async (...parts: string[]) => parts.join("/"),
}));

const demo: Project = {
  version: 1,
  name: "演示",
  scenes: [{ id: "sc", name: "s", dwell: 1, elements: [] }],
};

const fileOf = (id: string): string => `/home/u/.tmd-anim/projects/${id}.json`;

describe("tauriRepo saveIfUnchanged", () => {
  beforeEach(() => files.map.clear());

  it("load 后无外部改动,守卫写正常落盘", async () => {
    files.map.set(fileOf("p1"), JSON.stringify(demo));
    const repo = await createTauriRepo();
    await repo.load("p1");
    const next = { ...demo, name: "改过" };
    expect(await repo.saveIfUnchanged("p1", next)).toBe("saved");
    expect(JSON.parse(files.map.get(fileOf("p1"))!)).toEqual(next);
  });

  it("load 后被外部直改,守卫写拒写并保留外部内容;readRaw 登记后恢复可写", async () => {
    files.map.set(fileOf("p1"), JSON.stringify(demo));
    const repo = await createTauriRepo();
    await repo.load("p1");
    // 模拟 agent 绕过应用直写文件
    const external = JSON.stringify({ ...demo, name: "agent 改的", scenes: demo.scenes.concat() });
    files.map.set(fileOf("p1"), external);
    expect(await repo.saveIfUnchanged("p1", { ...demo, name: "编辑器版本" })).toBe("conflict");
    expect(files.map.get(fileOf("p1"))).toBe(external);
    // 编辑器经 readRaw 观察到外部版本(热重载路径)后,基线对齐,恢复可写
    expect(await repo.readRaw("p1")).toBe(external);
    expect(await repo.saveIfUnchanged("p1", { ...demo, name: "再次保存" })).toBe("saved");
  });

  it("冲突后用户显式选择覆盖:force save 覆写盘上并重登记基线", async () => {
    files.map.set(fileOf("p1"), JSON.stringify(demo));
    const repo = await createTauriRepo();
    await repo.load("p1");
    files.map.set(fileOf("p1"), '{"外部":true}');
    await repo.save("p1", { ...demo, name: "覆盖后" });
    expect(JSON.parse(files.map.get(fileOf("p1"))!)).toEqual({ ...demo, name: "覆盖后" });
    expect(await repo.saveIfUnchanged("p1", demo)).toBe("saved");
  });

  it("文件不存在(首次保存)直接落盘", async () => {
    const repo = await createTauriRepo();
    expect(await repo.saveIfUnchanged("new", demo)).toBe("saved");
    expect(JSON.parse(files.map.get(fileOf("new"))!)).toEqual(demo);
  });

  it("基线缺失但盘上有内容(如另一实例所写):拒写而不是盲覆盖", async () => {
    files.map.set(fileOf("p1"), '{"version":1}');
    const repo = await createTauriRepo();
    expect(await repo.saveIfUnchanged("p1", demo)).toBe("conflict");
    expect(files.map.get(fileOf("p1"))).toBe('{"version":1}');
  });

  it("readRaw 登记基线,remove 清掉基线;remove 后文件消失", async () => {
    files.map.set(fileOf("p1"), JSON.stringify(demo));
    const repo = await createTauriRepo();
    expect(await repo.readRaw("p1")).toBe(JSON.stringify(demo));
    await repo.remove("p1");
    expect(files.map.has(fileOf("p1"))).toBe(false);
    expect(await repo.readRaw("p1")).toBeNull();
  });
});
