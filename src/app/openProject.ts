import type { Project } from "../core/types";
import { ProjectParseError, normalizeProject } from "../core/normalize";

/** 项目文件载入:JSON 文本 -> 归一化 Project;错误统一转成可读中文提示。 */

export function parseProjectText(text: string): Project {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new ProjectParseError(`JSON 解析失败:${e instanceof SyntaxError ? e.message : String(e)}`);
  }
  return normalizeProject(raw);
}

export async function readProjectFile(file: File): Promise<Project> {
  return parseProjectText(await file.text());
}

export function describeError(e: unknown): string {
  if (e instanceof ProjectParseError) return e.message;
  return String(e);
}
