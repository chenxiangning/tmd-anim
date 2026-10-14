import type { Anim, EasingKind } from "../core/types";

/** 动画类型/缓动的中文元数据:属性面板与时间轴共用,顺序即下拉顺序。 */

export const ANIM_TYPE_OPTIONS: ReadonlyArray<{ value: Anim["type"]; label: string }> = [
  { value: "pop", label: "弹出" },
  { value: "fade", label: "淡入" },
  { value: "riseUp", label: "上浮" },
  { value: "dropDown", label: "顶部落入" },
  { value: "slideLeft", label: "左侧滑入" },
  { value: "slideRight", label: "右侧滑入" },
  { value: "zoomIn", label: "缩放入场" },
  { value: "spinIn", label: "旋转入场" },
  { value: "wipe", label: "擦除" },
  { value: "typewriter", label: "打字机" },
];

export function animTypeLabel(type: Anim["type"]): string {
  return ANIM_TYPE_OPTIONS.find((opt) => opt.value === type)?.label ?? type;
}

export const EASING_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "auto", label: "默认(跟随类型)" },
  { value: "easeOut", label: "缓出" },
  { value: "easeInOut", label: "缓入缓出" },
  { value: "back", label: "回弹" },
  { value: "linear", label: "线性" },
];

export function parseEasing(value: string): EasingKind | undefined {
  return value === "auto" ? undefined : (value as EasingKind);
}
