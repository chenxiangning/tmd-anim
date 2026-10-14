import type { Anim } from "../types";
import { easeInOutCubic, easeOutBack, easeOutCubic } from "../timeline";

/**
 * 入场动画求值:localT 未到 start 时元素不可见;到达后 p 为 [0,1] 的入场进度。
 * 缓动可按元素声明(easing 字段),缺省时按动画类型取默认。
 */

export interface AnimState {
  active: boolean;
  p: number;
}

export function animState(localT: number, anim: Anim): AnimState {
  if (localT + 1e-6 < anim.start) return { active: false, p: 0 };
  const p = anim.duration <= 0 ? 1 : Math.min(1, (localT - anim.start) / anim.duration);
  return { active: true, p };
}

type EasingFn = (p: number) => number;

const EASING_FNS: Record<string, EasingFn> = {
  linear: (p) => p,
  easeOut: easeOutCubic,
  easeInOut: easeInOutCubic,
  back: easeOutBack,
};

function resolveEasing(anim: Anim): EasingFn {
  if (anim.easing) return EASING_FNS[anim.easing] ?? easeOutCubic;
  switch (anim.type) {
    case "typewriter":
      return EASING_FNS.linear;
    case "pop":
    case "spinIn":
    case "dropDown":
      return EASING_FNS.back;
    default:
      return EASING_FNS.easeOut;
  }
}

export interface AnimVisual {
  alpha: number;
  dx: number;
  dy: number;
  /** 弧度,绕元素中心旋转 */
  rotation: number;
  scale: number;
  /** 非空 = 按宽度擦除(wipe),值为止显宽度比例 */
  wipeWidth: number | null;
  /** typewriter 的字符显露比例;非 typewriter 为 undefined */
  progress?: number;
}

/**
 * 动画 -> 视觉参数。约定:typewriter 只对文本类元素生效(字符级裁剪在绘制内部),
 * 对非文本元素回落为快速淡入;wipe/dx/dy/scale/rotation 全部由缓动后的 e 驱动。
 */
export function animVisual(anim: Anim, p: number): AnimVisual {
  const e = resolveEasing(anim)(p);
  switch (anim.type) {
    case "fade":
      return { alpha: e, dx: 0, dy: 0, rotation: 0, scale: 1, wipeWidth: null };
    case "pop":
      return { alpha: Math.min(1, p * 2.5), dx: 0, dy: 0, rotation: 0, scale: 0.6 + 0.4 * e, wipeWidth: null };
    case "riseUp":
      return { alpha: e, dx: 0, dy: (1 - e) * 46, rotation: 0, scale: 1, wipeWidth: null };
    case "slideLeft":
      return { alpha: e, dx: -(1 - e) * 320, dy: 0, rotation: 0, scale: 1, wipeWidth: null };
    case "slideRight":
      return { alpha: e, dx: (1 - e) * 320, dy: 0, rotation: 0, scale: 1, wipeWidth: null };
    case "dropDown":
      return { alpha: e, dx: 0, dy: -(1 - e) * 160, rotation: 0, scale: 1, wipeWidth: null };
    case "zoomIn":
      return { alpha: e, dx: 0, dy: 0, rotation: 0, scale: 0.82 + 0.18 * e, wipeWidth: null };
    case "spinIn":
      return { alpha: e, dx: 0, dy: 0, rotation: -(1 - e) * 1.8, scale: 0.7 + 0.3 * e, wipeWidth: null };
    case "wipe":
      return { alpha: 1, dx: 0, dy: 0, rotation: 0, scale: 1, wipeWidth: e };
    case "typewriter":
      return { alpha: Math.min(1, p * 3), dx: 0, dy: 0, rotation: 0, scale: 1, wipeWidth: null, progress: p };
  }
}
