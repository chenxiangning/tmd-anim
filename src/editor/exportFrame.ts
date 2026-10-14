import type { Project } from "../core/types";
import { drawFrame } from "../core/render";
import { downloadBlob } from "../export/download";

/** 文件名安全化:场景名可能含斜杠/空格等文件系统非法或干扰字符 */
function safeName(text: string): string {
  return (
    text
      .replace(/[\\/:*?"<>|\s]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "frame"
  );
}

/**
 * 当前帧 PNG 导出:离屏 canvas 上 drawFrame 画一帧,复用「预览即导出」唯一渲染路径。
 * 双落点:浏览器 downloadBlob;Tauri 后端另写 $HOME/.tmd-anim/frames/<id>-<场景>-<秒>.png
 * (t 用秒,一位小数)并返回绝对路径;浏览器只下载,返回文件名。
 */
export async function exportFrame(project: Project, t: number, label: string, id: string): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = project.canvas?.width ?? 1920;
  canvas.height = project.canvas?.height ?? 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建离屏画布");
  drawFrame(ctx, project, t);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("PNG 编码失败");
  const name = `${id}-${safeName(label)}-${t.toFixed(1)}s.png`;
  downloadBlob(blob, name);
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return name;
  const fs = await import("@tauri-apps/plugin-fs");
  const { homeDir, join } = await import("@tauri-apps/api/path");
  const dir = await join(await homeDir(), ".tmd-anim/frames");
  await fs.mkdir(dir, { recursive: true });
  const path = await join(dir, name);
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
  return path;
}
