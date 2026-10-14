import type { Project, Scene } from "./types";

/** 时间模型:场景时长 = max(元素 start+duration) + dwell;全局时间轴 = 场景顺序拼接。 */

export interface SceneSpan {
  index: number;
  start: number;
  duration: number;
  name: string;
}

export function sceneDuration(scene: Scene): number {
  let end = 0;
  for (const el of scene.elements) {
    end = Math.max(end, el.anim.start + el.anim.duration);
  }
  return Math.max(end, 0.1) + Math.max(0, scene.dwell ?? 0);
}

export function sceneSpans(project: Project): SceneSpan[] {
  const spans: SceneSpan[] = [];
  let cursor = 0;
  project.scenes.forEach((scene, index) => {
    const duration = sceneDuration(scene);
    spans.push({ index, start: cursor, duration, name: scene.name });
    cursor += duration;
  });
  return spans;
}

export function projectDuration(project: Project): number {
  return sceneSpans(project).reduce((sum, span) => sum + span.duration, 0);
}

export function sceneStartTime(project: Project, index: number): number {
  return sceneSpans(project)
    .slice(0, index)
    .reduce((sum, span) => sum + span.duration, 0);
}

export interface Located {
  index: number;
  localT: number;
}

/** 全局时刻 t 定位到场景与场景内局部时刻,t 越界时钳到 [0, 总时长] */
export function locate(project: Project, t: number): Located {
  const spans = sceneSpans(project);
  if (spans.length === 0) return { index: 0, localT: 0 };
  const clamped = Math.min(Math.max(t, 0), projectDuration(project));
  for (const span of spans) {
    if (clamped < span.start + span.duration) {
      return { index: span.index, localT: clamped - span.start };
    }
  }
  const last = spans[spans.length - 1];
  return { index: last.index, localT: last.duration };
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function easeOutCubic(p: number): number {
  const q = 1 - clamp01(p);
  return 1 - q * q * q;
}

export function easeInOutCubic(p: number): number {
  const x = clamp01(p);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** 回弹缓动:终点恰为 1,中途允许超过 1(用于 pop 的过冲缩放) */
export function easeOutBack(p: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = clamp01(p) - 1;
  return 1 + c3 * x * x * x + c1 * x * x;
}
