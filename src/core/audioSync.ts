import type { Project } from "./types";
import { sceneDuration, sceneStartTime } from "./timeline";

export type SceneAudioPool = Map<string, HTMLAudioElement>;

/** 每元素上一帧的场景内时刻,用于区分「播完后继续前进」与「播放头回跳」 */
const lastLocal = new WeakMap<HTMLAudioElement, number>();

/**
 * 池增量维护:src 未变的元素复用,变化的重建,不再引用的暂停后移除。
 * 编辑器每次 commit 都产生新 project 对象,必须复用未变的 audio 元素。
 */
export function upsertSceneAudioPool(pool: SceneAudioPool, project: Project): void {
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
}

/**
 * 逐帧同步(编辑器预览与导出 HTML 播放器共用):起播对齐场景起点,漂移 > 0.35s 拉回。
 * 配音通常比场景短,自然播完(ended)后若仍留在场景内绝不能再 seek+play 重启——
 * 否则每帧一次音频管线重启,听感断续(旧实现 bug)。
 * 播放头在场景内回跳(拖进度条/循环回到本场景)时重新起播。
 */
export function syncSceneAudio(pool: SceneAudioPool, project: Project, t: number, playing: boolean): void {
  project.scenes.forEach((scene, i) => {
    const audio = pool.get(scene.id);
    if (!audio) return;
    const local = t - sceneStartTime(project, i);
    const active = playing && local >= 0 && local < sceneDuration(scene);
    if (active) {
      const prev = lastLocal.get(audio);
      lastLocal.set(audio, local);
      // 已自然播完且播放头未回跳:保持静默,不重启音频管线
      if (audio.ended && prev !== undefined && local >= prev) return;
      audio.volume = Math.min(1, Math.max(0, scene.audio?.volume ?? 1));
      if (audio.paused) {
        audio.currentTime = Math.max(0, local);
        void audio.play().catch(() => undefined);
      } else if (Math.abs(audio.currentTime - local) > 0.35) {
        audio.currentTime = local;
      }
    } else {
      lastLocal.delete(audio);
      if (!audio.paused) audio.pause();
    }
  });
}

/** 暂停全部配音(pause 对 ended 元素会回卷到起点,循环重进场景可重新起播) */
export function pauseSceneAudio(pool: SceneAudioPool): void {
  pool.forEach((audio) => audio.pause());
}
