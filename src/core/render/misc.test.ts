import { describe, expect, it } from "vitest";
import type { ConnectorElement, SceneElement } from "../types";
import { connectorGeometry, elementBounds, resolveConnector } from "./misc";

const anim = { type: "fade" as const, start: 0, duration: 0.1 };

const box: SceneElement = {
  id: "b1",
  kind: "badge",
  x: 100,
  y: 100,
  w: 200,
  h: 60,
  text: "x",
  anim,
};

const line = (over: Partial<ConnectorElement>): ConnectorElement => ({
  id: "l",
  kind: "connector",
  x: 0,
  y: 0,
  w: 0,
  h: 0,
  from: [400, 130],
  to: [500, 400],
  anim,
  ...over,
});

describe("resolveConnector 连线绑定元素", () => {
  it("未绑定时原样返回", () => {
    const el = line({});
    expect(resolveConnector(el, [box])).toBe(el);
  });

  it("fromEl 存在时端点取中心朝对端射线与包围盒的交点(向下连线挂底边)", () => {
    const el = line({ fromEl: "b1" });
    const resolved = resolveConnector(el, [box]);
    // 盒子中心 (200,130) 朝对端 to (500,400):主分量命中底边,(y=160, x 按方向比例)
    expect(resolved.from[0]).toBeCloseTo(200 + 300 * (30 / 270), 5);
    expect(resolved.from[1]).toBe(160);
    expect(resolved.to).toEqual(el.to);
  });

  it("两端都绑定时连线跟随,先解析 from 再解析 to", () => {
    const other: SceneElement = { ...box, id: "b2", x: 400, y: 500, w: 200, h: 60 };
    const el = line({ fromEl: "b1", toEl: "b2" });
    const resolved = resolveConnector(el, [box, other]);
    expect(resolved.from[1]).toBe(160);
    // b2 中心 (500,530) 朝解析后的 from,主分量命中顶边 (y=500)
    expect(resolved.to[1]).toBe(500);
    expect(resolved.to[0]).toBeCloseTo(500 - (266.67 * 30) / 370, 3);
  });

  it("绑定的元素不存在时回落原始坐标", () => {
    const el = line({ fromEl: "missing" });
    const resolved = resolveConnector(el, [box]);
    expect(resolved.from).toEqual(el.from);
    expect(resolved.to).toEqual(el.to);
  });

  it("元素被移动后解析结果跟随(拖动元素连线不断)", () => {
    const el = line({ fromEl: "b1" });
    const moved: SceneElement = { ...box, x: 600, y: 200 };
    const resolved = resolveConnector(el, [moved]);
    // 中心 (700,230) 朝 to (500,400):主分量命中底边
    expect(resolved.from[1]).toBe(260);
    expect(resolved.from[0]).toBeCloseTo(700 - (200 * 30) / 170, 5);
  });

  it("fromFocus 存在时端点固定在元素上的归一化位置,对端移动也不滑动", () => {
    const el = line({ fromEl: "b1", fromFocus: [1, 0.5] });
    const r1 = resolveConnector(el, [box]);
    expect(r1.from).toEqual([300, 130]);
    // 对端大幅移动:无 focus 时端点会滑到别的边,有 focus 时纹丝不动
    const el2 = { ...el, to: [500, 900] as [number, number] };
    const r2 = resolveConnector(el2, [box]);
    expect(r2.from).toEqual([300, 130]);
  });

  it("元素移动/缩放后 focus 端点按归一化比例跟随,相对位置固定", () => {
    const el = line({ fromEl: "b1", fromFocus: [0.5, 1] });
    const moved: SceneElement = { ...box, x: 300, y: 300, w: 400, h: 120 };
    const r = resolveConnector(el, [moved]);
    expect(r.from).toEqual([500, 420]);
  });

  it("focus 越界钳到 0..1", () => {
    const el = line({ fromEl: "b1", fromFocus: [2, -1] });
    const r = resolveConnector(el, [box]);
    expect(r.from).toEqual([300, 100]);
  });
});

describe("elementBounds 布局包围盒", () => {
  it("数组格取全部格外接框(含折行与间距)", () => {
    const cells: SceneElement = {
      id: "c",
      kind: "arrayCells",
      x: 10,
      y: 20,
      w: 0,
      h: 0,
      cells: ["a", "b", "c"],
      cellSize: 100,
      gap: 20,
      perRow: 2,
      anim,
    };
    // 2 列:100*2+20=220 宽;2 行:100*2+20=220 高
    expect(elementBounds(cells)).toEqual({ x: 10, y: 20, w: 220, h: 220 });
  });

  it("连线不可作为绑定目标", () => {
    expect(elementBounds(line({}))).toBeNull();
  });
});

describe("connectorGeometry 自适应平滑曲线", () => {
  it("curve 缺省走自动三次:控制点沿主轴(纵向)伸展,端点切线顺主轴", () => {
    const geo = connectorGeometry(line({}));
    expect(geo.auto).toBe(true);
    const dist = Math.hypot(100, 270);
    const k = Math.min(Math.max(dist * 0.35, 36), 480);
    expect(geo.c1.x).toBe(400);
    expect(geo.c1.y).toBeCloseTo(130 + k, 5);
    expect(geo.c2.x).toBe(500);
    expect(geo.c2.y).toBeCloseTo(400 - k, 5);
    expect(geo.pointAt(0)).toEqual({ x: 400, y: 130 });
    expect(geo.pointAt(1)).toEqual({ x: 500, y: 400 });
    // 终点切线朝下(箭头垂直入射)
    expect(geo.endAngle()).toBeCloseTo(Math.PI / 2, 5);
  });

  it("横轴主导时控制点横向伸展,末端切线水平", () => {
    const geo = connectorGeometry(line({ from: [0, 0], to: [600, 100] }));
    const dist = Math.hypot(600, 100);
    const k = Math.min(Math.max(dist * 0.35, 36), 480);
    expect(geo.c1.y).toBe(0);
    expect(geo.c1.x).toBeCloseTo(k, 5);
    expect(geo.c2.x).toBeCloseTo(600 - k, 5);
    expect(geo.endAngle()).toBeCloseTo(0, 5);
  });

  it("自动曲线确定且经过中点附近(不过分外弓)", () => {
    const geo = connectorGeometry(line({}));
    const mid = geo.pointAt(0.5);
    // 中点在两端点构成的包络内(不再出现固定垂直偏移的大外弓)
    expect(mid.x).toBeGreaterThan(400);
    expect(mid.x).toBeLessThan(500);
    expect(mid.y).toBeGreaterThan(130);
    expect(mid.y).toBeLessThan(400);
    // 同参数重算结果一致(导出确定性)
    const again = connectorGeometry(line({}));
    expect(again.pointAt(0.5)).toEqual(mid);
  });

  it("curve 非 0 走手动二次(原语义不变)", () => {
    const geo = connectorGeometry(line({ curve: 120 }));
    expect(geo.auto).toBe(false);
    expect(geo.c1).toEqual(geo.control);
    // 法线方向偏移的中点控制点
    expect(geo.control.x).toBeCloseTo(450 - (270 / Math.hypot(100, 270)) * 120, 3);
    expect(geo.control.y).toBeCloseTo(265 + (100 / Math.hypot(100, 270)) * 120, 3);
  });
});
