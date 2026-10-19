import { ELEMENT_KINDS } from "./normalize";
import { DEV_META } from "./render/devNode";
import { texParseable } from "./render/rich";
import { projectDuration } from "./timeline";
import type { Project } from "./types";

/**
 * 项目 lint / 统计 / 布局报告:纯数据逻辑,node CLI(scripts/anim.ts)与应用内
 * AI 提示词共用一份实现。lint 专报 normalize 会静默修复或跳过的问题。
 */

/** lint 警告:normalize 会静默吞掉、但 agent 应当知道的问题 */
export interface LintIssue {
  /** 场景下标,0 起 */
  scene: number;
  /** 元素 id(原始 JSON 缺 id 时给占位);「*」= 场景级问题 */
  element: string;
  message: string;
}

/** 结构统计:基于归一化后的项目,反映真正会被渲染的内容 */
export interface ProjectStats {
  scenes: number;
  elements: number;
  /** kind -> 数量 */
  kinds: Record<string, number>;
  /** 总时长(秒) */
  duration: number;
}

/** 布局报告行:元素归一化后的落位与生命周期终点,给 agent 免视觉自查构图 */
export interface LayoutRow {
  /** 场景下标,0 起 */
  scene: number;
  id: string;
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** 入场结束时刻(秒)= anim.start + duration */
  entranceEnd: number;
  /** 离场结束时刻;无离场 = undefined */
  exitEnd?: number;
}

