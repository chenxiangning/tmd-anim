import { describe, expect, it } from "vitest";
import type { SceneElement } from "../core/types";
import { resolveTextTarget } from "./textTarget";

const anim = { type: "fade" as const, start: 0, duration: 0.1 };

describe("resolveTextTarget 双击行内编辑目标", () => {
  it("标题:整框居中,补丁改 text", () => {
    const el: SceneElement = { id: "t", kind: "title", x: 10, y: 20, w: 300, h: 80, text: "你好", anim };
    const target = resolveTextTarget(el, 0, 0);
    expect(target).not.toBeNull();
    expect(target?.value).toBe("你好");
    expect(target?.align).toBe("center");
    expect(target?.rect).toEqual({ x: 10, y: 20, w: 300, h: 80 });
    expect(target?.patch("改了")).toEqual({ text: "改了" });
  });

  it("代码块:编辑区在标题栏之下,等宽字体,补丁改 code", () => {
    const el: SceneElement = { id: "c", kind: "code", x: 0, y: 0, w: 400, h: 300, code: "let a = 1;", fontSize: 26, anim };
    const target = resolveTextTarget(el, 100, 100);
    expect(target?.mono).toBe(true);
    expect(target?.multiline).toBe(true);
    expect(target?.rect.y).toBeCloseTo(26 * 2.1);
    expect(target?.patch("let b = 2;")).toEqual({ code: "let b = 2;" });
  });

  it("表格:按点击位置定位单元格,补丁只改该格", () => {
    const el: SceneElement = {
      id: "tb",
      kind: "table",
      x: 100,
      y: 100,
      w: 300,
      h: 200,
      header: ["A", "B"],
      rows: [
        ["1", "2"],
        ["3", "4"],
      ],
      fontSize: 30,
      anim,
    };
    const header = resolveTextTarget(el, 150, 130);
    expect(header?.value).toBe("A");
    expect(header?.patch("X")).toEqual({ header: ["X", "B"] });
    const cell = resolveTextTarget(el, 300, 200);
    expect(cell?.value).toBe("2");
    expect(cell?.patch("九")).toEqual({ rows: [["1", "九"], ["3", "4"]] });
    expect(resolveTextTarget(el, 50, 50)).toBeNull(); // 框外
    expect(resolveTextTarget(el, 150, 320)).toBeNull(); // 行越界
  });

  it("数组格:按点击位置定位色块,无 colors 时用粉彩色板", () => {
    const el: SceneElement = {
      id: "ac",
      kind: "arrayCells",
      x: 500,
      y: 500,
      w: 0,
      h: 0,
      cells: ["a", "b"],
      cellSize: 100,
      gap: 20,
      anim,
    };
    const second = resolveTextTarget(el, 670, 550);
    expect(second?.value).toBe("b");
    expect(second?.bg).toBe("#DCFCE7");
    expect(second?.patch("B")).toEqual({ cells: ["a", "B"] });
    expect(resolveTextTarget(el, 610, 550)).toBeNull(); // gap 空隙
  });

  it("连线:编辑标签,编辑框挂在曲线中点", () => {
    const el: SceneElement = { id: "l", kind: "connector", x: 0, y: 0, w: 0, h: 0, from: [0, 0], to: [200, 0], label: "调用", anim };
    const target = resolveTextTarget(el, 100, 0);
    expect(target?.field).toBe("label");
    expect(target?.value).toBe("调用");
    expect(target?.rect.x).toBe(-30);
    expect(target?.patch("返回")).toEqual({ label: "返回" });
  });

  it("形状:双击编辑内嵌文本,样式贴合填充与反推文字色", () => {
    const shape: SceneElement = { id: "s", kind: "shape", x: 100, y: 100, w: 300, h: 120, shape: "rect", fill: "#0EA5E9", text: "启动", anim };
    const target = resolveTextTarget(shape, 250, 160);
    expect(target?.field).toBe("text");
    expect(target?.value).toBe("启动");
    expect(target?.bg).toBe("#0EA5E9");
    expect(target?.color).toBe("#FFFFFF"); // 暗色底反推白字
    expect(target?.align).toBe("center");
    expect(target?.patch("停止")).toEqual({ text: "停止" });
    // 无 text 的形状也可双击建文本
    const empty: SceneElement = { ...shape, text: undefined, fill: "#FDE68A" };
    const t2 = resolveTextTarget(empty, 250, 160);
    expect(t2?.value).toBe("");
    expect(t2?.color).toBe("#1F2937"); // 亮色底深字
  });

  it("图片无文本,返回 null", () => {
    const image: SceneElement = { id: "i", kind: "image", x: 0, y: 0, w: 100, h: 100, src: "", anim };
    expect(resolveTextTarget(image, 50, 50)).toBeNull();
  });
});
