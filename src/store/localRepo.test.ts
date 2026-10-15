import { describe, expect, it } from "vitest";
import type { Project } from "../core/types";
import { createLocalRepo, type KvStorage } from "./localRepo";

function fakeStorage(): KvStorage & { dump(): Record<string, string> } {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
    dump: () => Object.fromEntries(map),
  };
}

const demo: Project = {
  version: 1,
  name: "演示",
  scenes: [{ id: "sc", name: "s", dwell: 1, elements: [] }],
};

describe("localRepo", () => {
  it("save/load 往返,项目保持纯 JSON", async () => {
    const storage = fakeStorage();
    const repo = createLocalRepo(storage);
    await repo.save("p1", demo);
    expect(JSON.parse(storage.dump()["tmd-anim:project:p1"])).toEqual(demo);
    // load 走归一化:缺省 canvas 等字段补默认值
    expect(await repo.load("p1")).toEqual({ ...demo, canvas: { width: 1920, height: 1080, bg: "#F4F4F1" } });
  });

  it("list 返回元信息并按更新时间倒序", async () => {
    const storage = fakeStorage();
    const repo = createLocalRepo(storage);
    await repo.save("p1", demo);
    await new Promise((r) => setTimeout(r, 5));
    await repo.save("p2", { ...demo, name: "第二" });
    const metas = await repo.list();
    expect(metas.map((m) => m.id)).toEqual(["p2", "p1"]);
    expect(metas[1]).toMatchObject({ id: "p1", name: "演示", sceneCount: 1, duration: 1.1 });
  });

  it("remove 清掉项目与元信息", async () => {
    const storage = fakeStorage();
    const repo = createLocalRepo(storage);
    await repo.save("p1", demo);
    await repo.remove("p1");
    expect((await repo.list())).toEqual([]);
    await expect(repo.load("p1")).rejects.toThrow(/项目不存在/);
  });

  it("list 跳过损坏数据", async () => {
    const storage = fakeStorage();
    storage.setItem("tmd-anim:project:bad", "{oops");
    const repo = createLocalRepo(storage);
    expect(await repo.list()).toEqual([]);
  });

  it("load/list 归一化缺省字段:缺 anim.start 不产生 NaN 时长", async () => {
    const storage = fakeStorage();
    storage.setItem(
      "tmd-anim:project:sparse",
      JSON.stringify({
        version: 1,
        name: "稀疏",
        scenes: [
          {
            id: "sc",
            name: "s",
            dwell: 1,
            elements: [{ kind: "text", text: "hi", anim: { type: "fade", duration: 0.5 } }],
          },
        ],
      }),
    );
    const repo = createLocalRepo(storage);
    const loaded = await repo.load("sparse");
    expect(loaded.scenes[0].elements[0].anim.start).toBe(0);
    const metas = await repo.list();
    expect(metas[0]).toMatchObject({ id: "sparse", duration: 1.5 });
  });
});
