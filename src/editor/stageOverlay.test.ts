import { describe, expect, it } from "vitest";
import type { SceneElement } from "../core/types";
import { snapConnectorPoint } from "./stageOverlay";

const badge: SceneElement = {
  id: "b1",
  kind: "badge",
  x: 100,
  y: 100,
  w: 200,
  h: 60,
  text: "x",
  anim: { type: "fade", start: 0, duration: 0.1 },
};

describe("snapConnectorPoint 连线端点吸附", () => {
  it("靠近锚点(角/边中点/中心)时吸到锚点", () => {
    expect(snapConnectorPoint([badge], 108, 104)).toEqual({ x: 100, y: 100, kind: "anchor", elId: "b1" });
    expect(snapConnectorPoint([badge], 202, 96)).toEqual({ x: 200, y: 100, kind: "anchor", elId: "b1" });
    expect(snapConnectorPoint([badge], 306, 132)).toEqual({ x: 300, y: 130, kind: "anchor", elId: "b1" });
    expect(snapConnectorPoint([badge], 198, 166)).toEqual({ x: 200, y: 160, kind: "anchor", elId: "b1" });
    expect(snapConnectorPoint([badge], 304, 164)).toEqual({ x: 300, y: 160, kind: "anchor", elId: "b1" });
    expect(snapConnectorPoint([badge], 202, 132)).toEqual({ x: 200, y: 130, kind: "anchor", elId: "b1" });
  });

  it("指针落在元素内部且远离锚点时贴到最近边缘", () => {
    expect(snapConnectorPoint([badge], 150, 112)).toEqual({ x: 150, y: 100, kind: "edge", elId: "b1" });
    expect(snapConnectorPoint([badge], 285, 150)).toEqual({ x: 285, y: 160, kind: "edge", elId: "b1" });
  });

  it("元素外侧贴边范围内吸到边上,太远不吸", () => {
    expect(snapConnectorPoint([badge], 306, 145)).toEqual({ x: 300, y: 145, kind: "edge", elId: "b1" });
    expect(snapConnectorPoint([badge], 300, 300)).toBeNull();
  });

  it("数组格逐格吸附", () => {
    const cells: SceneElement = {
      id: "c1",
      kind: "arrayCells",
      x: 500,
      y: 500,
      w: 0,
      h: 0,
      cells: ["a", "b"],
      cellSize: 100,
      gap: 20,
      anim: { type: "fade", start: 0, duration: 0.1 },
    };
    expect(snapConnectorPoint([cells], 508, 504)).toEqual({ x: 500, y: 500, kind: "anchor", elId: "c1" });
    expect(snapConnectorPoint([cells], 612, 548)).toEqual({ x: 620, y: 550, kind: "anchor", elId: "c1" });
    expect(snapConnectorPoint([cells], 510, 490)).toEqual({ x: 510, y: 500, kind: "edge", elId: "c1" });
  });

  it("多元素取距离最近者", () => {
    const other: SceneElement = { ...badge, id: "b2", x: 220, y: 100, w: 200, h: 60 };
    expect(snapConnectorPoint([badge, other], 214, 130)).toEqual({ x: 220, y: 130, kind: "anchor", elId: "b2" });
    expect(snapConnectorPoint([other, badge], 214, 130)).toEqual({ x: 220, y: 130, kind: "anchor", elId: "b2" });
  });

  it("连线元素不参与吸附", () => {
    const line: SceneElement = {
      id: "l1",
      kind: "connector",
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      from: [100, 100],
      to: [300, 160],
      anim: { type: "fade", start: 0, duration: 0.1 },
    };
    expect(snapConnectorPoint([line], 102, 102)).toBeNull();
  });
});
