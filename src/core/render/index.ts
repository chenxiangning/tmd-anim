import type { Project } from "../types";
import { locate } from "../timeline";
import { drawScene, drawTransition, type DrawFrameOptions } from "./sceneFrame";

export type { DrawFrameOptions };

/**
 * 帧渲染入口:drawFrame(ctx, project, t) 是纯函数式的一帧绘制。
 * 预览(rAF 循环)与将来的逐帧导出走这同一个函数,这是「预览即导出」的唯一保证点。
 * 幕级装配(相机/转场)在 sceneFrame,单元素分发在 elementDraw。
 */
export function drawFrame(ctx: CanvasRenderingContext2D, project: Project, t: number, opts: DrawFrameOptions = {}): void {
  const w = project.canvas?.width ?? 1920;
  const h = project.canvas?.height ?? 1080;
  ctx.save();
  ctx.fillStyle = project.canvas?.bg ?? "#F4F4F1";
  ctx.fillRect(0, 0, w, h);
  const { index, localT } = locate(project, t);
  const scene = project.scenes[index];
  if (!scene) {
    ctx.restore();
    return;
  }
  // 入幕转场:开头 duration 内从上一幕末帧过渡;推/擦类需并排画两幕
  const td = scene.transition?.duration ?? 0.6;
  if (scene.transition && index > 0 && localT < td) {
    drawTransition(ctx, project, index, localT, localT / td, scene.transition.type, w, h, opts);
    ctx.restore();
    return;
  }
  drawScene(ctx, project, index, localT, w, h, opts);
  ctx.restore();
}
