import { canEncodeAudio, canEncodeVideo } from "mediabunny";
import type { Project } from "../core/types";
import { projectDuration } from "../core/timeline";
import { decodeSceneAudio, mixSceneAudio, toPcmAudio, type PcmAudio } from "./exportAudio";
import {
  VideoExportCancelled,
  createProgressReporter,
  type VideoExportOptions,
  type WorkerInit,
  type WorkerMessage,
} from "./videoExportCommon";

/**
 * MP4 导出编排:音频解码/混音与图片预解码在主线程(需要 fetch/DOM),
 * 逐帧渲染与编码在专用 Worker(主线程保持流畅,取消 = terminate 即时生效)。
 * Worker 起不来或明确不支持时,回落到 videoExportLegacy 主线程路径。
 *
 * 对外接口是任务句柄 startVideoExport:promise + cancel(),取消不再等编码器。
 */

export {
  VideoExportCancelled,
  isCancelledError,
  type ExportProgress,
  type ExportStage,
  type VideoExportOptions,
} from "./videoExportCommon";

export interface VideoExportJob {
  promise: Promise<Blob>;
  /** 即时中止:Worker 阶段 terminate,准备阶段置取消标记(下个检查点抛出) */
  cancel(): void;
}

export function startVideoExport(project: Project, options: VideoExportOptions = {}): VideoExportJob {
  const fps = options.fps ?? 30;
  let cancelled = false;
  let worker: Worker | null = null;
  let settle!: (err: unknown) => void;

  const promise = new Promise<Blob>((resolve, reject) => {
    settle = reject;
    void run(project, fps, options, {
      isCancelled: () => cancelled,
      onWorker: (w) => (worker = w),
    }).then(resolve, reject);
  });

  return {
    promise,
    cancel() {
      cancelled = true;
      // terminate 后 Worker 不再有任何消息,promise 立刻以取消收场,UI 即时关闭
      worker?.terminate();
      worker = null;
      settle(new VideoExportCancelled());
    },
  };
}

async function run(
  project: Project,
  fps: number,
  options: VideoExportOptions,
  hooks: { isCancelled(): boolean; onWorker(w: Worker): void },
): Promise<Blob> {
  const duration = projectDuration(project);
  if (duration <= 0) throw new Error("项目时长为 0,无法导出");
  if (!(await canEncodeVideo("avc"))) {
    throw new Error("当前环境不支持 WebCodecs H.264 编码,请改用 Chrome/Edge 或导出 HTML 动画");
  }

  const report = createProgressReporter(options.onProgress);
  report("prepare", 0);
  // 配音占 prepare 前半段,图片预解码占后半段
  const decoded = await decodeSceneAudio(project, (_s, r) => report("prepare", r * 0.5), options);
  if (hooks.isCancelled()) throw new VideoExportCancelled();
  const mixed = await mixSceneAudio(project, duration, decoded);
  if (hooks.isCancelled()) throw new VideoExportCancelled();
  let audio: PcmAudio | null = null;
  if (mixed && (await canEncodeAudio("aac"))) audio = toPcmAudio(mixed);

  const images = await preloadImages(project, hooks.isCancelled, (r) => report("prepare", 0.5 + r * 0.5));
  if (hooks.isCancelled()) throw new VideoExportCancelled();

  return runWorker({ type: "init", project, fps, images, audio }, options, hooks);
}

/** 主线程预解码所有图片元素为 ImageBitmap:Worker 无 DOM,顺带消灭「导出时图未加载被跳过」 */
async function preloadImages(
  project: Project,
  isCancelled: () => boolean,
  report: (ratio: number) => void,
): Promise<{ src: string; bitmap: ImageBitmap }[]> {
  const srcs = [
    ...new Set(
      project.scenes.flatMap((s) => s.elements.filter((e) => e.kind === "image").map((e) => e.src)),
    ),
  ];
  const out: { src: string; bitmap: ImageBitmap }[] = [];
  for (let i = 0; i < srcs.length; i++) {
    if (isCancelled()) throw new VideoExportCancelled();
    report(i / Math.max(srcs.length, 1));
    try {
      const res = await fetch(srcs[i]);
      out.push({ src: srcs[i], bitmap: await createImageBitmap(await res.blob()) });
    } catch {
      // 单张图片解码失败不阻塞导出,绘制时按未就绪跳过
    }
  }
  return out;
}

function runWorker(
  init: WorkerInit,
  options: VideoExportOptions,
  hooks: { isCancelled(): boolean; onWorker(w: Worker): void },
): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    let w: Worker;
    try {
      w = new Worker(new URL("./videoExportWorker.ts", import.meta.url), { type: "module" });
    } catch {
      void legacyFallback(init, options, hooks.isCancelled).then(resolve, reject);
      return;
    }
    hooks.onWorker(w);
    let gotMessage = false;
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      w.terminate();
      fn();
    };
    const fallback = () => {
      if (gotMessage) {
        finish(() => reject(new Error("导出 Worker 异常退出")));
        return;
      }
      finish(() => void legacyFallback(init, options, hooks.isCancelled).then(resolve, reject));
    };
    w.onmessage = (e: MessageEvent<WorkerMessage>) => {
      gotMessage = true;
      const msg = e.data;
      if (msg.type === "progress") options.onProgress?.(msg.info);
      else if (msg.type === "done") finish(() => resolve(new Blob([msg.buffer], { type: "video/mp4" })));
      else if (msg.type === "unsupported") fallback();
      else finish(() => reject(new Error(msg.message)));
    };
    w.onerror = fallback;
    const transfer: Transferable[] = init.images.map((x) => x.bitmap);
    if (init.audio) for (const plane of init.audio.planes) transfer.push(plane.buffer as ArrayBuffer);
    w.postMessage(init, transfer);
  });
}

/** Worker 不可用:动态加载主线程旧路径(取消同样即时,见 legacy 注释) */
function legacyFallback(
  init: WorkerInit,
  options: VideoExportOptions,
  isCancelled: () => boolean,
): Promise<Blob> {
  return import("./videoExportLegacy").then((mod) =>
    mod.exportProjectToMp4OnMain(init.project, { ...options, fps: init.fps, cancelled: isCancelled }),
  );
}
