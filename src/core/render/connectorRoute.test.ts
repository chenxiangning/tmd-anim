import { describe, expect, it } from "vitest";
import type { ConnectorElement, SceneElement } from "../types";
import { connectorHeadings, connectorRoute, headingForPointFromElement, routeElbow, vectorToHeading } from "./connectorRoute";

const anim = { type: "fade" as const, start: 0, duration: 0.1 };

const box = (id: string, x: number, y: number): SceneElement => ({
  id,
  kind: "badge",
  x,
  y,
  w: 200,
  h: 60,
  text: "x",
  anim,
});

const line = (over: Partial<ConnectorElement>): ConnectorElement => ({
  id: "l",
  kind: "connector",
  x: 0,
  y: 0,
  w: 0,
  h: 0,
  from: [500, 300],
  to: [520, 800],
  anim,
  ...over,
});

describe("vectorToHeading 位移主轴方向", () => {
  it("按主分量判定四向", () => {
    expect(vectorToHeading(100, 10)).toEqual([1, 0]);
    expect(vectorToHeading(-100, 10)).toEqual([-1, 0]);
    expect(vectorToHeading(10, 100)).toEqual([0, 1]);
    expect(vectorToHeading(10, -100)).toEqual([0, -1]);
  });
});

describe("headingForPointFromElement 搜索锥出口方向", () => {
  const rect = { x: 400, y: 300, w: 300, h: 80 };
  it("点在元素下方 → 朝下出口", () => {
    expect(headingForPointFromElement(rect, { x: 560, y: 800 })).toEqual([0, 1]);
  });
  it("点在元素上方 → 朝上出口", () => {
    expect(headingForPointFromElement(rect, { x: 560, y: 100 })).toEqual([0, -1]);
  });
  it("点在元素右侧 → 朝右出口", () => {
    expect(headingForPointFromElement(rect, { x: 1200, y: 340 })).toEqual([1, 0]);
  });
  it("斜对角按中心方向主轴判定", () => {
    expect(headingForPointFromElement(rect, { x: 900, y: 800 })).toEqual([0, 1]);
  });
});

describe("connectorHeadings 绑定元素出口", () => {
  it("上元素到下元素:起点朝下、终点朝上", () => {
    const el = line({ fromEl: "b1", toEl: "b2" });
    const [h1, h2] = connectorHeadings(el, [box("b1", 400, 240), box("b2", 420, 760)]);
    expect(h1).toEqual([0, 1]);
    expect(h2).toEqual([0, -1]);
  });
});

describe("routeElbow 正交路由", () => {
  it("纵向贯通:出口段 + 水平中段 + 入口段", () => {
    const pts = routeElbow({ x: 500, y: 300 }, { x: 520, y: 800 }, [0, 1], [0, -1]);
    // 全部段正交
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i].x === pts[i - 1].x || pts[i].y === pts[i - 1].y).toBe(true);
    }
    expect(pts[0]).toEqual({ x: 500, y: 300 });
    expect(pts[pts.length - 1]).toEqual({ x: 520, y: 800 });
    // 存在水平中段连接两侧
    expect(pts.length).toBeGreaterThanOrEqual(4);
  });

  it("垂直出口接水平入口:单拐点(共线点被合并)", () => {
    const pts = routeElbow({ x: 500, y: 300 }, { x: 800, y: 600 }, [0, 1], [-1, 0]);
    expect(pts).toEqual([
      { x: 500, y: 300 },
      { x: 500, y: 600 },
      { x: 800, y: 600 },
    ]);
  });

  it("同轴水平(同向):中段取中点纵坐标", () => {
    const pts = routeElbow({ x: 700, y: 340 }, { x: 1100, y: 400 }, [1, 0], [-1, 0]);
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i].x === pts[i - 1].x || pts[i].y === pts[i - 1].y).toBe(true);
    }
    expect(pts[0]).toEqual({ x: 700, y: 340 });
    expect(pts[pts.length - 1]).toEqual({ x: 1100, y: 400 });
  });
});

describe("connectorRoute 路由分发", () => {
  it("缺省 smooth:cubic 模式,采样过端点", () => {
    const route = connectorRoute(line({}), []);
    expect(route.mode).toBe("cubic");
    const sampled = route.sample();
    expect(sampled[0]).toEqual({ x: 500, y: 300 });
    expect(sampled[sampled.length - 1]).toEqual({ x: 520, y: 800 });
  });

  it("elbow:折线正交且采样覆盖全路径", () => {
    const route = connectorRoute(line({ route: "elbow" }), []);
    expect(route.mode).toBe("segments");
    for (let i = 1; i < route.points.length; i++) {
      expect(route.points[i].x === route.points[i - 1].x || route.points[i].y === route.points[i - 1].y).toBe(true);
    }
    const sampled = route.sample();
    expect(sampled.length).toBeGreaterThan(4);
  });

  it("straight:两点直线", () => {
    const route = connectorRoute(line({ route: "straight" }), []);
    expect(route.mode).toBe("segments");
    expect(route.points).toEqual([
      { x: 500, y: 300 },
      { x: 520, y: 800 },
    ]);
    expect(route.endAngle).toBeCloseTo(Math.atan2(500, 20), 5);
  });

  it("绑定元素时直角路由按搜索锥出口", () => {
    const el = line({ route: "elbow", from: [560, 420], to: [560, 720], fromEl: "b1", toEl: "b2" });
    const route = connectorRoute(el, [box("b1", 400, 340), box("b2", 420, 680)]);
    expect(route.mode).toBe("segments");
    // 第一段从起点朝下出(纵向)
    expect(route.points[1].y).toBeGreaterThan(420);
  });
});
