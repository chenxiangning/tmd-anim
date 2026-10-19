import type { Anim, EmphasisEvent, ExitAnim, Project, Scene, SceneElement, Tween } from "./types";

/**
 * 宽容归一化:agent 产出的 JSON 允许缺字段/类型跑偏,这里补默认值、钳边界,
 * 让 watch 模式下的半成品文件也能播放;结构性损坏(根/scenes/elements 形状)才抛错。
 * 契约的权威描述在 docs/schema.md,两者必须同步改。
 * file-size-exempt:归一化入口集中所有 kind 的字段钳制,拆分会让同类守卫散落多处。
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
  devNode: true,
  phone: true,
  aiChat: true,
  barChart: true,
  lineChart: true,
  pieChart: true,
  cursor: true,
  folderTree: true,
  codeDiff: true,
  spotlight: true,
  gridBg: true,
  groupPanel: true,
  lane: true,
  quote: true,
  formula: true,
  avatar: true,
  person: true,
};

const EXIT_TYPES: Record<string, true> = {
  fadeOut: true, slideOutLeft: true, slideOutRight: true, slideOutUp: true, slideOutDown: true,
  zoomOut: true, wipeOut: true,
};
const EMPHASIS_TYPES: Record<string, true> = {
  pulse: true, shake: true, glow: true, flash: true, ring: true, highlightLines: true, dashFlow: true,
};
/** 强调事件缺省时长(秒):未声明 duration 时按类型取 */
const EMPHASIS_DEFAULT_DURATION: Record<string, number> = {
  pulse: 0.6, shake: 0.5, glow: 0.9, flash: 0.4, ring: 0.9, highlightLines: 1.4, dashFlow: 2.5,
};
/** 补间白名单:percent 仅 progress,activeIndex 仅 arrayCells;不上通用关键帧 */
const TWEEN_FIELDS: Record<string, true> = { percent: true, activeIndex: true };
const TWEEN_FIELD_KIND: Record<string, string> = { percent: "progress", activeIndex: "arrayCells" };

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

/** 离场归一:类型非法丢弃;start 钳到不早于入场结束;时长下限 0.05 */
function normalizeExit(raw: unknown, entranceEnd: number): ExitAnim | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.type !== "string" || EXIT_TYPES[r.type] !== true) return undefined;
  const easing = typeof r.easing === "string" && EASINGS.has(r.easing) ? r.easing : undefined;
  return {
    type: r.type as ExitAnim["type"],
    start: Math.max(entranceEnd, num(r.start, entranceEnd)),
    duration: Math.max(0.05, num(r.duration, 0.5)),
    ...(easing ? { easing: easing as ExitAnim["easing"] } : {}),
  };
}

/** 强调事件归一:类型/负 start 丢弃;落在离场开始后的事件丢弃(元素已不存在);时长缺省按类型 */
function normalizeEmphasis(raw: unknown, exitStart: number | undefined): EmphasisEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: EmphasisEvent[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    if (typeof r.type !== "string" || EMPHASIS_TYPES[r.type] !== true) continue;
    const start = num(r.start, 0);
    if (start < 0) continue;
    if (exitStart !== undefined && start >= exitStart) continue;
    const easing = typeof r.easing === "string" && EASINGS.has(r.easing) ? r.easing : undefined;
    const strength = num(r.strength, 1);
    const ev: EmphasisEvent = {
      type: r.type as EmphasisEvent["type"],
      start,
      duration: Math.max(0.05, num(r.duration, EMPHASIS_DEFAULT_DURATION[r.type] ?? 0.6)),
      ...(easing ? { easing: easing as EmphasisEvent["easing"] } : {}),
      ...(strength !== 1 ? { strength: Math.min(3, Math.max(0.1, strength)) } : {}),
    };
    if (r.type === "highlightLines") {
      const l = r.lines;
      const ok = Array.isArray(l) && l.length === 2 && l.every((n) => Number.isFinite(Number(n)));
      if (!ok) continue;
      const a = Math.max(1, Math.round(Number(l[0])));
      const b = Math.max(1, Math.round(Number(l[1])));
      ev.lines = a <= b ? [a, b] : [b, a];
    }
    out.push(ev);
  }
  return out;
}

