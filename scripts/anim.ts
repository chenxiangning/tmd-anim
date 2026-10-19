#!/usr/bin/env node
/**
 * anim CLI:项目 JSON 校验 + 统计 + 布局报告,给 coding agent 改完文件后自查用。
 * 用法:pnpm anim validate <file...> [--json] [--layout]
 * 退出码:0 = 结构合法(lint 警告不算错误);2 = 结构错误或用法错误。
 * 不做 node 侧渲染:渲染唯一路径在 src/core/render(需浏览器 canvas)。
 * lint/统计/布局实现位于 src/core/lint.ts(与应用内 AI 提示词共用)。
 */
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { ProjectParseError, normalizeProject } from "../src/core/normalize";
import { layoutOf, lintProject, statsOf, type LayoutRow, type LintIssue, type ProjectStats } from "../src/core/lint";

export { layoutOf, lintProject, statsOf };
export type { LayoutRow, LintIssue, ProjectStats };

interface FileReport {
  file: string;
  /** 结构是否合法(false = 退出码 2) */
  ok: boolean;
  error?: string;
  stats?: ProjectStats;
  issues: LintIssue[];
  /** --layout 时输出:归一化后的元素落位与生命周期 */
  layout?: LayoutRow[];
}

async function validateFile(file: string, withLayout = false): Promise<FileReport> {
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
    const project = normalizeProject(raw);
    return {
      file,
      ok: true,
      stats: statsOf(project),
      issues: lintProject(raw),
      ...(withLayout ? { layout: layoutOf(project) } : {}),
    };
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
  } else {
    for (const issue of r.issues) {
      console.warn(`  [警告] 场景${issue.scene + 1}/${issue.element}:${issue.message}`);
    }
    console.warn(`  共 ${r.issues.length} 条 lint 警告(退出码仍为 0)`);
  }
  if (r.layout) {
    console.log(`  布局报告 ${r.layout.length} 行(--json 取结构化):`);
    for (const row of r.layout) {
      console.log(
        `    sc${row.scene + 1} ${row.id} [${row.kind}] (${row.x},${row.y}) ${row.w}x${row.h} 入场止 ${row.entranceEnd.toFixed(2)}s${row.exitEnd !== undefined ? ` 离场止 ${row.exitEnd.toFixed(2)}s` : ""}`,
      );
    }
  }
}

async function runCli(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  if (cmd !== "validate") {
    console.error("用法:pnpm anim validate <file...> [--json] [--layout]");
    return 2;
  }
  const json = rest.includes("--json");
  const withLayout = rest.includes("--layout");
  const files = rest.filter((a) => a !== "--json" && a !== "--layout");
  if (files.length === 0) {
    console.error("用法:pnpm anim validate <file...> [--json] [--layout]");
    return 2;
  }
  const reports = await Promise.all(files.map((f) => validateFile(f, withLayout)));
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
