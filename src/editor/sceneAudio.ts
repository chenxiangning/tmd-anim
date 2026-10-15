import { useEffect, useRef, useState, type RefObject } from "react";
import { pauseSceneAudio, syncSceneAudio, upsertSceneAudioPool } from "../core/audioSync";
import type { Project } from "../core/types";

/**
 * 编辑器配音同步:project 变化时增量维护音频池(src 未变即复用),播放期间随播放头
 * 逐帧对齐(起播对齐场景起点,漂移超 0.35s 拉回,自然播完后静默);暂停即全部暂停。
 */
export function useSceneAudio(project: Project, tRef: RefObject<number>, playing: boolean): void {
  const poolRef = useRef(new Map<string, HTMLAudioElement>());

  useEffect(() => {
    upsertSceneAudioPool(poolRef.current, project);
  }, [project]);

  useEffect(() => {
    if (playing) return;
    pauseSceneAudio(poolRef.current);
  }, [playing]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = (): void => {
      raf = requestAnimationFrame(tick);
      syncSceneAudio(poolRef.current, project, tRef.current, true);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [project, playing, tRef]);
}

/* ── 配音时长探测(操作台对齐提示用)────────────────────────────── */

/** src → 时长(秒)模块级缓存:null = 探测失败。替换文件即换 src,缓存自然分键。 */
const durationCache = new Map<string, number | null>();

/** 音频时长(秒);src 缺失/探测失败返回 null。metadata 级探测,不整体解码。 */
export function useAudioDuration(src: string | undefined): number | null {
  const [duration, setDuration] = useState<number | null>(() =>
    src ? (durationCache.get(src) ?? null) : null,
  );
  useEffect(() => {
    if (!src) {
      setDuration(null);
      return;
    }
    const cached = durationCache.get(src);
    if (cached !== undefined) {
      setDuration(cached);
      return;
    }
    let alive = true;
    const probe = new Audio();
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      durationCache.set(src, probe.duration);
      if (alive) setDuration(probe.duration);
    };
    probe.onerror = () => {
      durationCache.set(src, null);
      if (alive) setDuration(null);
    };
    probe.src = src;
    return () => {
      alive = false;
      probe.onloadedmetadata = null;
      probe.onerror = null;
    };
  }, [src]);
  return duration;
}
