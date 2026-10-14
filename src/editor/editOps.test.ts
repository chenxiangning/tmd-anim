import { describe, expect, it } from "vitest";
import type { Project, SceneElement } from "../core/types";
import {
  addElement,
  addScene,
  duplicateScene,
  findElement,
  moveElement,
  moveScene,
  removeElement,
  removeScene,
  updateElement,
  updateScene,
} from "./editOps";

function el(id: string): SceneElement {
  return { id, kind: "badge", x: 0, y: 0, w: 100, h: 40, anim: { type: "fade", start: 0, duration: 0.5 }, text: id };
}

function project(): Project {
  return {
    version: 1,
    name: "t",
    scenes: [
      { id: "sc1", name: "一", dwell: 1, elements: [el("a"), el("b"), el("c")] },
      { id: "sc2", name: "二", dwell: 2, elements: [el("d")] },
    ],
  };
}

describe("元素操作", () => {
  it("addElement 追加且不改原对象", () => {
    const p0 = project();
    const p1 = addElement(p0, 0, el("x"));
    expect(p1.scenes[0].elements.map((e) => e.id)).toEqual(["a", "b", "c", "x"]);
    expect(p0.scenes[0].elements).toHaveLength(3);
  });

  it("updateElement 只补丁目标元素", () => {
    const p1 = updateElement(project(), 0, "b", { x: 5, y: 6 });
    const b = p1.scenes[0].elements[1];
    expect(b.x).toBe(5);
    expect(b.y).toBe(6);
    expect(b.kind).toBe("badge");
  });

  it("removeElement 过滤目标", () => {
    const p1 = removeElement(project(), 0, "b");
    expect(p1.scenes[0].elements.map((e) => e.id)).toEqual(["a", "c"]);
  });

  it("moveElement 四向层级", () => {
    expect(moveElement(project(), 0, "a", "front").scenes[0].elements.map((e) => e.id)).toEqual(["b", "c", "a"]);
    expect(moveElement(project(), 0, "c", "back").scenes[0].elements.map((e) => e.id)).toEqual(["c", "a", "b"]);
    // up = 往绘制顶层(数组尾)移动一步;down = 往底层(数组头)移动一步
    expect(moveElement(project(), 0, "b", "up").scenes[0].elements.map((e) => e.id)).toEqual(["a", "c", "b"]);
    expect(moveElement(project(), 0, "b", "down").scenes[0].elements.map((e) => e.id)).toEqual(["b", "a", "c"]);
  });

  it("findElement 命中与未命中", () => {
    expect(findElement(project(), 1, "d")?.id).toBe("d");
    expect(findElement(project(), 1, "zzz")).toBeNull();
  });
});

describe("场景操作", () => {
  it("addScene 插入到指定位置之后", () => {
    const next = addScene(project(), 0, { id: "s9", name: "九", elements: [] });
    expect(next.scenes.map((s) => s.id)).toEqual(["sc1", "s9", "sc2"]);
  });

  it("duplicateScene 深拷贝元素并生成新 id", () => {
    const next = duplicateScene(project(), 0);
    expect(next.scenes).toHaveLength(3);
    expect(next.scenes[1].name).toBe("一 副本");
    expect(next.scenes[1].elements[0].id).not.toBe("a");
    expect(next.scenes[0].elements[0].id).toBe("a");
  });

  it("removeScene 保底不删空", () => {
    const single: Project = { version: 1, name: "t", scenes: [{ id: "s", name: "s", elements: [] }] };
    expect(removeScene(single, 0)).toBe(single);
    expect(removeScene(project(), 0).scenes.map((s) => s.id)).toEqual(["sc2"]);
  });

  it("moveScene 交换与越界不动", () => {
    expect(moveScene(project(), 0, 1).scenes.map((s) => s.id)).toEqual(["sc2", "sc1"]);
    const p = project();
    expect(moveScene(p, 0, -1)).toBe(p);
  });

  it("updateScene 补丁名称与 dwell", () => {
    const next = updateScene(project(), 1, { name: "新", dwell: 9 });
    expect(next.scenes[1]).toMatchObject({ name: "新", dwell: 9 });
  });
});
