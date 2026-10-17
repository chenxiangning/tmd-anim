import { describe, expect, it } from "vitest";
import type { BadgeElement, ConnectorElement } from "../core/types";
import { copyElements, pasteElements } from "./clipboard";

const anim = { type: "fade" as const, start: 0, duration: 0.1 };

describe("clipboard 元素复制粘贴(多选)", () => {
  it("粘贴生成新 id 并逐次错位", () => {
    copyElements([{ id: "a", kind: "badge", x: 100, y: 100, w: 200, h: 60, text: "x", anim } satisfies BadgeElement]);
    const p1 = pasteElements();
    expect(p1).toHaveLength(1);
    expect(p1[0].id).not.toBe("a");
    expect(p1[0].x).toBe(124);
    expect(p1[0].y).toBe(124);
    expect((p1[0] as BadgeElement).text).toBe("x");
    expect(pasteElements()[0].x).toBe(148);
  });

  it("多选一起复制,粘贴保持相对位置并整体错位", () => {
    copyElements([
      { id: "a", kind: "badge", x: 100, y: 100, w: 200, h: 60, text: "1", anim },
      { id: "b", kind: "badge", x: 400, y: 100, w: 200, h: 60, text: "2", anim },
    ]);
    const pasted = pasteElements();
    expect(pasted).toHaveLength(2);
    expect(pasted[0].x).toBe(124);
    expect(pasted[1].x).toBe(424);
    expect(new Set(pasted.map((el) => el.id)).size).toBe(2);
  });

  it("连线粘贴时端点同步平移且不继承绑定", () => {
    const line: ConnectorElement = {
      id: "l",
      kind: "connector",
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      from: [100, 100],
      to: [300, 160],
      fromEl: "a",
      toEl: "b",
      anim,
    };
    copyElements([line]);
    const pasted = pasteElements();
    const cloned = pasted[0] as ConnectorElement;
    expect(cloned.from).toEqual([124, 124]);
    expect(cloned.to).toEqual([324, 184]);
    expect(cloned.fromEl).toBeUndefined();
    expect(cloned.toEl).toBeUndefined();
  });

  it("粘贴是深拷贝,改粘贴件不影响后续粘贴", () => {
    copyElements([{ id: "a", kind: "badge", x: 0, y: 0, w: 10, h: 10, text: "x", anim }]);
    pasteElements()[0].id = "changed";
    expect((pasteElements()[0] as BadgeElement).id).not.toBe("changed");
  });

  it("手绘形状粘贴换新种子,两次粘贴轮廓不同", () => {
    const sketchShape = { id: "s", kind: "shape" as const, shape: "ellipse" as const, x: 0, y: 0, w: 200, h: 200, sketch: true, sketchSeed: 7, anim };
    copyElements([sketchShape]);
    const p1 = pasteElements()[0] as typeof sketchShape;
    const p2 = pasteElements()[0] as typeof sketchShape;
    expect(p1.sketchSeed).not.toBe(7);
    expect(p1.sketchSeed).not.toBe(p2.sketchSeed);
  });
});
