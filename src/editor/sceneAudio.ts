import { useEffect, useRef, type RefObject } from "react";
import type { Project } from "../core/types";
import { sceneDuration, sceneStartTime } from "../core/timeline";

/**
 * 编辑器配音同步:project 变化时重建音频池,播放期间随播放头逐帧对齐
 * (起播对齐场景起点,漂移超 0.35s 拉回);暂停/退出场景即暂停音频。
 */
export function useSceneAudio(project: Project, tRef: RefObject<number>, playing: boolean): void {
  const poolRef = useRef(new Map<string, HTMLAudioElement>());

  useEffect(() => {
    const pool = poolRef.current;
    const alive = new Set<string>();
    for (const scene of project.scenes) {
      const src = scene.audio?.src;
      if (!src) continue;
      alive.add(scene.id);
      const existing = pool.get(scene.id);
      if (existing && existing.dataset.src === src) continue;
      existing?.pause();
      const audio = new Audio(src);
      audio.preload = "auto";
      audio.dataset.src = src;
      pool.set(scene.id, audio);
    }
    for (const [id, audio] of pool) {
      if (!alive.has(id)) {
        audio.pause();
        pool.delete(id);
      }
    }
  }, [project]);

  useEffect(() => {
    if (playing) return;
    poolRef.current.forEach((audio) => audio.pause());
  }, [playing]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = (): void => {
      raf = requestAnimationFrame(tick);
      const t = tRef.current;
      project.scenes.forEach((scene, i) => {
        const audio = poolRef.current.get(scene.id);
        if (!audio) return;
        const local = t - sceneStartTime(project, i);
        const active = local >= 0 && local < sceneDuration(scene);
        if (active) {
          audio.volume = Math.min(1, Math.max(0, scene.audio?.volume ?? 1));
          if (audio.paused) {
            audio.currentTime = Math.max(0, local);
            void audio.play().catch(() => undefined);
          } else if (Math.abs(audio.currentTime - local) > 0.35) {
            audio.currentTime = local;
          }
        } else if (!audio.paused) {
          audio.pause();
        }
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [project, playing, tRef]);
}
