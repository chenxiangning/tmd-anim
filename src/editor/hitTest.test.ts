import { describe, expect, it } from "vitest";
import type { Project } from "../core/types";
import { hitTest, idsInRect, rotatePoint } from "./hitTest";

function project(): Project {
  return {
    version: 1,
    name: "t",
    scenes: [
      {
        id: "sc",
        name: "s",
        dwell: 0,
        elements: [
          { id: "badge", kind: "badge", x: 100, y: 100, w: 200, h: 60, anim: { type: "fade", start: 0, duration: 0.1 }, text: "x" },
          {
            id: "cells",
            kind: "arrayCells",
            x: 500,
            y: 500,
            w: 0,
            h: 0,
            cells: ["a", "b", "c"],
            cellSize: 100,
            gap: 20,
            perRow: 2,
            anim: { type: "fade", start: 0, duration: 0.1 },
          },
          {
            id: "line",
            kind: "connector",
            x: 0,
            y: 0,
            w: 0,
            h: 0,
            from: [800, 800],
            to: [1000, 800],
            anim: { type: "fade", start: 0, duration: 0.1 },
          },
        ],
      },
    ],
  };
}

describe("hitTest", () => {
  it("矩形元素命中", () => {
    expect(hitTest(project(), 0, 150, 120)).toBe("badge");
    expect(hitTest(project(), 0, 50, 50)).toBeNull();
  });

  it("数组格按格子矩形命中(含折行)", () => {
    expect(hitTest(project(), 0, 540, 540)).toBe("cells"); // cell 0
    expect(hitTest(project(), 0, 640, 540)).toBe("cells"); // cell 1
    expect(hitTest(project(), 0, 540, 660)).toBe("cells"); // cell 2(第二行)
    expect(hitTest(project(), 0, 610, 540)).toBeNull(); // gap 空隙(600..620)不算
  });

  it("连线按线段距离命中,离线太远不中", () => {
    expect(hitTest(project(), 0, 900, 805)).toBe("line");
    expect(hitTest(project(), 0, 900, 850)).toBeNull();
  });

  it("曲线连线按贝塞尔采样命中", () => {
    const p = project();
    p.scenes[0].elements.push({
      id: "arc",
      kind: "connector",
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      from: [800, 800],
      to: [1000, 800],
      curve: -120,
      anim: { type: "fade", start: 0, duration: 0.1 },
    });
    // curve=-120:曲线向上弯,中点约在 (900, 740)
    expect(hitTest(p, 0, 900, 745)).toBe("arc");
    // 曲线与原直线之间的空隙(775)不命中任何连线
    expect(hitTest(p, 0, 900, 775)).toBeNull();
  });

  it("数组上层元素优先(逆序遍历)", () => {
    const p = project();
    p.scenes[0].elements.push({
      id: "top",
      kind: "badge",
      x: 100,
      y: 100,
      w: 200,
      h: 60,
      anim: { type: "fade", start: 0, duration: 0.1 },
      text: "top",
    });
    expect(hitTest(p, 0, 150, 120)).toBe("top");
  });

  it("idsInRect 框选:包围盒相交的元素(含连线),空选框返回空", () => {
    const p = project();
    // badge (100,100,200,60) + cells(500,500 起) + line(800,800)-(1000,800)
    expect(idsInRect(p, 0, { x: 0, y: 0, w: 10, h: 10 })).toEqual([]);
    expect(idsInRect(p, 0, { x: 90, y: 90, w: 50, h: 50 })).toEqual(["badge"]);
    // 一框套住 badge 与连线
    expect(idsInRect(p, 0, { x: 0, y: 0, w: 1200, h: 900 })).toEqual(["badge", "cells", "line"]);
  });

  it("旋转便签按视觉框命中:转过的位置能点中,转走的位置不误中", () => {
    const p = project();
    // 200x100 便签绕中心 (300,150) 旋转 90 度后,视觉框变为 x∈[250,350], y∈[50,250]
    p.scenes[0].elements.push({
      id: "note90",
      kind: "note",
      x: 200,
      y: 100,
      w: 200,
      h: 100,
      rotate: 90,
      text: "n",
      anim: { type: "fade", start: 0, duration: 0.1 },
    });
    expect(hitTest(p, 0, 260, 150)).toBe("note90"); // 视觉框内
    expect(hitTest(p, 0, 260, 220)).toBe("note90"); // 视觉框内(未旋转框外)
    expect(hitTest(p, 0, 380, 150)).toBeNull(); // 未旋转框内但已转走
    expect(hitTest(p, 0, 390, 150)).toBeNull(); // 视觉框外(未旋转框内,且不压下层徽章)
  });

  it("rotatePoint 绕点旋转基础方向", () => {
    const a = rotatePoint(10, 0, 0, 0, 90);
    expect(a.x).toBeCloseTo(0);
    expect(a.y).toBeCloseTo(10);
    const b = rotatePoint(0, 10, 0, 0, -90);
    expect(b.x).toBeCloseTo(10);
    expect(b.y).toBeCloseTo(0);
  });
});