/** 补间归一:字段白名单 + kind 匹配(percent 仅 progress、activeIndex 仅 arrayCells);to 非数丢弃 */
function normalizeTweens(raw: unknown, kind: string): Tween[] {
  if (!Array.isArray(raw)) return [];
  const out: Tween[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    if (typeof r.field !== "string" || TWEEN_FIELDS[r.field] !== true || TWEEN_FIELD_KIND[r.field] !== kind) continue;
    if (!Number.isFinite(Number(r.to))) continue;
    const easing = typeof r.easing === "string" && EASINGS.has(r.easing) ? r.easing : undefined;
    const tw: Tween = {
      field: r.field as Tween["field"],
      to: Number(r.to),
      start: Math.max(0, num(r.start, 0)),
      duration: Math.max(0.05, num(r.duration, 1)),
      ...(easing ? { easing: easing as Tween["easing"] } : {}),
    };
    if (r.from !== undefined && Number.isFinite(Number(r.from))) tw.from = Number(r.from);
    out.push(tw);
  }
  return out;
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
  // 形状内嵌文本:text 非字符串丢弃,sketch 非布尔丢弃,sketchSeed 非有限数丢弃;fontSize/color 由绘制层容错
  if (el.kind === "shape") {
    if (connector.text !== undefined && typeof connector.text !== "string") delete connector.text;
    if (connector.sketch !== undefined && typeof connector.sketch !== "boolean") delete connector.sketch;
    if (connector.sketchSeed !== undefined && (typeof connector.sketchSeed !== "number" || !Number.isFinite(connector.sketchSeed))) delete connector.sketchSeed;
  }
  // AI 对话卡:title/prompt/reply 非字符串丢弃
  if (el.kind === "aiChat") {
    for (const key of ["title", "prompt", "reply"] as const) {
      if (connector[key] !== undefined && typeof connector[key] !== "string") delete connector[key];
    }
  }
  // 开发组件:label/sub 非字符串丢弃;dev 未知值保留(渲染回落 server 机架)
  if (el.kind === "devNode") {
    if (connector.label !== undefined && typeof connector.label !== "string") delete connector.label;
    if (connector.sub !== undefined && typeof connector.sub !== "string") delete connector.sub;
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
  // 时间轴三段(离场/强调/补间):结构化宽容归一,全部缺省 = 入场后常驻的今日行为
  const timeline = el as unknown as Record<string, unknown>;
  const exit = normalizeExit(raw.exit, base.anim.start + base.anim.duration);
  if (exit) timeline.exit = exit;
  else delete timeline.exit;
  const emphasis = normalizeEmphasis(raw.emphasis, exit?.start);
  if (emphasis.length > 0) timeline.emphasis = emphasis;
  else delete timeline.emphasis;
  const tweens = normalizeTweens(raw.tweens, el.kind);
  if (tweens.length > 0) timeline.tweens = tweens;
  else delete timeline.tweens;
  // 数组格高亮下标:取整,脏数据丢弃
  if (el.kind === "arrayCells" && timeline.activeIndex != null) {
    const n = Number(timeline.activeIndex);
    if (Number.isFinite(n)) timeline.activeIndex = Math.round(n);
    else delete timeline.activeIndex;
  }
  // 聚光灯:强度钳 0-1,孔形状枚举过滤
  if (el.kind === "spotlight") {
    if (timeline.strength != null) {
      const s = Number(timeline.strength);
      if (Number.isFinite(s)) timeline.strength = Math.min(1, Math.max(0, s));
      else delete timeline.strength;
    }
    if (timeline.shape !== undefined && !["rect", "ellipse"].includes(String(timeline.shape))) delete timeline.shape;
  }
  // 泳道:条带数取整钳 2-4,方向枚举
  if (el.kind === "lane") {
    if (timeline.count != null) {
      const c = Number(timeline.count);
      if (Number.isFinite(c)) timeline.count = Math.min(4, Math.max(2, Math.round(c)));
      else delete timeline.count;
    }
    if (timeline.direction !== undefined && !["h", "v"].includes(String(timeline.direction))) delete timeline.direction;
  }
  // 图表数据:series/slices 结构性纠正,value/points 非有限数会污染路径计算,纠正为 0
  if (el.kind === "barChart" || el.kind === "lineChart" || el.kind === "pieChart") {
    const key = el.kind === "pieChart" ? "slices" : "series";
    const isLine = el.kind === "lineChart";
    const arr = timeline[key];
    if (!Array.isArray(arr)) timeline[key] = [];
    else {
      timeline[key] = arr.flatMap((s): Array<Record<string, unknown>> => {
        if (typeof s !== "object" || s === null) return [];
        const rec = s as Record<string, unknown>;
        const label = typeof rec.label === "string" ? rec.label : "";
        const color = typeof rec.color === "string" ? rec.color : undefined;
        if (isLine) {
          const pts = Array.isArray(rec.points)
            ? rec.points.map((n) => (Number.isFinite(Number(n)) ? Number(n) : 0))
            : [];
          return [{ label, ...(color ? { color } : {}), points: pts }];
        }
        const value = Number.isFinite(Number(rec.value)) ? Number(rec.value) : 0;
        return [{ label, value, ...(color ? { color } : {}) }];
      });
    }
  }
  // 光标:points 仅收有限数坐标对,clicks/hold 数值化(脏数据会让插值 NaN)
  if (el.kind === "cursor") {
    const pts = Array.isArray(timeline.points) ? timeline.points : [];
    timeline.points = pts
      .filter((p) => Array.isArray(p) && p.length === 2 && p.every((n) => Number.isFinite(Number(n))))
      .map((p) => [Number((p as unknown[])[0]), Number((p as unknown[])[1])]);
    if (timeline.clicks !== undefined) {
      timeline.clicks = Array.isArray(timeline.clicks)
        ? timeline.clicks.filter((n) => Number.isFinite(Number(n))).map(Number)
        : [];
    }
    const hold = timeline.hold;
    const ok = Array.isArray(hold) && hold.length === 2 && hold.every((n) => Number.isFinite(Number(n)));
    if (!ok) delete timeline.hold;
    else timeline.hold = [Number(hold[0]), Number(hold[1])];
  }
  // 代码 diff:行 tag 仅收 " "/"+"/"-",文本转字符串,避免渲染着色分支吃到脏类型
  if (el.kind === "codeDiff") {
    const hunks = Array.isArray(timeline.hunks) ? timeline.hunks : [];
    timeline.hunks = hunks.flatMap((h) => {
      if (typeof h !== "object" || h === null) return [];
      const rec = h as Record<string, unknown>;
      const ctx = typeof rec.ctx === "string" ? rec.ctx : undefined;
      const lines = (Array.isArray(rec.lines) ? rec.lines : []).map((ln) => {
        const r = (typeof ln === "object" && ln !== null ? ln : {}) as Record<string, unknown>;
        return {
          tag: r.tag === "+" ? ("+" as const) : r.tag === "-" ? ("-" as const) : (" " as const),
          text: typeof r.text === "string" ? r.text : String(r.text ?? ""),
        };
      });
      return [{ ...(ctx ? { ctx } : {}), lines }];
    });
  }
  // 文件树:条目结构纠正(name 字符串化,depth 非负取整,icon/comment 过滤)
  if (el.kind === "folderTree") {
    const items = Array.isArray(timeline.items) ? timeline.items : [];
    timeline.items = items.flatMap((it) => {
      if (typeof it !== "object" || it === null) return [];
      const rec = it as Record<string, unknown>;
      const depth = Number.isFinite(Number(rec.depth)) ? Math.max(0, Math.round(Number(rec.depth))) : undefined;
      return [{
        name: typeof rec.name === "string" ? rec.name : String(rec.name ?? ""),
        ...(depth !== undefined ? { depth } : {}),
        ...(rec.icon === "dir" || rec.icon === "file" ? { icon: rec.icon } : {}),
        ...(typeof rec.comment === "string" ? { comment: rec.comment } : {}),
      }];
    });
  }
  // 枚举过滤:饼图 legend / 头像 status / 方块人 pose
  const enumGuard = (key: string, allowed: string[]) => {
    if (timeline[key] !== undefined && !allowed.includes(String(timeline[key]))) delete timeline[key];
  };
  enumGuard("legend", ["right", "bottom", "none"]);
  enumGuard("status", ["online", "offline", "busy"]);
  enumGuard("pose", ["stand", "point", "think"]);
  return el;
}
