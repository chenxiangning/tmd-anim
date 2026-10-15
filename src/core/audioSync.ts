import type { Project } from "./types";
import { sceneDuration, sceneSpans } from "./timeline";

export type SceneAudioPool = Map<string, HTMLAudioElement>;

/** 每元素上一帧的场景内时刻,用于识别「播放头跳变」 */
const lastLocal = new WeakMap<HTMLAudioElement, number>();
/** 上次检查时的墙钟与音频时钟:判「真停走」必须以跨帧的墙钟间隔为基准 */
const lastBeat = new WeakMap<HTMLAudioElement, { at: number; t: number }>();
/** 起播进行中:play() 未落地前不再反复 seek+play(否则互相打断,听感断续) */
const starting = new WeakSet<HTMLAudioElement>();

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
    audio.preservesPitch = true; // rate 变速不变调;具体速率播放中按需更新
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
 * 逐帧同步(编辑器预览与导出 HTML 播放器共用)。对齐策略:
 * 只在起播、播放头跳变(拖拽/回跳/循环)、音频时钟连续停走时 seek 对齐;
 * 稳态播放以音频自身时钟为准——按墙钟稳态回拉会在渲染掉帧或变速(rate≠1)时
 * 反复把音频往回拽,听感断续(旧实现 bug)。配音自然播完(ended)后若仍在
 * 场景内保持静默,绝不重启音频管线。
 */
export function syncSceneAudio(pool: SceneAudioPool, project: Project, t: number, playing: boolean): void {
  const spans = sceneSpans(project);
  project.scenes.forEach((scene, i) => {
    const audio = pool.get(scene.id);
    if (!audio) return;
    const local = t - spans[i].start;
    const active = playing && local >= 0 && local < sceneDuration(scene);
    if (active) {
      if (audio.error) return; // 损坏源:不再反复 seek+play
      const prev = lastLocal.get(audio);
      lastLocal.set(audio, local);
      // 已自然播完且播放头未回跳:保持静默,不重启音频管线
      if (audio.ended && prev !== undefined && local >= prev) return;
      if (audio.seeking) return; // seek 落地期间 currentTime 恒为目标值,跳过防误判
      audio.volume = Math.min(1, Math.max(0, scene.audio?.volume ?? 1));
      const rate = scene.audio?.rate ?? 1;
      if (audio.playbackRate !== rate) audio.playbackRate = rate;
      if (audio.paused) {
        if (!starting.has(audio)) {
          starting.add(audio);
          audio.currentTime = Math.max(0, local);
          void audio
            .play()
            .catch(() => undefined)
            .finally(() => starting.delete(audio));
        }
        return;
      }
      const prevAudio = lastBeat.get(audio);
      const nowMs = performance.now();
      lastBeat.set(audio, { at: nowMs, t: audio.currentTime });
      // 播放头跳变(拖拽/回跳)才重新对齐;「音频时钟停走」只在墙钟间隔 ≥50ms
      // (同帧重复调用、seek 落地瞬间都不算)且时钟一毫秒未动时才判定
      const jumped = prev !== undefined && Math.abs(local - prev) > 0.15;
      const stalled =
        prevAudio !== undefined && nowMs - prevAudio.at >= 50 && audio.currentTime - prevAudio.t < 1e-3;
      if (jumped || stalled) {
        audio.currentTime = local;
        lastBeat.set(audio, { at: nowMs, t: local });
      }
    } else {
      lastLocal.delete(audio);
      lastBeat.delete(audio);
      starting.delete(audio);
      if (!audio.paused) audio.pause();
    }
  });
}

/** 暂停全部配音(pause 对 ended 元素会回卷到起点,循环重进场景可重新起播) */
export function pauseSceneAudio(pool: SceneAudioPool): void {
  pool.forEach((audio) => audio.pause());
}