/** asRecord 轻量版:仅判「对象但非数组」,字段类型由各 lint 规则自行 typeof 检查 */
function asObject(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/**
 * 对归一化前的原始 JSON 做 lint:
 * 基础类:未知 kind、connector 悬空绑定、坐标越界(connector/arrayCells 的 w/h 是占位,跳过)、
 * anim.start 负值、空 text、devNode 未知变体;
 * 新语义类:spotlight 次序、gridBg 首位、场景稀疏、同刻入场堆叠、
 * 离场后强调事件被丢弃、光标点数不足、公式解析失败、孤儿分组面板。
 */
export function lintProject(raw: unknown): LintIssue[] {
  const issues: LintIssue[] = [];
  const root = asObject(raw);
  if (!root || root.version !== 1 || !Array.isArray(root.scenes)) return issues;
  const canvas = asObject(root.canvas) ?? {};
  const cw = typeof canvas.width === "number" ? canvas.width : 1920;
  const ch = typeof canvas.height === "number" ? canvas.height : 1080;
  root.scenes.forEach((scene, si) => {
    const sc = asObject(scene);
    if (!sc || !Array.isArray(sc.elements)) return;
    const ids = new Set<string>();
    for (const el of sc.elements) {
      const id = asObject(el)?.id;
      if (typeof id === "string" && id) ids.add(id);
    }
    const elements = sc.elements.map((el) => asObject(el));
    // 场景级启发式:元素数 <3 偏单薄(纯标题开场除外:有 artText/title 且元素 ≤2 不提示)
    const knownCount = elements.filter((e) => e && typeof e.kind === "string" && ELEMENT_KINDS[e.kind] === true).length;
    const hasHero = elements.some((e) => e?.kind === "title" || e?.kind === "artText");
    if (knownCount > 0 && knownCount < 3 && !hasHero) {
      issues.push({ scene: si, element: "*", message: `场景仅 ${knownCount} 个元素,画面偏单薄:加步骤卡/列表/图示衬托主题` });
    }
    // 同刻入场堆叠:>4 个元素同一 anim.start,画面会挤成一团
    const startCount = new Map<number, number>();
    for (const e of elements) {
      const start = asObject(e?.anim)?.start;
      if (typeof start === "number" && Number.isFinite(start)) startCount.set(start, (startCount.get(start) ?? 0) + 1);
    }
    for (const [start, n] of startCount) {
      if (n > 4) {
        issues.push({ scene: si, element: "*", message: `${n} 个元素同刻(${start}s)入场:错开 start 或用 typewriter 分段显现更丰满` });
        break;
      }
    }
    // spotlight 次序:其后不得有非 spotlight 元素(暗角遮不住后画者)
    const firstSpot = elements.findIndex((e) => e?.kind === "spotlight");
    if (firstSpot >= 0) {
      const offender = elements.slice(firstSpot + 1).find((e) => e && e.kind !== "spotlight");
      if (offender) {
        issues.push({
          scene: si,
          element: typeof offender.id === "string" && offender.id ? offender.id : "?",
          message: "元素画在聚光灯之后:暗角盖不住它,聚光灯应放在数组末尾(绘制顺序最后)",
        });
      }
    }
    // gridBg 首位:网格/点阵应垫底绘制
    const gridIdx = elements.findIndex((e) => e?.kind === "gridBg");
    if (gridIdx > 0) {
      issues.push({ scene: si, element: typeof elements[gridIdx]?.id === "string" ? (elements[gridIdx]!.id as string) : "?", message: "网格背景不在数组首位:先画的元素会被网格线压盖,移到 elements[0]" });
    }
    // 孤儿分组面板:无其他元素中心落在面板内
    elements.forEach((e, ei) => {
      if (e?.kind !== "groupPanel") return;
      const num = (v: unknown) => (typeof v === "number" ? v : 0);
      const [px, py, pw, ph] = [num(e.x), num(e.y), num(e.w), num(e.h)];
      const hasChild = elements.some((o, oi) => {
        if (!o || oi === ei || o.kind === "groupPanel" || o.kind === "gridBg" || o.kind === "spotlight") return false;
        const cx = num(o.x) + num(o.w) / 2;
        const cy = num(o.y) + num(o.h) / 2;
        return cx >= px && cx <= px + pw && cy >= py && cy <= py + ph;
      });
      if (!hasChild) {
        issues.push({ scene: si, element: typeof e.id === "string" && e.id ? e.id : `el-${ei + 1}`, message: "分组面板内没有任何元素(按中心点判定):归拢一些元素进面板,或删除空面板" });
      }
    });
    sc.elements.forEach((el, ei) => {
      const e = asObject(el);
      if (!e) return;
      const at = { scene: si, element: typeof e.id === "string" && e.id ? e.id : `el-${ei + 1}` };
      if (typeof e.kind !== "string" || ELEMENT_KINDS[e.kind] !== true) {
        issues.push({ ...at, message: `未知 kind ${JSON.stringify(e.kind ?? null)},该元素会被静默跳过不渲染` });
      }
      if (e.kind === "connector") {
        for (const key of ["fromEl", "toEl"] as const) {
          const bound = e[key];
          if (typeof bound === "string" && !ids.has(bound)) {
            issues.push({ ...at, message: `${key} 指向不存在的元素 id ${JSON.stringify(bound)},绑定会被忽略` });
          }
        }
      }
      const numeric =
        typeof e.x === "number" && typeof e.y === "number" && typeof e.w === "number" && typeof e.h === "number";
      const placeholder = e.kind === "connector" || e.kind === "arrayCells";
      if (!placeholder && numeric) {
        const { x, y, w, h } = e as { x: number; y: number; w: number; h: number };
        if (x < 0 || y < 0 || x + w > cw || y + h > ch) {
          issues.push({
            ...at,
            message: `包围盒 (x,y,w,h)=(${x},${y},${w},${h}) 超出画布 ${cw}x${ch},超出部分不可见`,
          });
        }
      }
      const anim = asObject(e.anim) ?? {};
      if (typeof anim.start === "number" && anim.start < 0) {
        issues.push({ ...at, message: `anim.start=${anim.start} 为负数,归一化会钳到 0,入场时刻与预期不符` });
      }
      if (typeof e.text === "string" && e.text.trim().length === 0) {
        issues.push({ ...at, message: "text 为空(或仅空白),渲染为空内容" });
      }
      if (e.kind === "devNode" && typeof e.dev === "string" && !(e.dev in DEV_META)) {
        issues.push({ ...at, message: `未知开发组件 dev ${JSON.stringify(e.dev)},渲染回落为服务器机架` });
      }
      // 离场后强调事件:normalize 会静默丢弃,提醒 agent 调整顺序
      const exit = asObject(e.exit);
      const exitStart = typeof exit?.start === "number" ? exit.start : undefined;
      if (exitStart !== undefined) {
        const dropped = Array.isArray(e.emphasis)
          ? e.emphasis.filter((ev) => {
              const s = asObject(ev)?.start;
              return typeof s === "number" && s >= exitStart;
            }).length
          : 0;
        if (dropped > 0) {
          issues.push({ ...at, message: `${dropped} 个强调事件在离场开始(${exitStart}s)之后,会被静默丢弃` });
        }
      }
      // 光标点数:points 折线插值需要 ≥2 点
      if (e.kind === "cursor" && Array.isArray(e.points) && e.points.length < 2) {
        issues.push({ ...at, message: `cursor.points 仅 ${e.points.length} 个(需 ≥2),光标不会绘制` });
      }
      // 公式可解析性:失败会回落纯文本
      if (e.kind === "formula" && typeof e.text === "string" && e.text.length > 0 && !texParseable(e.text)) {
        issues.push({ ...at, message: "公式超出 TeX 子集可解析范围(frac/sqrt/上下标/希腊字母),将按纯文本渲染" });
      }
    });
  });
  return issues;
}

export function statsOf(project: Project): ProjectStats {
  const kinds: Record<string, number> = {};
  let elements = 0;
  for (const scene of project.scenes) {
    for (const el of scene.elements) {
      elements += 1;
      kinds[el.kind] = (kinds[el.kind] ?? 0) + 1;
    }
  }
  return { scenes: project.scenes.length, elements, kinds, duration: projectDuration(project) };
}

/** 布局报告:归一化后元素的最终落位与生命周期终点;无视觉 agent 的构图自查依据 */
export function layoutOf(project: Project): LayoutRow[] {
  const rows: LayoutRow[] = [];
  project.scenes.forEach((scene, si) => {
    for (const el of scene.elements) {
      rows.push({
        scene: si,
        id: el.id,
        kind: el.kind,
        x: el.x,
        y: el.y,
        w: el.w,
        h: el.h,
        entranceEnd: el.anim.start + el.anim.duration,
        ...(el.exit ? { exitEnd: el.exit.start + el.exit.duration } : {}),
      });
    }
  });
  return rows;
}
