import { describe, expect, it } from "vitest";
import { normalizeProject } from "../src/core/normalize";
import { lintProject, statsOf } from "./anim";

const base = { version: 1, name: "测试", canvas: { width: 1920, height: 1080 } };

function projectWith(elements: unknown[]): unknown {
  return { ...base, scenes: [{ id: "sc", name: "s", elements }] };
}

describe("lintProject", () => {
  it("未知 kind 报告(半成品修复示例)", () => {
    const issues = lintProject(projectWith([{ id: "el-1", kind: "buttun", x: 0, y: 0, w: 100, h: 40 }]));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ scene: 0, element: "el-1" });
    expect(issues[0].message).toContain("buttun");
  });

  it("connector 悬空 fromEl/toEl 报告", () => {
    const els = [
      { id: "a", kind: "text", x: 0, y: 0, w: 100, h: 40, text: "hi" },
      { id: "c", kind: "connector", x: 0, y: 0, w: 10, h: 10, from: [0, 0], to: [9, 9], fromEl: "ghost", toEl: "a" },
    ];
    const issues = lintProject(projectWith(els));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ element: "c" });
    expect(issues[0].message).toContain("fromEl");
  });

  it("元素坐标越界报告;connector/arrayCells 的占位 w/h 跳过", () => {
    const els = [
      { id: "over", kind: "shape", x: 1900, y: 0, w: 400, h: 40 },
      { id: "cells", kind: "arrayCells", x: 1900, y: 0, w: 900, h: 10 },
      { id: "line", kind: "connector", x: 1900, y: 0, w: 900, h: 10, from: [0, 0], to: [1, 1] },
    ];
    const issues = lintProject(projectWith(els));
    expect(issues).toHaveLength(1);
    expect(issues[0].element).toBe("over");
  });

  it("anim.start 负值与空 text 报告", () => {
    const els = [
      { id: "neg", kind: "text", x: 0, y: 0, w: 100, h: 40, text: "ok", anim: { start: -1 } },
      { id: "empty", kind: "title", x: 0, y: 0, w: 100, h: 40, text: "  " },
    ];
    const issues = lintProject(projectWith(els));
    expect(issues.map((i) => i.element).sort()).toEqual(["empty", "neg"]);
  });

  it("干净项目无警告;stats 汇总含时长与 kind 分布", () => {
    const raw = projectWith([
      { id: "a", kind: "title", x: 0, y: 0, w: 100, h: 40, text: "t", anim: { type: "pop", start: 0, duration: 0.5 } },
    ]);
    expect(lintProject(raw)).toEqual([]);
    const stats = statsOf(normalizeProject(raw));
    // 场景时长 = 0.5s 动画 + 1.5s 默认 dwell
    expect(stats).toMatchObject({ scenes: 1, elements: 1, duration: 2, kinds: { title: 1 } });
  });

  it("结构坏掉时 lint 返回空(结构错误走 normalize 报错路径)", () => {
    expect(lintProject({ version: 2 })).toEqual([]);
    expect(lintProject("not an object")).toEqual([]);
  });
});
