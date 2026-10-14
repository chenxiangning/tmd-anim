import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  QUALITY_MEDIUM,
  canEncodeAudio,
} from "mediabunny";
import type { Project } from "../core/types";
import { projectDuration } from "../core/timeline";
import { drawFrame } from "../core/render/index";
import { decodeSceneAudio, mixSceneAudio } from "./exportAudio";
import {
  VideoExportCancelled,
  createProgressReporter,
  videoLatencyMode,
  yieldToUi,
  type VideoExportOptions,
} from "./videoExportCommon";

/**
 * 主线程回退导出:Worker 不可用时的旧路径(逐帧渲染与编码都占主线程)。
 * 旧版取消先 close() 再 cancel(),close 会等编码器全量 flush,取消要卡一两秒;
 * 这里直接 output.cancel() 强制中止(flush 被跳过,编码器同步关闭),亚秒级生效。
 */
export async function exportProjectToMp4OnMain(
  project: Project,
  options: VideoExportOptions,
): Promise<Blob> {
  const fps = options.fps ?? 30;
  const duration = projectDuration(project);
  const report = createProgressReporter(options.onProgress);
  report("prepare", 0);
  const decoded = await decodeSceneAudio(project, report, options);
  const mixed = await mixSceneAudio(project, duration, decoded);
  if (options.cancelled?.()) throw new VideoExportCancelled();

  const w = project.canvas?.width ?? 1920;
  const h = project.canvas?.height ?? 1080;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布上下文");

  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
  const videoSource = new CanvasSource(canvas, { codec: "avc", quality: QUALITY_HIGH, latencyMode: videoLatencyMode() });
  output.addVideoTrack(videoSource);

  let audioSource: AudioBufferSource | null = null;
  if (mixed && (await canEncodeAudio("aac"))) {
    audioSource = new AudioBufferSource({ codec: "aac", quality: QUALITY_MEDIUM });
    output.addAudioTrack(audioSource);
  }

  await output.start();
  const frames = Math.max(1, Math.round(duration * fps));
  for (let i = 0; i < frames; i++) {
    if (options.cancelled?.()) {
      // 不调用 videoSource.close():公有 close 会全量 flush 编码器,是取消卡顿的根源
      await output.cancel();
      throw new VideoExportCancelled();
    }
    drawFrame(ctx, project, i / fps);
    await videoSource.add(i / fps, 1 / fps);
    report("encode", (i + 1) / frames);
    // 每帧让出一个宏任务,取消点击与界面渲染才有执行机会
    await yieldToUi();
  }
  videoSource.close();
  if (audioSource && mixed) {
    await audioSource.add(mixed);
    audioSource.close();
  }
  await output.finalize();
  const buffer = output.target.buffer;
  if (!buffer) throw new Error("编码输出为空");
  return new Blob([buffer], { type: "video/mp4" });
}
