import type { Project, SceneElement } from "../types";
import { locate } from "../timeline";
import { animState, animVisual, applyTweens, emphasisFx, exitState, exitVisual } from "./anim";
import { drawAiChat, drawBrowser, drawPhone, drawStepCard, drawTerminal } from "./cards";
import { drawArrayCells } from "./cells";
import { drawCode } from "./code";
import { drawArtText, drawBadge, drawInput, drawNote, drawShape, drawText, drawTitle } from "./elements";
import { drawDevNode } from "./devNode";
import { drawAvatar, drawPerson } from "./actors";
import { drawBarChart, drawLineChart, drawPieChart } from "./charts";
import { drawCodeDiff, drawCursor, drawFolderTree } from "./guide";
import { drawConnector, drawImageEl, resolveConnector } from "./misc";
import { drawGridBg, drawGroupPanel, drawLane, drawSpotlight } from "./stage";
import { drawQuote, drawFormula } from "./rich";
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
  // 补间先求值:percent/activeIndex 等字段可能随时间变化,后续全部读取生效值
  const elT = applyTweens(el, localT);
  const st = animState(localT, elT.anim);
  if (!st.active) return;
  // 离场:窗口结束后元素不存在;窗口内与入场 visual 复合
  const exit = elT.exit ? exitState(localT, elT.exit) : null;
  if (exit?.phase === "gone") return;
  const visual = animVisual(elT.anim, st.p);
  let alpha = visual.alpha;
  let dx = visual.dx;
  let dy = visual.dy;
  let scale = visual.scale;
  let wipeWidth = visual.wipeWidth;
  if (exit && exit.phase === "out" && elT.exit) {
    const ev = exitVisual(elT.exit, exit.q);
    alpha *= ev.alpha;
    dx += ev.dx;
    dy += ev.dy;
    scale *= ev.scale;
    if (ev.wipeWidth !== null) wipeWidth = ev.wipeWidth;
  }
  const fx = emphasisFx(localT, elT.emphasis);
  ctx.save();
  ctx.globalAlpha *= alpha;
  const tx = dx + fx.dx;
  const ty = dy + fx.dy;
  if (tx !== 0 || ty !== 0) ctx.translate(tx, ty);
  const totalScale = scale * fx.scaleMul;
  if (totalScale !== 1 || visual.rotation !== 0) {
    const cx = elT.x + elT.w / 2;
    const cy = elT.y + elT.h / 2;
    ctx.translate(cx, cy);
    if (visual.rotation !== 0) ctx.rotate(visual.rotation);
    if (totalScale !== 1) ctx.scale(totalScale, totalScale);
    ctx.translate(-cx, -cy);
  }
  // 元素静态旋转(通用字段):便签保留历史缺省 -2;与入场动画变换复合。连线端点是绝对坐标,不支持旋转
  const rotateDeg = elT.kind === "connector" ? 0 : (elT.rotate ?? (elT.kind === "note" ? -2 : 0));
  if (rotateDeg !== 0) {
    const rx = elT.x + elT.w / 2;
    const ry = elT.y + elT.h / 2;
    ctx.translate(rx, ry);
    ctx.rotate((rotateDeg * Math.PI) / 180);
    ctx.translate(-rx, -ry);
  }
  if (fx.glow > 0) {
    ctx.shadowColor = "#93C5FD";
    ctx.shadowBlur = fx.glow;
  }
  if (wipeWidth !== null) {
    ctx.beginPath();
    ctx.rect(elT.x - 4, elT.y - 4, elT.w * wipeWidth + 8, elT.h + 8);
    ctx.clip();
  }
  const progress = visual.progress;
  switch (elT.kind) {
    case "title":
      drawTitle(ctx, elT, progress);
      break;
    case "artText":
      drawArtText(ctx, elT, progress);
      break;
    case "shape":
      drawShape(ctx, elT);
      break;
    case "text":
      drawText(ctx, elT, progress);
      break;
    case "input":
      drawInput(ctx, elT);
      break;
    case "note":
      drawNote(ctx, elT, progress);
      break;
    case "badge":
      drawBadge(ctx, elT);
      break;
    case "code":
      drawCode(ctx, elT, progress, fx.highlightLines);
      break;
    case "table":
      drawTable(ctx, elT, progress);
      break;
    case "arrayCells":
      drawArrayCells(ctx, elT);
      break;
    case "connector":
      drawConnector(ctx, resolveConnector(elT, sceneElements), sceneElements, fx.dashFlow !== null ? -localT * fx.dashFlow : undefined);
      break;
    case "image":
      drawImageEl(ctx, elT);
      break;
    case "list":
      drawList(ctx, elT, progress);
      break;
    case "stepCard":
      drawStepCard(ctx, elT, progress);
      break;
    case "terminal":
      drawTerminal(ctx, elT, progress, fx.highlightLines);
      break;
    case "progress":
      drawProgress(ctx, elT);
      break;
    case "kbd":
      drawKbd(ctx, elT);
      break;
    case "browser":
      drawBrowser(ctx, elT);
      break;
    case "devNode":
      drawDevNode(ctx, elT);
      break;
    case "phone":
      drawPhone(ctx, elT);
      break;
    case "aiChat":
      drawAiChat(ctx, elT, progress);
      break;
    case "barChart":
      drawBarChart(ctx, elT, progress);
      break;
    case "lineChart":
      drawLineChart(ctx, elT, progress);
      break;
    case "pieChart":
      drawPieChart(ctx, elT, progress);
      break;
    case "cursor":
      drawCursor(ctx, elT, localT);
      break;
    case "folderTree":
      drawFolderTree(ctx, elT, progress);
      break;
    case "codeDiff":
      drawCodeDiff(ctx, elT, progress);
      break;
    case "spotlight":
      drawSpotlight(ctx, elT);
      break;
    case "gridBg":
      drawGridBg(ctx, elT);
      break;
    case "groupPanel":
      drawGroupPanel(ctx, elT);
      break;
    case "lane":
      drawLane(ctx, elT);
      break;
    case "quote":
      drawQuote(ctx, elT, progress);
      break;
    case "formula":
      drawFormula(ctx, elT);
      break;
    case "avatar":
      drawAvatar(ctx, elT);
      break;
    case "person":
      drawPerson(ctx, elT);
      break;
  }
  // 强调后置覆盖(元素本地坐标,与内容同变换空间):白闪 / 扩散圈
  if (fx.flashAlpha > 0) {
    ctx.globalAlpha = fx.flashAlpha;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(elT.x, elT.y, elT.w, elT.h);
  }
  if (fx.ringQ !== null) {
    ctx.globalAlpha = (1 - fx.ringQ) * 0.55;
    ctx.strokeStyle = "#3B82F6";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(elT.x + elT.w / 2, elT.y + elT.h / 2, (Math.max(elT.w, elT.h) / 2) * (0.35 + 0.85 * fx.ringQ), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
