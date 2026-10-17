import { describe, expect, it } from "vitest";
import type { SceneElement } from "../core/types";
import { handlePoints, resizePatch, rotatePatch, scaledFontSize, snapConnectorPoint, snapMove } from "./stageOverlay";

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

const shape: SceneElement = {
  id: "s1",
  kind: "shape",
  shape: "rect",
  x: 100,
  y: 100,
  w: 200,
  h: 100,
  anim: { type: "fade", start: 0, duration: 0.1 },
};

describe("resizePatch 缩放补丁", () => {
  it("非等比(边手柄与 Shift 角手柄)保持旧行为:se 只按位移加减", () => {
    expect(resizePatch(shape, "se", 50, 30)).toEqual({ x: 100, y: 100, w: 250, h: 130 });
    expect(resizePatch(shape, "se", 100, 0)).toEqual({ x: 100, y: 100, w: 300, h: 100 });
  });

  it("角手柄等比:对角固定,宽高同系数,自由侧原点不动", () => {
    expect(resizePatch(shape, "se", 100, 0, true)).toEqual({ x: 100, y: 100, w: 280, h: 140 });
    expect(resizePatch(shape, "nw", -100, 0, true)).toEqual({ x: 20, y: 60, w: 280, h: 140 });
  });

  it("等比受最小尺寸约束且不破比例", () => {
    expect(resizePatch(shape, "se", -1000, -1000, true)).toEqual({ x: 100, y: 100, w: 48, h: 24 });
  });

  it("旋转便签:指针位移先旋回局部坐标再补几何", () => {
    const note: SceneElement = { ...shape, id: "n1", kind: "note", rotate: -90, text: "n" };
    // 屏幕向下拖 10 = 局部向左 10,东缘内收
    expect(resizePatch(note, "e", 0, 10)).toEqual({ x: 100, y: 100, w: 190, h: 100 });
  });
});

describe("scaledFontSize 字号联动", () => {
  it("带 fontSize 的元素按宽度比例缩放,下限 8;无字号返回 null", () => {
    const withFont: SceneElement = { ...badge, fontSize: 40 };
    expect(scaledFontSize(withFont, { w: 280 })).toEqual({ fontSize: 56 });
    expect(scaledFontSize({ ...withFont, fontSize: 10 }, { w: 20 })).toEqual({ fontSize: 8 });
    expect(scaledFontSize(shape, { w: 280 })).toBeNull();
  });
});

describe("handlePoints 旋转手柄", () => {
  it("便签手柄锚点绕中心旋转,落在视觉框角上", () => {
    const note: SceneElement = { ...shape, id: "n2", kind: "note", x: 200, y: 100, rotate: 90, text: "n" };
    const pts = handlePoints(note, { scale: 1, ox: 0, oy: 0 });
    expect(pts.find((p) => p.name === "nw")?.at).toEqual({ x: 350, y: 50 });
  });
});

describe("snapMove 元素间与画布吸附", () => {
  const other: SceneElement = { ...shape, id: "o1", x: 600, y: 500, w: 200, h: 100 };

  it("左缘靠近其他元素右缘时吸附并给参考线", () => {
    // 移动到 x=607(dx 507),距 other.x=600 为 7 < 8:吸到 600
    const s = snapMove({ x: 100, y: 100, w: 100, h: 50 }, 507, 0, 1920, 1080, 8, [other]);
    expect(s.dx).toBe(500);
    expect(s.guideX).toBe(600);
  });

  it("中心线互吸:移动框中心靠近元素中心时吸到中心线", () => {
    // 移动后中心 x = 100+545+50 = 695,距 other 中心 700 为 5 < 8:吸到 700
    const s = snapMove({ x: 100, y: 100, w: 100, h: 50 }, 545, 0, 1920, 1080, 8, [other]);
    expect(s.dx).toBe(550);
    expect(s.guideX).toBe(700);
  });

  it("竖直边线吸附同理,远处不吸", () => {
    const s = snapMove({ x: 100, y: 100, w: 100, h: 50 }, 0, 397, 1920, 1080, 8, [other]);
    expect(s.dy).toBe(400);
    expect(s.guideY).toBe(500);
    const far = snapMove({ x: 100, y: 100, w: 100, h: 50 }, 0, 300, 1920, 1080, 8, [other]);
    expect(far.dy).toBe(300);
    expect(far.guideY).toBeNull();
  });

  it("画布三线吸附保留:左缘吸 0,中线吸画布中心", () => {
    const s0 = snapMove({ x: 100, y: 100, w: 100, h: 50 }, -96, 0, 1920, 1080, 8, []);
    expect(s0.dx).toBe(-100);
    expect(s0.guideX).toBe(0);
    const mid = snapMove({ x: 100, y: 100, w: 100, h: 50 }, 854, 0, 1920, 1080, 8, []);
    expect(mid.dx).toBe(860);
    expect(mid.guideX).toBe(960);
  });

  it("连线不提供候选线", () => {
    const line: SceneElement = { ...shape, id: "l1", kind: "connector", from: [0, 0], to: [10, 10] };
    const s = snapMove({ x: 100, y: 100, w: 100, h: 50 }, 507, 0, 1920, 1080, 8, [line]);
    expect(s.dx).toBe(507);
  });
});
describe("rotatePatch 旋转手势", () => {
  it("指针在元素中心正上方为 0 度,正右方为 90 度", () => {
    // shape 100..300 × 100..200,中心 (200,150)
    expect(rotatePatch(shape, 200, 50)).toEqual({ rotate: 0 });
    expect(rotatePatch(shape, 300, 150)).toEqual({ rotate: 90 });
    expect(rotatePatch(shape, 100, 150)).toEqual({ rotate: 270 });
  });

  it("snap 时吸 15 度整数倍", () => {
    // 指针角 -15°(相对中心),+90 后 = 75 度
    const r = rotatePatch(shape, 296.6, 124.1, true);
    expect(r.rotate).toBe(75);
  });
});

describe("handlePoints 旋转手柄", () => {
  it("rot 手柄在顶中点上方 28px,随元素旋转", () => {
    const pts = handlePoints(shape, { scale: 1, ox: 0, oy: 0 });
    expect(pts.find((p) => p.name === "rot")?.at).toEqual({ x: 200, y: 72 });
    const rot: SceneElement = { ...shape, rotate: 90 };
    // 顶中点上方 28 的点 (200,72) 绕中心 (200,150) 转 90 度 → (278,150)
    expect(handlePoints(rot, { scale: 1, ox: 0, oy: 0 }).find((p) => p.name === "rot")?.at).toEqual({ x: 278, y: 150 });
  });
});

