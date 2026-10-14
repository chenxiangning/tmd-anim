/// <reference lib="webworker" />
import {
  AudioSample,
  AudioSampleSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  QUALITY_MEDIUM,
} from "mediabunny";
import { projectDuration } from "../core/timeline";
import { drawFrame } from "../core/render/index";
import { registerImageSource } from "../core/render/misc";
import type { PcmAudio } from "./exportAudio";
import { videoLatencyMode, type ExportProgress, type WorkerInit, type WorkerMessage } from "./videoExportCommon";

/**
 * MP4 导出 Worker:drawFrame 逐帧渲染(OffscreenCanvas)+ mediabunny 编码,
 * 与预览共用同一条绘制路径。渲染与编码整体离开主线程:导出期间编辑器保持流畅,
 * 取消由主线程直接 terminate 本 Worker,无需等编码器 flush。
 */

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = (e: MessageEvent<WorkerInit>) => {
  void run(e.data).catch((err: unknown) => {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  });
};

function post(msg: WorkerMessage, transfer: Transferable[] = []): void {
  scope.postMessage(msg, transfer);
}

async function run(init: WorkerInit): Promise<void> {
  // 部分 WebKit 的 worker 不暴露 WebCodecs/OffscreenCanvas,让主线程回落到旧路径
  if (typeof VideoEncoder === "undefined" || typeof OffscreenCanvas === "undefined") {
    post({ type: "unsupported" });
    return;
  }
  for (const { src, bitmap } of init.images) registerImageSource(src, bitmap);

  const { project, fps } = init;
  const w = project.canvas?.width ?? 1920;
  const h = project.canvas?.height ?? 1080;
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;

  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
  const videoSource = new CanvasSource(canvas, { codec: "avc", quality: QUALITY_HIGH, latencyMode: videoLatencyMode() });
  output.addVideoTrack(videoSource);

  let audioSource: AudioSampleSource | null = null;
  if (init.audio) {
    audioSource = new AudioSampleSource({ codec: "aac", quality: QUALITY_MEDIUM });
    output.addAudioTrack(audioSource);
  }

  await output.start();
  const frames = Math.max(1, Math.round(projectDuration(project) * fps));
  let lastPost = 0;
  for (let i = 0; i < frames; i++) {
    drawFrame(ctx, project, i / fps);
    await videoSource.add(i / fps, 1 / fps);
    armStallWatchdog();
    const now = performance.now();
    if (now - lastPost >= 100 || i === frames - 1) {
      lastPost = now;
      const info: ExportProgress = { stage: "encode", ratio: (i + 1) / frames };
      post({ type: "progress", info });
    }
  }
  videoSource.close();
  if (audioSource && init.audio) await addPcmAudio(audioSource, init.audio);
  await output.finalize();
  clearTimeout(stallTimer);

  const buffer = output.target.buffer;
  if (!buffer) throw new Error("编码输出为空");
  post({ type: "done", buffer }, [buffer]);
}

/**
 * 编码器卡死看门狗:若连续 20 秒没有任何一帧/一段编码完成,上报错误收敛,
 * 而不是永久挂起(如 WebKit 编码器 bug、系统 WebView 过旧)。
 */
let stallTimer: number = 0;
function armStallWatchdog(): void {
  clearTimeout(stallTimer);
  stallTimer = setTimeout(() => {
    post({
      type: "error",
      message: "视频编码器已停滞超过 20 秒(系统 WebView 的编码器可能存在兼容问题),请尝试更新 macOS/Safari,或改用「导出网页」",
    });
  }, 20000) as unknown as number;
}

/** 平面 PCM 按 1 秒一片喂给 aac 编码器,避免单条 AudioData 过大 */
async function addPcmAudio(source: AudioSampleSource, pcm: PcmAudio): Promise<void> {
  const chunk = pcm.sampleRate;
  for (let start = 0; start < pcm.length; start += chunk) {
    const n = Math.min(chunk, pcm.length - start);
    const data = new Float32Array(n * pcm.planes.length);
    pcm.planes.forEach((plane, c) => data.set(plane.subarray(start, start + n), c * n));
    const sample = new AudioSample({
      format: "f32-planar",
      sampleRate: pcm.sampleRate,
      numberOfChannels: pcm.planes.length,
      timestamp: start / pcm.sampleRate,
      data,
    });
    await source.add(sample);
    sample.close();
  }
  source.close();
}
