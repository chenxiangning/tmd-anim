import type { Project, SceneElement } from "../types";
import { locate } from "../timeline";
import { animState, animVisual } from "./anim";
import { drawBrowser, drawStepCard, drawTerminal } from "./cards";
import { drawArrayCells } from "./cells";
import { drawCode } from "./code";
import { drawArtText, drawBadge, drawInput, drawNote, drawShape, drawText, drawTitle } from "./elements";
import { drawConnector, drawImageEl, resolveConnector } from "./misc";
import { drawTable } from "./table";
import { drawKbd, drawList, drawProgress } from "./widgets";

/**
 * 帧渲染入口:drawFrame(ctx, project, t) 是纯函数式的一帧绘制。
 * 预览(rAF 循环)与将来的逐帧导出走这同一个函数,这是「预览即导出」的唯一保证点。
 */
export function drawFrame(ctx: CanvasRenderingContext2D, project: Project, t: number): void {
  const w = project.canvas?.width ?? 1920;
  const h = project.canvas?.height ?? 1080;
  ctx.save();
  ctx.fillStyle = project.canvas?.bg ?? "#F4F4F1";
  ctx.fillRect(0, 0, w, h);
  const { index, localT } = locate(project, t);
  const scene = project.scenes[index];
  if (scene) {
    for (const el of scene.elements) {
      drawElement(ctx, el, localT, scene.elements);
    }
  }
  ctx.restore();
}

function drawElement(ctx: CanvasRenderingContext2D, el: SceneElement, localT: number, sceneElements: SceneElement[]): void {
  const st = animState(localT, el.anim);
  if (!st.active) return;
  const visual = animVisual(el.anim, st.p);
  ctx.save();
  ctx.globalAlpha *= visual.alpha;
  if (visual.dx !== 0 || visual.dy !== 0) ctx.translate(visual.dx, visual.dy);
  if (visual.scale !== 1 || visual.rotation !== 0) {
    const cx = el.x + el.w / 2;
    const cy = el.y + el.h / 2;
    ctx.translate(cx, cy);
    if (visual.rotation !== 0) ctx.rotate(visual.rotation);
    if (visual.scale !== 1) ctx.scale(visual.scale, visual.scale);
    ctx.translate(-cx, -cy);
  }
  if (visual.wipeWidth !== null) {
    ctx.beginPath();
    ctx.rect(el.x - 4, el.y - 4, el.w * visual.wipeWidth + 8, el.h + 8);
    ctx.clip();
  }
  const progress = visual.progress;
  switch (el.kind) {
    case "title":
      drawTitle(ctx, el, progress);
      break;
    case "artText":
      drawArtText(ctx, el, progress);
      break;
    case "shape":
      drawShape(ctx, el);
      break;
    case "text":
      drawText(ctx, el, progress);
      break;
    case "input":
      drawInput(ctx, el);
      break;
    case "note":
      drawNote(ctx, el, progress);
      break;
    case "badge":
      drawBadge(ctx, el);
      break;
    case "code":
      drawCode(ctx, el, progress);
      break;
    case "table":
      drawTable(ctx, el, progress);
      break;
    case "arrayCells":
      drawArrayCells(ctx, el);
      break;
    case "connector":
      drawConnector(ctx, resolveConnector(el, sceneElements), sceneElements);
      break;
    case "image":
      drawImageEl(ctx, el);
      break;
    case "list":
      drawList(ctx, el, progress);
      break;
    case "stepCard":
      drawStepCard(ctx, el, progress);
      break;
    case "terminal":
      drawTerminal(ctx, el, progress);
      break;
    case "progress":
      drawProgress(ctx, el);
      break;
    case "kbd":
      drawKbd(ctx, el);
      break;
    case "browser":
      drawBrowser(ctx, el);
      break;
  }
  ctx.restore();
}
