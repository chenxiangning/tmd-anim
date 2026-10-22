import { describe, expect, it } from "vitest";
import type { Scene } from "../types";
import { cameraAt } from "./sceneFrame";

const scene = (camera: Scene["camera"]): Scene => ({
  id: "s1",
  name: "t",
  elements: [],
  camera,
});

describe("cameraAt 场景相机", () => {
  it("无相机 = 恒原位原倍率", () => {
    const c = cameraAt(scene(undefined), 5, 10);
    expect(c).toEqual({ zoom: 1, x: 0, y: 0 });
  });

  it("from→to 随进度插值,中点约一半(缓入缓出)", () => {
    const c = cameraAt(scene({ from: { zoom: 1, x: 0 }, to: { zoom: 2, x: 100 } }), 5, 10);
    expect(c.zoom).toBeCloseTo(1.5, 1);
    expect(c.x).toBeCloseTo(50, 1);
  });

  it("进度钳 0-1,缺省端继承另一端", () => {
    expect(cameraAt(scene({ to: { zoom: 2 } }), -1, 10).zoom).toBe(1);
    expect(cameraAt(scene({ to: { zoom: 2 } }), 99, 10).zoom).toBe(2);
    expect(cameraAt(scene({ from: { zoom: 3 } }), 99, 10).zoom).toBe(3);
  });
});
