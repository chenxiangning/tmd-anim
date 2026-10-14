import type { Project } from "../../core/types";
import { drawFrame } from "../../core/render";
import { sceneDuration, sceneStartTime } from "../../core/timeline";

/** 项目封面:首场景中段时刻渲染成小图 dataURL。 */
export function renderCover(project: Project, width = 480): string {
  const pw = project.canvas?.width ?? 1920;
  const ph = project.canvas?.height ?? 1080;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.round((width * ph) / pw);
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const scale = width / pw;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const first = project.scenes[0];
  const t = first ? sceneStartTime(project, 0) + Math.min(1.8, sceneDuration(first) / 2) : 0;
  drawFrame(ctx, project, t);
  return canvas.toDataURL("image/jpeg", 0.72);
}
