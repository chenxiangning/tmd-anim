import type { Anim, ElementFloat, EmphasisEvent, ExitAnim, SceneElement } from "../types";
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
  // 弹簧:衰减振荡,一次过冲后回稳(近似阻尼谐振子),终点收敛到 1
  spring: (p) => 1 - Math.exp(-6 * p) * Math.cos(9 * p),
};

/** 按名取缓动:未知/缺省回落缓出(相机与补间等非 Anim 场景共用) */
export function easingByName(name: string | undefined): EasingFn {
  return EASING_FNS[name ?? ""] ?? easeOutCubic;
}

/** 标准弹跳缓出: bounce 公式自含多次触地,作 bounce 入场的驱动曲线 */
function bounceOut(p: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (p < 1 / d1) return n1 * p * p;
  if (p < 2 / d1) return n1 * (p - 1.5 / d1) * (p - 1.5 / d1) + 0.75;
  if (p < 2.5 / d1) return n1 * (p - 2.25 / d1) * (p - 2.25 / d1) + 0.9375;
  return n1 * (p - 2.625 / d1) * (p - 2.625 / d1) + 0.984375;
}

function resolveEasing(anim: Anim): EasingFn {
  if (anim.easing) return EASING_FNS[anim.easing] ?? easeOutCubic;
  switch (anim.type) {
    case "typewriter":
    case "bounce": // 弹跳轨迹公式自含,缓动会破坏触地节奏
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
  /** 非空 = 独立横向缩放(flip 翻面,经 0 与负值),null = 横向同 scale */
  scaleX: number | null;
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
      return { alpha: e, dx: 0, dy: 0, rotation: 0, scale: 1, scaleX: null, wipeWidth: null };
    case "pop":
      return { alpha: Math.min(1, p * 2.5), dx: 0, dy: 0, rotation: 0, scale: 0.6 + 0.4 * e, scaleX: null, wipeWidth: null };
    case "riseUp":
      return { alpha: e, dx: 0, dy: (1 - e) * 46, rotation: 0, scale: 1, scaleX: null, wipeWidth: null };
    case "slideLeft":
      return { alpha: e, dx: -(1 - e) * 320, dy: 0, rotation: 0, scale: 1, scaleX: null, wipeWidth: null };
    case "slideRight":
      return { alpha: e, dx: (1 - e) * 320, dy: 0, rotation: 0, scale: 1, scaleX: null, wipeWidth: null };
    case "dropDown":
      return { alpha: e, dx: 0, dy: -(1 - e) * 160, rotation: 0, scale: 1, scaleX: null, wipeWidth: null };
    case "zoomIn":
      return { alpha: e, dx: 0, dy: 0, rotation: 0, scale: 0.82 + 0.18 * e, scaleX: null, wipeWidth: null };
    case "spinIn":
      return { alpha: e, dx: 0, dy: 0, rotation: -(1 - e) * 1.8, scale: 0.7 + 0.3 * e, scaleX: null, wipeWidth: null };
    case "wipe":
      return { alpha: 1, dx: 0, dy: 0, rotation: 0, scale: 1, scaleX: null, wipeWidth: e };
    case "typewriter":
      return { alpha: Math.min(1, p * 3), dx: 0, dy: 0, rotation: 0, scale: 1, scaleX: null, wipeWidth: null, progress: p };
    case "wobble":
      // 果冻:摆角 3 次往复衰减,落定归零
      return { alpha: Math.min(1, p * 3), dx: 0, dy: 0, rotation: Math.sin(e * Math.PI * 3) * (1 - e) * 0.21, scale: 1, scaleX: null, wipeWidth: null };
    case "bounce":
      // 弹跳:从上方 160px 弹落触地(轨迹由 bounceOut 驱动)
      return { alpha: Math.min(1, p * 4), dx: 0, dy: -(1 - bounceOut(p)) * 160, rotation: 0, scale: 1, scaleX: null, wipeWidth: null };
    case "flip":
      // 翻面:横向缩放从 -1(背面镜像)经 0(侧立压扁)转到 1(正面)
      return { alpha: Math.min(1, p * 2), dx: 0, dy: 0, rotation: 0, scale: 1, scaleX: -Math.cos(Math.PI * e), wipeWidth: null };
    case "swing":
      // 吊摆:钟摆两次衰减 + 轻微落下
      return { alpha: e, dx: 0, dy: -(1 - Math.min(1, p * 2)) * 40, rotation: Math.sin(e * Math.PI * 2) * (1 - e) * 0.42, scale: 1, scaleX: null, wipeWidth: null };
    case "draw":
      // 连线专用:沿路径生长(progress 由 drawConnector 消费,箭头与标签末段浮现);非连线回落快速淡入
      return { alpha: Math.min(1, p * 3), dx: 0, dy: 0, rotation: 0, scale: 1, scaleX: null, wipeWidth: null, progress: p };
  }
}

