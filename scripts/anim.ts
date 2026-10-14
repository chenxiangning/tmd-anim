#!/usr/bin/env node
/**
 * anim CLI:项目 JSON 校验 + 统计,给 coding agent 改完文件后自查用。
 * 用法:pnpm anim validate <file...> [--json]
 * 退出码:0 = 结构合法(lint 警告不算错误);2 = 结构错误或用法错误。
 * 不做 node 侧渲染:渲染唯一路径在 src/core/render(需浏览器 canvas)。
 */
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { ELEMENT_KINDS, ProjectParseError, normalizeProject } from "../src/core/normalize";
import { projectDuration } from "../src/core/timeline";
import type { Project } from "../src/core/types";

/** lint 警告:normalize 会静默吞掉、但 agent 应当知道的问题 */
export interface LintIssue {
  /** 场景下标,0 起 */
  scene: number;
  /** 元素 id(原始 JSON 缺 id 时给占位) */
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

interface FileReport {
  file: string;
  /** 结构是否合法(false = 退出码 2) */
  ok: boolean;
  error?: string;
  stats?: ProjectStats;
  issues: LintIssue[];
}

/** asRecord 轻量版:仅判「对象但非数组」,字段类型由各 lint 规则自行 typeof 检查 */
function asObject(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/**
 * 对归一化前的原始 JSON 做 lint:专报 normalize 会静默修复或跳过的五类问题:
 * 未知 kind、connector 悬空绑定、坐标越界(connector/arrayCells 的 w/h 是占位,跳过)、
 * anim.start 负值、空 text。
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
      if (!placeholder && numeric && (e.x < 0 || e.y < 0 || e.x + e.w > cw || e.y + e.h > ch)) {
        issues.push({
          ...at,
          message: `包围盒 (x,y,w,h)=(${e.x},${e.y},${e.w},${e.h}) 超出画布 ${cw}x${ch},超出部分不可见`,
        });
      }
      const anim = asObject(e.anim) ?? {};
      if (typeof anim.start === "number" && anim.start < 0) {
        issues.push({ ...at, message: `anim.start=${anim.start} 为负数,归一化会钳到 0,入场时刻与预期不符` });
      }
      if (typeof e.text === "string" && e.text.trim().length === 0) {
        issues.push({ ...at, message: "text 为空(或仅空白),渲染为空内容" });
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

async function validateFile(file: string): Promise<FileReport> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (e) {
    return { file, ok: false, error: `读取失败:${e instanceof Error ? e.message : String(e)}`, issues: [] };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { file, ok: false, error: `JSON 解析失败:${e instanceof SyntaxError ? e.message : String(e)}`, issues: [] };
  }
  try {
    return { file, ok: true, stats: statsOf(normalizeProject(raw)), issues: lintProject(raw) };
  } catch (e) {
    return { file, ok: false, error: e instanceof ProjectParseError ? e.message : String(e), issues: [] };
  }
}

function printReport(r: FileReport): void {
  if (!r.ok) {
    console.error(`[结构错误] ${r.file}\n  ${r.error}`);
    return;
  }
  const s = r.stats;
  const kinds = Object.entries(s?.kinds ?? {})
    .map(([k, n]) => `${k} x${n}`)
    .join(", ");
  console.log(`[通过] ${r.file}`);
  console.log(`  ${s?.scenes} 场景 / ${s?.elements} 元素 / ${s?.duration.toFixed(2)}s / ${kinds || "无元素"}`);
  if (r.issues.length === 0) {
    console.log("  lint 干净");
    return;
  }
  for (const issue of r.issues) {
    console.warn(`  [警告] 场景${issue.scene + 1}/${issue.element}:${issue.message}`);
  }
  console.warn(`  共 ${r.issues.length} 条 lint 警告(退出码仍为 0)`);
}

async function runCli(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  if (cmd !== "validate") {
    console.error("用法:pnpm anim validate <file...> [--json]");
    return 2;
  }
  const json = rest.includes("--json");
  const files = rest.filter((a) => a !== "--json");
  if (files.length === 0) {
    console.error("用法:pnpm anim validate <file...> [--json]");
    return 2;
  }
  const reports = await Promise.all(files.map(validateFile));
  if (json) {
    const ok = reports.every((r) => r.ok);
    console.log(JSON.stringify({ ok, files: reports }, null, 2));
  } else {
    for (const r of reports) printReport(r);
  }
  return reports.some((r) => !r.ok) ? 2 : 0;
}

// 仅直接执行时进 CLI;被测试/vitest 导入时不产生副作用
const invoked = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (invoked) {
  void runCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
