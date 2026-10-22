import type { Project, Scene, TransitionType } from "../types";
import { easeInOutCubic, sceneDuration } from "../timeline";
import { easingByName } from "./anim";
import { drawCaption, drawElement } from "./elementDraw";

/** 幕级装配:drawScene(相机内元素 + 固定字幕)、入幕转场五型、场景相机求值与应用。
 *  全部是 (project, t) 纯函数;编辑态经 DrawFrameOptions.ignoreCamera 跳过相机。 */

export interface DrawFrameOptions {
  /** 编辑态用:跳过场景相机,让选择框/命中测试停留在未运镜的画布坐标系;播放与导出恒 false */
  ignoreCamera?: boolean;
}

/** 画一幕:元素在相机变换内,旁白字幕固定画布坐标(不随运镜)。 */
export function drawScene(ctx: CanvasRenderingContext2D, project: Project, index: number, localT: number, w: number, h: number, opts: DrawFrameOptions): void {
  const scene = project.scenes[index];
  if (!scene) return;
  ctx.save();
  if (!opts.ignoreCamera && scene.camera) {
    applyCamera(ctx, cameraAt(scene, localT, sceneDuration(scene)), w, h);
  }
  for (const el of scene.elements) {
    drawElement(ctx, el, localT, scene.elements);
  }
  ctx.restore();
  // 场景旁白字幕:底部居中白底描边条,跨幕同位(拟人科普叙事的旁白位)
  if (scene.caption) drawCaption(ctx, scene.caption, w, h);
}

/** 转场:q 为 [0,1] 进度;当前幕按真实 localT 继续自己的入场动画,上一幕恒取其末帧。 */
export function drawTransition(ctx: CanvasRenderingContext2D, project: Project, index: number, localT: number, q: number, type: TransitionType, w: number, h: number, opts: DrawFrameOptions): void {
  const e = easeInOutCubic(q);
  const prevEnd = sceneDuration(project.scenes[index - 1]!);
  const cur = (): void => drawScene(ctx, project, index, localT, w, h, opts);
  const prev = (): void => drawScene(ctx, project, index - 1, prevEnd, w, h, opts);
  switch (type) {
    case "dissolve":
      prev();
      ctx.save();
      ctx.globalAlpha = e;
      cur();
      ctx.restore();
      break;
    case "fadeBlack":
      if (e < 0.5) {
        prev();
        ctx.fillStyle = "#000000";
        ctx.globalAlpha = e * 2;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      } else {
        cur();
        ctx.fillStyle = "#000000";
        ctx.globalAlpha = (1 - e) * 2;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      }
      break;
    case "pushLeft":
    case "pushRight": {
      const dir = type === "pushLeft" ? 1 : -1;
      ctx.save();
      ctx.translate(-dir * w * e, 0);
      prev();
      ctx.restore();
      ctx.save();
      ctx.translate(dir * w * (1 - e), 0);
      cur();
      ctx.restore();
      break;
    }
    case "wipe":
      prev();
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w * e, h);
      ctx.clip();
      cur();
      ctx.restore();
      break;
    case "zoom":
      prev();
      ctx.save();
      ctx.globalAlpha = 1 - e;
      zoomAround(ctx, 1 + 0.12 * e, w, h);
      cur();
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = e;
      zoomAround(ctx, 1.12 - 0.12 * e, w, h);
      cur();
      ctx.restore();
      break;
  }
}

/** 绕画布中心缩放的临时变换(转场用) */
function zoomAround(ctx: CanvasRenderingContext2D, zoom: number, w: number, h: number): void {
  ctx.translate(w / 2, h / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-w / 2, -h / 2);
}

// ---------- 场景相机 ----------

export interface CameraState {
  zoom: number;
  x: number;
  y: number;
}

/** 相机求值:from→to 随场景进度插值(缺省端 = zoom1/原点);纯函数。 */
export function cameraAt(scene: Scene, localT: number, duration: number): CameraState {
  const from = scene.camera?.from;
  const to = scene.camera?.to;
  const f = { zoom: from?.zoom ?? 1, x: from?.x ?? 0, y: from?.y ?? 0 };
  const o = { zoom: to?.zoom ?? f.zoom, x: to?.x ?? f.x, y: to?.y ?? f.y };
  const q = duration > 0 ? Math.min(1, Math.max(0, localT / duration)) : 1;
  const e = easingByName(scene.camera?.easing ?? "easeInOut")(q);
  return { zoom: f.zoom + (o.zoom - f.zoom) * e, x: f.x + (o.x - f.x) * e, y: f.y + (o.y - f.y) * e };
}

/** 应用相机:画布中心放大 + 平移(平移随 zoom 同缩放,先加后缩)。 */
function applyCamera(ctx: CanvasRenderingContext2D, cam: CameraState, w: number, h: number): void {
  if (cam.zoom === 1 && cam.x === 0 && cam.y === 0) return;
  ctx.translate(w / 2 + cam.x, h / 2 + cam.y);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-w / 2, -h / 2);
}