// ---------- 悬浮(元素级常驻动效) ----------

export interface FloatOffset {
  dx: number;
  dy: number;
}

const NO_FLOAT: FloatOffset = { dx: 0, dy: 0 };

/** 悬浮求值:入场结束后从静止渐入(0.6s),沿周期做纵向正弦漂浮;swing 时叠加横向椭圆轨迹。
 *  纯函数,同一 (localT, float, entranceEnd) 恒同结果。 */
export function floatOffset(localT: number, float: ElementFloat | undefined, entranceEnd: number): FloatOffset {
  if (!float || localT <= entranceEnd) return NO_FLOAT;
  const amp = Math.min(40, Math.max(2, float.amp ?? 8));
  const period = Math.min(10, Math.max(1, float.period ?? 3));
  const ramp = Math.min(1, (localT - entranceEnd) / 0.6);
  const phase = ((localT - entranceEnd) * 2 * Math.PI) / period;
  return {
    dx: float.swing ? Math.cos(phase) * amp * 0.6 * ramp : 0,
    dy: Math.sin(phase) * amp * ramp,
  };
}

// ---------- 时间轴三段:离场 / 强调 / 补间 ----------

export type ExitPhase = "in" | "out" | "gone";

/** 离场求值:in = 未开始(常驻),out = 离场窗口内(q 为 [0,1] 进度),gone = 已离场(元素不存在) */
export function exitState(localT: number, exit: ExitAnim): { phase: ExitPhase; q: number } {
  if (localT + 1e-6 < exit.start) return { phase: "in", q: 0 };
  const q = exit.duration <= 0 ? 1 : Math.min(1, (localT - exit.start) / exit.duration);
  return q >= 1 ? { phase: "gone", q: 1 } : { phase: "out", q };
}

export interface ExitVisual {
  alpha: number;
  dx: number;
  dy: number;
  scale: number;
  /** 非空 = 右向左擦除,值为剩余显宽比例 */
  wipeWidth: number | null;
}

function resolveExitEasing(exit: ExitAnim): EasingFn {
  if (exit.easing) return EASING_FNS[exit.easing] ?? easeInOutCubic;
  return easeInOutCubic;
}

/** 离场动画 -> 视觉参数:与入场 visual 复合(alpha 相乘、位移叠加、scale 相乘) */
export function exitVisual(exit: ExitAnim, q: number): ExitVisual {
  const e = resolveExitEasing(exit)(q);
  switch (exit.type) {
    case "fadeOut": return { alpha: 1 - e, dx: 0, dy: 0, scale: 1, wipeWidth: null };
    case "slideOutLeft": return { alpha: 1, dx: -e * 320, dy: 0, scale: 1, wipeWidth: null };
    case "slideOutRight": return { alpha: 1, dx: e * 320, dy: 0, scale: 1, wipeWidth: null };
    case "slideOutUp": return { alpha: 1, dx: 0, dy: -e * 200, scale: 1, wipeWidth: null };
    case "slideOutDown": return { alpha: 1, dx: 0, dy: e * 200, scale: 1, wipeWidth: null };
    case "zoomOut": return { alpha: 1 - e, dx: 0, dy: 0, scale: 1 - 0.4 * e, wipeWidth: null };
    case "wipeOut": return { alpha: 1, dx: 0, dy: 0, scale: 1, wipeWidth: 1 - e };
  }
}

