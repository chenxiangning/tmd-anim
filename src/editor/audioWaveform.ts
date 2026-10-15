import { useEffect, useState } from "react";

/**
 * 配音波形:src → 固定分辨率峰值数组,模块级缓存(与 sceneAudio 的时长缓存同思路,
 * 替换文件即换 src,缓存自然分键)。解码失败缓存 null,不留失败重试风暴。
 */

/** 缓存分辨率:与渲染宽度解耦,渲染时按像素列数二次采样 */
const PEAK_RESOLUTION = 480;

/** 波形峰值缓存:null = 解码失败(如非音频 dataURL) */
const peaksCache = new Map<string, Float32Array | null>();

/** 等距分桶取绝对峰值,再按最大峰归一化到 0-1(小音量音频波形不贴地) */
export function computePeaks(samples: Float32Array, buckets: number): Float32Array {
  const out = new Float32Array(buckets);
  const size = Math.max(1, Math.floor(samples.length / buckets));
  for (let b = 0; b < buckets; b++) {
    let peak = 0;
    const start = b * size;
    const end = Math.min(samples.length, start + size);
    for (let i = start; i < end; i++) {
      const v = Math.abs(samples[i]);
      if (v > peak) peak = v;
    }
    out[b] = peak;
  }
  let max = 0;
  for (const v of out) max = Math.max(max, v);
  if (max > 0) for (let b = 0; b < buckets; b++) out[b] /= max;
  return out;
}

/** 把缓存峰值按渲染列数二次采样:第 c 列取覆盖区间内的最大峰,保证窄列不漏尖峰 */
export function resamplePeaks(peaks: Float32Array, cols: number): number[] {
  if (cols <= 0) return [];
  const out: number[] = [];
  for (let c = 0; c < cols; c++) {
    const start = Math.floor((c * peaks.length) / cols);
    const end = Math.max(start + 1, Math.floor(((c + 1) * peaks.length) / cols));
    let peak = 0;
    for (let i = start; i < Math.min(peaks.length, end); i++) peak = Math.max(peak, peaks[i]);
    out.push(peak);
  }
  return out;
}

async function decodePeaks(src: string): Promise<Float32Array> {
  const res = await fetch(src);
  const buf = await res.arrayBuffer();
  const Ctx = window.AudioContext;
  if (!Ctx) throw new Error("无 AudioContext");
  const ctx = new Ctx();
  try {
    const audio = await ctx.decodeAudioData(buf);
    return computePeaks(audio.getChannelData(0), PEAK_RESOLUTION);
  } finally {
    void ctx.close();
  }
}

/** 配音波形峰值(0-1 × 480 桶);src 缺失/解码失败返回 null */
export function useAudioPeaks(src: string | undefined): Float32Array | null {
  const [peaks, setPeaks] = useState<Float32Array | null>(() =>
    src ? (peaksCache.get(src) ?? null) : null,
  );
  useEffect(() => {
    if (!src) {
      setPeaks(null);
      return;
    }
    const cached = peaksCache.get(src);
    if (cached !== undefined) {
      setPeaks(cached);
      return;
    }
    let alive = true;
    decodePeaks(src)
      .then((p) => {
        peaksCache.set(src, p);
        if (alive) setPeaks(p);
      })
      .catch(() => {
        peaksCache.set(src, null);
        if (alive) setPeaks(null);
      });
    return () => {
      alive = false;
    };
  }, [src]);
  return peaks;
}
