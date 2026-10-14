import type { Project } from "../core/types";
import { sceneStartTime } from "../core/timeline";
import {
  VideoExportCancelled as VideoExportCancelledError,
  yieldToUi,
  type ExportStage,
  type VideoExportOptions,
} from "./videoExportCommon";

/**
 * 导出音频链路(主线程):场景配音解码 → 按时间轴混音 → 平面 PCM 抽取。
 * 需要 fetch/OfflineAudioContext 等 DOM 能力,放在主线程;Worker 只收可转移的 PCM。
 */

export interface PcmAudio {
  sampleRate: number;
  length: number;
  /** 每声道一条 Float32Array,可 transfer */
  planes: Float32Array[];
}

interface DecodedAudio {
  sceneIndex: number;
  buffer: AudioBuffer;
  volume: number;
}

export async function decodeSceneAudio(
  project: Project,
  report: (stage: ExportStage, ratio: number) => void,
  options: VideoExportOptions,
): Promise<DecodedAudio[]> {
  const out: DecodedAudio[] = [];
  const withAudio = project.scenes.map((scene, i) => ({ scene, i })).filter((s) => s.scene.audio?.src);
  const decoder = new OfflineAudioContext(2, 1, 48000);
  for (let n = 0; n < withAudio.length; n++) {
    if (options.cancelled?.()) throw new VideoExportCancelledError();
    const { scene, i } = withAudio[n];
    report("prepare", n / Math.max(withAudio.length, 1));
    await yieldToUi();
    try {
      const res = await fetch(scene.audio?.src as string);
      const raw = await decoder.decodeAudioData(await res.arrayBuffer());
      out.push({ sceneIndex: i, buffer: raw, volume: Math.min(1, Math.max(0, scene.audio?.volume ?? 1)) });
    } catch {
      // 单条配音解码失败不阻塞导出,仅跳过该段
    }
  }
  return out;
}

/** 把各场景配音按时间轴位置混为一条 48k 立体声轨;无配音返回 null */
export async function mixSceneAudio(project: Project, duration: number, decoded: DecodedAudio[]): Promise<AudioBuffer | null> {
  if (decoded.length === 0) return null;
  const rate = 48000;
  const length = Math.max(1, Math.ceil(duration * rate));
  const offline = new OfflineAudioContext(2, length, rate);
  for (const item of decoded) {
    const node = offline.createBufferSource();
    node.buffer = item.buffer;
    const gain = offline.createGain();
    gain.gain.value = item.volume;
    node.connect(gain).connect(offline.destination);
    node.start(sceneStartTime(project, item.sceneIndex));
  }
  return offline.startRendering();
}

/** AudioBuffer → 可转移的平面 PCM(getChannelData 视图不可 transfer,须复制) */
export function toPcmAudio(buffer: AudioBuffer): PcmAudio {
  const planes: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const copy = new Float32Array(buffer.length);
    copy.set(buffer.getChannelData(c));
    planes.push(copy);
  }
  return { sampleRate: buffer.sampleRate, length: buffer.length, planes };
}