/** 强调事件合成效果:常驻期间叠加;flash/ring/highlightLines/dashFlow 同型取最后一个命中事件 */
export interface EmphasisFx {
  /** 缩放倍率(乘法复合) */
  scaleMul: number;
  dx: number;
  dy: number;
  /** 外发光强度(px shadowBlur) */
  glow: number;
  /** 白闪覆盖 alpha */
  flashAlpha: number;
  /** 扩散圈进度 [0,1],null = 无 */
  ringQ: number | null;
  /** 星芒迸发进度 [0,1],null = 无 */
  burstQ: number | null;
  /** code/terminal 行区间高亮 */
  highlightLines: { lines: [number, number]; alpha: number } | null;
  /** connector 数据流流速(px/s),null = 无 */
  dashFlow: number | null;
}

const NO_FX: EmphasisFx = {
  scaleMul: 1, dx: 0, dy: 0, glow: 0, flashAlpha: 0, ringQ: null, burstQ: null, highlightLines: null, dashFlow: null,
};

function resolveEmphasisEasing(ev: EmphasisEvent): EasingFn {
  if (ev.easing) return EASING_FNS[ev.easing] ?? easeOutCubic;
  // 脉冲/抖动用缓入缓出更自然;行扫/数据流线性;其余缓出
  if (ev.type === "pulse" || ev.type === "shake") return easeInOutCubic;
  if (ev.type === "highlightLines" || ev.type === "dashFlow") return EASING_FNS.linear;
  return easeOutCubic;
}

/** 强调求值:纯函数,同一 (localT, events) 恒同结果;未命中返回共享空效果(调用方不得修改) */
export function emphasisFx(localT: number, events: readonly EmphasisEvent[] | undefined): EmphasisFx {
  if (!events || events.length === 0) return NO_FX;
  const fx: EmphasisFx = { ...NO_FX };
  for (const ev of events) {
    if (localT + 1e-6 < ev.start) continue;
    const q = (localT - ev.start) / Math.max(0.05, ev.duration);
    if (q > 1) continue;
    const e = resolveEmphasisEasing(ev)(Math.min(1, Math.max(0, q)));
    const s = ev.strength ?? 1;
    switch (ev.type) {
      case "pulse":
        fx.scaleMul *= 1 + Math.sin(Math.PI * e) * 0.1 * s;
        break;
      case "shake":
        fx.dx += Math.sin(q * Math.PI * 6) * 9 * s * (1 - e);
        break;
      case "glow":
        fx.glow = Math.max(fx.glow, Math.sin(Math.PI * e) * 22 * s);
        break;
      case "flash":
        fx.flashAlpha = Math.max(fx.flashAlpha, Math.sin(Math.PI * e) * 0.75 * Math.min(1.3, s));
        break;
      case "ring":
        fx.ringQ = e;
        break;
      case "burst":
        fx.burstQ = e;
        break;
      case "highlightLines":
        fx.highlightLines = { lines: ev.lines ?? [1, 1], alpha: Math.sin(Math.PI * e) };
        break;
      case "dashFlow":
        fx.dashFlow = 60 * s;
        break;
    }
  }
  return fx;
}

/** 补间求值:白名单字段随时间插值;命中多个时后者覆盖前者;未命中返回原元素(免拷贝) */
export function applyTweens(el: SceneElement, localT: number): SceneElement {
  if (!el.tweens || el.tweens.length === 0) return el;
  let out: SceneElement | null = null;
  for (const tw of el.tweens) {
    if (localT + 1e-6 < tw.start) continue;
    const q = Math.min(1, (localT - tw.start) / tw.duration);
    const e = tw.easing ? (EASING_FNS[tw.easing] ?? ((p: number) => p))(q) : q;
    const rec = (out ?? el) as unknown as Record<string, unknown>;
    const base = tw.from ?? (typeof rec[tw.field] === "number" ? (rec[tw.field] as number) : 0);
    if (!out) out = { ...el };
    (out as unknown as Record<string, unknown>)[tw.field] = base + (tw.to - base) * e;
  }
  return out ?? el;
}
