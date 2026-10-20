import { describe, expect, it } from "vitest";
import { normalizeProject } from "./normalize";

// 新增元素(devNode/chipRow/loopArrow)与新增字段(barChart.groups/connector.float)的宽容归一化:
// 与 normalize.test.ts 分开,避免单文件越过 300 行铁则。
describe("normalizeProject 新增元素与字段", () => {
  it("devNode 开发组件合法透传,label/sub 非字符串丢弃", () => {
    const p = normalizeProject({
      version: 1,
      scenes: [{ elements: [
        { kind: "devNode", dev: "redis", label: "缓存", sub: "主从 3 节点" },
        { kind: "devNode", dev: "obs", label: 42, sub: null },
      ] }],
    });
    const els = p.scenes[0].elements as Array<{ dev?: string; label?: unknown; sub?: unknown }>;
    expect(els[0].dev).toBe("redis");
    expect(els[0].label).toBe("缓存");
    expect("label" in els[1]).toBe(false);
    expect("sub" in els[1]).toBe(false);
  });

  it("分组柱图:缺 values 的组被丢弃,数值非数收敛为 0,groupSeries 仅收字符串", () => {
    const p = normalizeProject({
      version: 1,
      scenes: [{ elements: [{
        kind: "barChart",
        groups: [{ label: "空" }, { label: "B", values: [1, "x", null] }],
        groupSeries: ["甲", 7, null],
      }] }],
    });
    const el = p.scenes[0].elements[0] as { groups?: Array<{ label: string; values: number[] }>; groupSeries?: string[] };
    expect(el.groups).toEqual([{ label: "B", values: [1, 0, 0] }]);
    expect(el.groupSeries).toEqual(["甲"]);
  });

  it("回环箭头:缺 from/to 整体丢弃;包围盒覆盖折返段", () => {
    const p = normalizeProject({
      version: 1,
      scenes: [{ elements: [
        { kind: "loopArrow", from: [100, 100], to: [400, 100], side: "bottom", depth: 80 },
        { kind: "loopArrow", from: [1, 2] },
      ] }],
    });
    const els = p.scenes[0].elements as Array<{ kind: string; x: number; y: number; w: number; h: number; depth: number }>;
    expect(els).toHaveLength(1);
    expect(els[0].x).toBe(88);
    expect(els[0].y).toBe(88);
    // 高度含折返段 80 + 上下各 12 padding
    expect(els[0].h).toBe(104);
    expect(els[0].w).toBe(324);
  });

  it("连线不吃 float(端点会脱钩),其余元素保留", () => {
    const p = normalizeProject({
      version: 1,
      scenes: [{ elements: [
        { kind: "connector", from: [0, 0], to: [100, 0], float: true },
        { kind: "badge", text: "x", float: true },
      ] }],
    });
    const els = p.scenes[0].elements as Array<{ kind: string; float?: unknown }>;
    expect(els[0].float).toBeUndefined();
    expect(els[1].float).toEqual({});
  });

  it("胶囊组:空文本丢弃,非法 style 丢弃,align 枚举过滤", () => {
    const p = normalizeProject({
      version: 1,
      scenes: [{ elements: [{
        kind: "chipRow",
        items: [{ text: "A", style: "solid" }, { text: "" }, { text: "C", style: "nope" }],
        align: "middle",
      }] }],
    });
    const el = p.scenes[0].elements[0] as { items: Array<{ text: string; style?: string }>; align?: string };
    expect(el.items).toEqual([{ text: "A", style: "solid" }, { text: "C" }]);
    expect(el.align).toBeUndefined();
  });
});
