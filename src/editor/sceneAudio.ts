import { useEffect, useRef, useState, type RefObject } from "react";
import { pauseSceneAudio, syncSceneAudio, upsertSceneAudioPool } from "../core/audioSync";
import type { Project } from "../core/types";
import { updateScene } from "./editOps";

/** 时间线配音条的选中哨兵 id:进入 selIds 表示「选中配音」,属性面板据此显示配音编辑卡 */
export const AUDIO_SEL = "@audio";

/**
 * 编辑器配音同步:project 变化时增量维护音频池(src 未变即复用),播放期间随播放头
 * 逐帧对齐(只在起播/播放头跳变/音频停走时 seek,详见 syncSceneAudio);暂停即全部暂停。
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

  // 卸载(退出编辑器)时正在播放:停掉全部配音,不让声音漏到主页
  useEffect(() => {
    const pool = poolRef.current;
    return () => pauseSceneAudio(pool);
  }, []);
}

/* ── 配音时长探测(操作台对齐提示、切幕延长都用)──────────────────── */

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

/** 命令式探测音频时长(秒);结果与 useAudioDuration 共享缓存,失败返回 null。 */
export function probeAudioDuration(src: string): Promise<number | null> {
  const cached = durationCache.get(src);
  if (cached !== undefined) return Promise.resolve(cached);
  return new Promise((resolve) => {
    const probe = new Audio();
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      const dur = Number.isFinite(probe.duration) ? probe.duration : null;
      durationCache.set(src, dur);
      resolve(dur);
    };
    probe.onerror = () => {
      durationCache.set(src, null);
      resolve(null);
    };
    probe.src = src;
  });
}

/**
 * 存量配音缺 duration 的回填:探测到时长后写进 scene.audio,让「配音未播完不切幕」
 * 对旧项目同样生效(场景时长由此把配音算进去)。探测失败的 src 记入失败集不再重试。
 */
export function useBackfillAudioDuration(
  project: Project,
  commit: (next: Project, coalesceKey?: string) => void,
): void {
  const failed = useRef(new Set<string>());
  useEffect(() => {
    let cancelled = false;
    const missing = project.scenes.filter(
      (s) => s.audio?.src && s.audio.duration === undefined && !failed.current.has(s.audio.src),
    );
    if (missing.length === 0) return;
    void (async () => {
      const probed = await Promise.all(
        missing.map(async (s) => ({ scene: s, dur: await probeAudioDuration(s.audio!.src) })),
      );
      if (cancelled) return;
      let next = project;
      let changed = false;
      for (const { scene, dur } of probed) {
        const audio = scene.audio!;
        if (dur === null) {
          failed.current.add(audio.src);
          continue;
        }
        next = updateScene(next, next.scenes.indexOf(scene), { audio: { ...audio, duration: dur } });
        changed = true;
      }
      if (changed) commit(next, "audioDuration");
    })();
    return () => {
      cancelled = true;
    };
  }, [project, commit]);
}
