import { pauseSceneAudio, syncSceneAudio, upsertSceneAudioPool, type SceneAudioPool } from "./audioSync";
import { normalizeProject } from "./normalize";
import { drawFrame } from "./render/index";
import { projectDuration } from "./timeline";
import type { Project } from "./types";

/**
 * HTML 导出的独立播放器入口:只允许 import src/core 下的模块(渲染唯一路径),
 * 由 scripts/build-player.mjs 打成 IIFE 后经 ?raw 内联进导出的单文件 HTML。
 * 播放/循环/配音同步逻辑与编辑器保持同一时间轴语义。
 */

function el<T extends HTMLElement>(id: string): T | null {
  const node = document.getElementById(id);
  return node instanceof HTMLElement ? (node as T) : null;
}

function main(): void {
  const canvas = el<HTMLCanvasElement>("tmd-stage");
  const dataTag = el<HTMLElement>("tmd-project-data");
  const stageBox = el<HTMLElement>("tmd-stage-box");
  if (!canvas || !(dataTag instanceof HTMLScriptElement)) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let project: Project;
  try {
    project = normalizeProject(JSON.parse(dataTag.textContent ?? "null"));
  } catch (err) {
    ctx.fillStyle = "#F4F4F1";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#DC2626";
    ctx.font = "600 28px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`项目数据解析失败:${String(err)}`, canvas.width / 2, canvas.height / 2);
    return;
  }

  const w = project.canvas?.width ?? 1920;
  const h = project.canvas?.height ?? 1080;
  canvas.width = w;
  canvas.height = h;
  const duration = projectDuration(project);
  const bar = el<HTMLElement>("tmd-progress-bar");
  const timeLabel = el<HTMLElement>("tmd-time");
  const playIcon = el<HTMLElement>("tmd-play-icon");

  // 画布等比缩放适配窗口,底部控制条留 44px
  const fit = (): void => {
    const scale = Math.min(window.innerWidth / w, Math.max(window.innerHeight - 44, 120) / h);
    canvas.style.width = `${Math.max(Math.round(w * scale), 64)}px`;
    canvas.style.height = `${Math.max(Math.round(h * scale), 36)}px`;
    if (stageBox) stageBox.style.height = `${Math.max(Math.round(h * scale), 36)}px`;
  };
  window.addEventListener("resize", fit);
  fit();

  // 配音池:每场一个 audio 元素,按场景起点同步(播完静默,详见 syncSceneAudio)
  const audioPool: SceneAudioPool = new Map();
  upsertSceneAudioPool(audioPool, project);
  let t = 0;
  let playing = true;

  const toggle = (): void => {
    playing = !playing;
    if (!playing) pauseSceneAudio(audioPool);
    if (playIcon) playIcon.style.opacity = playing ? "0" : "1";
  };
  const seek = (delta: number): void => {
    t = Math.min(Math.max(0, t + delta), Math.max(duration - 0.01, 0));
    pauseSceneAudio(audioPool);
  };

  canvas.addEventListener("click", toggle);
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      toggle();
    } else if (e.code === "ArrowLeft") seek(-5);
    else if (e.code === "ArrowRight") seek(5);
  });

  let last = performance.now();
  const loop = (now: number): void => {
    requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (playing) {
      const next = t + dt;
      if (duration > 0 && next >= duration) {
        t = 0;
        pauseSceneAudio(audioPool);
      } else {
        t = next;
      }
    }
    drawFrame(ctx, project, t);
    syncSceneAudio(audioPool, project, t, playing);
    if (bar) bar.style.width = `${duration > 0 ? (t / duration) * 100 : 0}%`;
    if (timeLabel) timeLabel.textContent = `${t.toFixed(1)}s / ${duration.toFixed(1)}s`;
  };
  requestAnimationFrame(loop);
}

main();
