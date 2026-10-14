import { describe, expect, it } from "vitest";
import {
  easeOutBack,
  easeOutCubic,
  locate,
  projectDuration,
  sceneDuration,
  sceneSpans,
  sceneStartTime,
} from "./timeline";
import type { Project, Scene } from "./types";

function project(scenes: Array<{ elements: Array<[number, number]>; dwell?: number }>): Project {
  return {
    version: 1,
    name: "t",
    scenes: scenes.map((s, i) => ({
      id: `sc-${i}`,
      name: `场景 ${i + 1}`,
      dwell: s.dwell,
      elements: s.elements.map(([start, duration], j) => ({
        id: `el-${j}`,
        kind: "badge",
        x: 0,
        y: 0,
        w: 100,
        h: 40,
        anim: { type: "fade", start, duration },
        text: "x",
      })),
    })),
  };
}

describe("sceneDuration", () => {
  it("取末元素结束时刻并加上 dwell", () => {
    const scene: Scene = {
      id: "sc",
      name: "s",
      dwell: 2,
      elements: [
        { id: "a", kind: "badge", x: 0, y: 0, w: 1, h: 1, anim: { type: "fade", start: 0.5, duration: 1 }, text: "x" },
        { id: "b", kind: "badge", x: 0, y: 0, w: 1, h: 1, anim: { type: "fade", start: 1, duration: 0.5 }, text: "x" },
      ],
    };
    expect(sceneDuration(scene)).toBe(3.5);
  });

  it("空场景保底 0.1 秒", () => {
    expect(sceneDuration({ id: "s", name: "s", elements: [] })).toBeCloseTo(0.1);
  });
});

describe("spans 与 locate", () => {
  const p = project([
    { elements: [[0, 1]], dwell: 1 },
    { elements: [[0.5, 1]], dwell: 0.5 },
  ]);

  it("场景顺序拼接", () => {
    const spans = sceneSpans(p);
    expect(spans[0]).toMatchObject({ index: 0, start: 0, duration: 2 });
    expect(spans[1]).toMatchObject({ index: 1, start: 2, duration: 2 });
    expect(projectDuration(p)).toBe(4);
  });

  it("t 定位到正确场景的局部时刻", () => {
    expect(locate(p, 1.2).index).toBe(0);
    expect(locate(p, 1.2).localT).toBeCloseTo(1.2);
    expect(locate(p, 2.7).index).toBe(1);
    expect(locate(p, 2.7).localT).toBeCloseTo(0.7);
  });

  it("越界钳制", () => {
    expect(locate(p, -5).localT).toBe(0);
    expect(locate(p, 99)).toEqual({ index: 1, localT: 2 });
  });

  it("sceneStartTime 给出第 N 幕的起点", () => {
    expect(sceneStartTime(p, 1)).toBe(2);
  });

  it("空项目不崩", () => {
    expect(locate({ version: 1, name: "t", scenes: [] }, 3)).toEqual({ index: 0, localT: 0 });
  });
});

describe("缓动", () => {
  it("起止固定且单调", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.3)).toBeLessThan(easeOutCubic(0.6));
  });

  it("easeOutBack 终点为 1,中途允许过冲", () => {
    expect(easeOutBack(1)).toBeCloseTo(1);
    expect(easeOutBack(0.8)).toBeGreaterThan(1);
  });
});
