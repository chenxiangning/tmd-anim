/**
 * MP4 导出共享件:进度类型、取消错误、让出与节流工具、Worker 消息协议。
 * 编排器(videoExport)/ Worker(videoExportWorker)/ 主线程回退(videoExportLegacy)共用,
 * 避免三者互相产生运行时依赖。
 */

import type { Project } from "../core/types";

export type ExportStage = "prepare" | "encode";

export interface ExportProgress {
  stage: ExportStage;
  /** prepare:配音解码/素材预解码进度;encode:已编码帧数比例 */
  ratio: number;
}

export interface VideoExportOptions {
  fps?: number;
  onProgress?(info: ExportProgress): void;
  /** 轮询式取消(prepare 阶段);Worker 编码阶段用 job.cancel() 即时中止 */
  cancelled?(): boolean;
}

export class VideoExportCancelled extends Error {
  constructor() {
    super("已取消导出");
    this.name = "VideoExportCancelled";
  }
}

/** 动态加载方判断取消错误用 */
export function isCancelledError(err: unknown): boolean {
  return err instanceof Error && err.name === "VideoExportCancelled";
}

/**
 * WebKit(Safari/WKWebView)的 H.264 编码器在默认 quality 模式下有 bug:吃进约 4 帧后
 * 不再出数据且 flush 不返回,导出会永久卡死(WebKit#74602,系统 WebView 更新前必须规避)。
 * realtime 模式实测可完整导出;Chromium 无此问题,保持默认 quality 以获得更优画质。
 */
export function videoLatencyMode(): "realtime" | "quality" {
  const ua = navigator.userAgent;
  const isWebKit = /applewebkit/i.test(ua) && !/chrom(e|ium)/i.test(ua);
  return isWebKit ? "realtime" : "quality";
}

/** 让出一个宏任务:MessageChannel 不受后台标签页 rAF 节流影响,唤醒最及时 */
export function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => {
      ch.port1.close();
      resolve();
    };
    ch.port2.postMessage(0);
  });
}

/** 进度节流:阶段切换立即报,同阶段内 100ms 一次 */
export function createProgressReporter(onProgress?: (info: ExportProgress) => void) {
  let lastAt = 0;
  let lastStage: ExportStage | null = null;
  return (stage: ExportStage, ratio: number) => {
    const now = performance.now();
    if (stage !== lastStage || now - lastAt >= 100 || ratio >= 1) {
      lastAt = now;
      lastStage = stage;
      onProgress?.({ stage, ratio });
    }
  };
}

/** 主线程 → Worker 的初始化消息(project 结构化克隆,位图/PCM 随 transfer list 转移) */
export interface WorkerInit {
  type: "init";
  project: Project;
  fps: number;
  images: { src: string; bitmap: ImageBitmap }[];
  audio: { sampleRate: number; length: number; planes: Float32Array[] } | null;
}

/** Worker → 主线程的消息 */
export type WorkerMessage =
  | { type: "progress"; info: ExportProgress }
  | { type: "done"; buffer: ArrayBuffer }
  | { type: "unsupported" }
  | { type: "error"; message: string };
