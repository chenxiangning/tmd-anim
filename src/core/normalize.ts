import type { Anim, Project, Scene, SceneElement } from "./types";

/**
 * 宽容归一化:agent 产出的 JSON 允许缺字段/类型跑偏,这里补默认值、钳边界,
 * 让 watch 模式下的半成品文件也能播放;结构性损坏(根/scenes/elements 形状)才抛错。
 * 契约的权威描述在 docs/schema.md,两者必须同步改。
 */

const ANIM_TYPES = new Set<string>([
  "pop",
  "fade",
  "riseUp",
  "slideLeft",
  "slideRight",
  "dropDown",
  "wipe",
  "typewriter",
  "zoomIn",
  "spinIn",
]);
const EASINGS = new Set<string>(["linear", "easeOut", "easeInOut", "back"]);
/** 全部合法元素 kind 表:归一化据此跳过未知类型;CLI lint 也用它报「会被静默吞掉」的 kind */
export const ELEMENT_KINDS: Record<string, true> = {
  title: true,
  artText: true,
  text: true,
  shape: true,
  input: true,
  code: true,
  table: true,
  note: true,
  badge: true,
  arrayCells: true,
  connector: true,
  image: true,
  list: true,
  stepCard: true,
  terminal: true,
  progress: true,
  kbd: true,
  browser: true,
};

export class ProjectParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectParseError";
  }
}

function asRecord(v: unknown, what: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) {
    throw new ProjectParseError(`${what} 必须是对象`);
  }
  return v as Record<string, unknown>;
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function str(v: unknown, fallback: string): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

export function normalizeProject(raw: unknown): Project {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new ProjectParseError("项目根必须是 JSON 对象");
  }
  const r = raw as Record<string, unknown>;
  if (r.version !== 1) {
    throw new ProjectParseError(`不支持的 version:${String(r.version)};当前协议为 version 1,见 docs/schema.md`);
  }
  if (!Array.isArray(r.scenes)) throw new ProjectParseError("scenes 必须是数组");
  const canvas = typeof r.canvas === "object" && r.canvas !== null ? asRecord(r.canvas, "canvas") : {};
  return {
    version: 1,
    name: str(r.name, "未命名项目"),
    canvas: {
      width: Math.max(1, num(canvas.width, 1920)),
      height: Math.max(1, num(canvas.height, 1080)),
      bg: str(canvas.bg, "#F4F4F1"),
    },
    scenes: r.scenes.map((s, i) => normalizeScene(asRecord(s, `scenes[${i}]`), i)),
  };
}

function normalizeScene(raw: Record<string, unknown>, index: number): Scene {
  if (!Array.isArray(raw.elements)) {
    throw new ProjectParseError(`scenes[${index}].elements 必须是数组`);
  }
  return {
    id: str(raw.id, `sc-${index + 1}`),
    name: str(raw.name, `场景 ${index + 1}`),
    dwell: Math.max(0, num(raw.dwell, 1.5)),
    elements: raw.elements.flatMap((e, j) => {
      if (typeof e !== "object" || e === null) return [];
      const record = e as Record<string, unknown>;
      // 未知元素类型跳过不崩,watch 模式下文件可能正处于半成品状态
      if (typeof record.kind !== "string" || ELEMENT_KINDS[record.kind] !== true) return [];
      return [normalizeElement(record, j)];
    }),
    audio: normalizeSceneAudio(raw.audio),
  };
}

/** 配音宽容归一:src 非字符串视为无配音;volume 钳 0-2;rate 钳 0.25-4;duration 仅收正数 */
function normalizeSceneAudio(raw: unknown): { src: string; volume: number; rate: number; duration?: number } | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.src !== "string" || r.src.length === 0) return undefined;
  const duration = num(r.duration, 0);
  return {
    src: r.src,
    volume: Math.min(2, Math.max(0, num(r.volume, 1))),
    rate: Math.min(4, Math.max(0.25, num(r.rate, 1))),
    ...(duration > 0 ? { duration } : {}),
  };
}

function normalizeAnim(raw: Record<string, unknown>): Anim {
  const type = typeof raw.type === "string" && ANIM_TYPES.has(raw.type) ? raw.type : "fade";
  const easing = typeof raw.easing === "string" && EASINGS.has(raw.easing) ? raw.easing : undefined;
  return {
    type: type as Anim["type"],
    start: Math.max(0, num(raw.start, 0)),
    duration: Math.max(0.05, num(raw.duration, 0.5)),
    ...(easing ? { easing: easing as Anim["easing"] } : {}),
  };
}

function normalizeElement(raw: Record<string, unknown>, index: number): SceneElement {
  const anim = typeof raw.anim === "object" && raw.anim !== null ? asRecord(raw.anim, "anim") : {};
  const base = {
    id: str(raw.id, `el-${index + 1}`),
    x: num(raw.x, 0),
    y: num(raw.y, 0),
    w: Math.max(1, num(raw.w, 200)),
    h: Math.max(1, num(raw.h, 80)),
    anim: normalizeAnim(anim),
  };
  // 保留 kind 与各类型自有字段,仅用归一化后的基础字段覆盖
  const el = { ...raw, ...base } as SceneElement;
  // 连线绑定字段:非字符串一律丢弃,避免脏数据让渲染解析失败
  const connector = el as unknown as Record<string, unknown>;
  for (const key of ["fromEl", "toEl"] as const) {
    if (connector[key] !== undefined && typeof connector[key] !== "string") delete connector[key];
  }
  // 绑定端点归一化锚点:仅收 [有限数, 有限数],钳 0..1;脏数据丢弃回落中心射线解析
  for (const key of ["fromFocus", "toFocus"] as const) {
    const f = connector[key];
    if (f === undefined) continue;
    const ok = Array.isArray(f) && f.length === 2 && f.every((n) => typeof n === "number" && Number.isFinite(n));
    if (!ok) delete connector[key];
    else connector[key] = [Math.min(1, Math.max(0, f[0] as number)), Math.min(1, Math.max(0, f[1] as number))];
  }
  // 形状内嵌文本:text 非字符串丢弃,sketch 非布尔丢弃;fontSize/color 由绘制层容错
  if (el.kind === "shape") {
    if (connector.text !== undefined && typeof connector.text !== "string") delete connector.text;
    if (connector.sketch !== undefined && typeof connector.sketch !== "boolean") delete connector.sketch;
  }
  // 通用旋转字段:有限数字保留并归一到 0.1 度,null/非数丢弃
  if (connector.rotate != null) {
    const deg = Number(connector.rotate);
    if (typeof connector.rotate !== "boolean" && Number.isFinite(deg)) connector.rotate = Math.round(deg * 10) / 10;
    else delete connector.rotate;
  }
  // 连线路由:仅接受合法枚举,其余回落自动平滑
  if (connector.route !== undefined && !["smooth", "elbow", "straight"].includes(String(connector.route))) {
    delete connector.route;
  }
  // 列表条目:非字符串数组一律纠正为空数组,渲染按 0 条处理
  if (el.kind === "list") {
    const items = (el as unknown as Record<string, unknown>).items;
    if (!Array.isArray(items) || items.some((v) => typeof v !== "string")) {
      (el as unknown as Record<string, unknown>).items = Array.isArray(items)
        ? items.map((v) => String(v))
        : [];
    }
  }
  return el;
}
