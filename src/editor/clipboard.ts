import type { SceneElement, ShapeElement } from "../core/types";
import { newId } from "./defaults";

/**
 * 画布元素剪贴板(内存态,跨场景可用):Cmd/Ctrl+C/X 存入,V 取出。
 * 每次粘贴全部生成新 id,并按粘贴次数整体错位摆放,避免原位重叠。
 */

let store: SceneElement[] = [];
let copies = 0;

export function copyElements(els: SceneElement[]): void {
  store = els.map((el) => JSON.parse(JSON.stringify(el)) as SceneElement);
  copies = 0;
}

export function canPaste(): boolean {
  return store.length > 0;
}

export function pasteElements(): SceneElement[] {
  if (store.length === 0) return [];
  copies += 1;
  const off = copies * 24;
  return store.map((src) => {
    const clone = { ...(JSON.parse(JSON.stringify(src)) as SceneElement), id: newId("el"), x: src.x + off, y: src.y + off };
    if (clone.kind === "connector") {
      // 粘贴出的连线不继承绑定:原绑定元素不在这个场景里
      const line = clone as typeof clone & { fromEl?: unknown; toEl?: unknown };
      delete line.fromEl;
      delete line.toEl;
      line.from = [line.from[0] + off, line.from[1] + off];
      line.to = [line.to[0] + off, line.to[1] + off];
    }
    if (clone.kind === "shape" && (clone as ShapeElement).sketch) {
      // 手绘形状粘贴出新的一份抖动,避免双胞胎轮廓
      (clone as ShapeElement).sketchSeed = Math.round(Math.random() * 1e9);
    }
    return clone;
  });
}
