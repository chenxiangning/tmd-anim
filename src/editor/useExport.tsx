import { useCallback, useRef, useState, type RefObject } from "react";
import type { Project } from "../core/types";
import { projectDuration } from "../core/timeline";
import { buildStandaloneHtml } from "../export/htmlExport";
import { downloadBlob } from "../export/download";
import type { ExportProgress, VideoExportJob } from "../export/videoExport";

/**
 * 导出中枢:JSON 下载 / 单文件 HTML 动画 / MP4 视频。
 * MP4 先弹二次确认(时长/帧数/分辨率与耗时预期),确认后后台 Worker 导出,
 * 进度实时显示并估算剩余时间;取消 = terminate Worker,即时生效。
 * UI 组件 ExportOverlay 与本 hook 同文件,EditorView 只接两个调用点。
 * mediabunny 较大,视频编码按需动态加载,不进主包。
 * 所有导出先画遮罩再干活(至少让出一拍),用户永远有即时反馈。
 */

export interface VideoExportConfirm {
  durationSec: number;
  frames: number;
  width: number;
  height: number;
  fps: number;
}

export interface ExportState {
  busy:
    | null
    | { kind: "json" }
    | { kind: "html" }
    | { kind: "video"; stage: "prepare" | "encode"; ratio: number; etaSec: number | null };
  /** 待二次确认的 MP4 导出(开始前弹窗说明效果) */
  confirming: VideoExportConfirm | null;
  /** 已请求取消,等待收尾(Worker 路径下几乎瞬时;仅主线程回退路径会短暂出现) */
  cancelling: boolean;
  error: string | null;
  runJson(): void;
  runHtml(): void;
  beginVideo(): void;
  startVideo(): void;
  dismissConfirm(): void;
  cancel(): void;
  dismiss(): void;
}

const EXPORT_FPS = 30;
const safeName = (project: Project): string => (project.name || "tmd-anim").replace(/[\\/:*?"<>|]/g, "_");

/** 让出一拍让遮罩先画出来;setTimeout 宏任务在后台标签页也能跑 */
const paintBeat = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 50));

export function useExport(
  projectRef: RefObject<Project>,
  options: { pausePlayback?: () => void } = {},
): ExportState {
  const [busy, setBusy] = useState<ExportState["busy"]>(null);
  const [confirming, setConfirming] = useState<VideoExportConfirm | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const jobRef = useRef<VideoExportJob | null>(null);
  const encodeStartRef = useRef(0);

  const runJson = useCallback(() => {
    const project = projectRef.current;
    const text = JSON.stringify(project, null, 2);
    downloadBlob(new Blob([text], { type: "application/json" }), `${safeName(project)}.json`);
  }, [projectRef]);

  const runHtml = useCallback(() => {
    if (busy) return;
    setError(null);
    setBusy({ kind: "html" });
    const project = projectRef.current;
    // 先让遮罩画出来再构建,避免同步构建让用户感觉「点了没反应」
    void paintBeat()
      .then(() => downloadBlob(new Blob([buildStandaloneHtml(project)], { type: "text/html" }), `${safeName(project)}.html`))
      .catch((err) => setError(String(err)))
      .finally(() => setBusy(null));
  }, [busy, projectRef]);

  const beginVideo = useCallback(() => {
    if (busy) return;
    const project = projectRef.current;
    const durationSec = projectDuration(project);
    setConfirming({
      durationSec,
      frames: Math.max(1, Math.round(durationSec * EXPORT_FPS)),
      width: project.canvas?.width ?? 1920,
      height: project.canvas?.height ?? 1080,
      fps: EXPORT_FPS,
    });
  }, [busy, projectRef]);

  const dismissConfirm = useCallback(() => setConfirming(null), []);

  const startVideo = useCallback(() => {
    if (busy) return;
    setConfirming(null);
    cancelledRef.current = false;
    setCancelling(false);
    setError(null);
    setBusy({ kind: "video", stage: "prepare", ratio: 0, etaSec: null });
    encodeStartRef.current = 0;
    // 导出曾与播放共用主线程渲染;Worker 化后预览已不受影响,停播只为避免看混淆
    options.pausePlayback?.();
    const project = projectRef.current;
    let modIsCancelled: (err: unknown) => boolean = () => false;
    void import("../export/videoExport")
      .then((mod) => {
        modIsCancelled = mod.isCancelledError;
        const onProgress = (info: ExportProgress) =>
          setBusy((prev) => {
            if (prev?.kind !== "video") return prev;
            let etaSec = prev.etaSec;
            if (info.stage === "encode") {
              if (encodeStartRef.current === 0) encodeStartRef.current = performance.now();
              const elapsed = performance.now() - encodeStartRef.current;
              // 线性外推:总耗时 = 已用时间 / 已完成比例
              etaSec = info.ratio > 0.02 ? (elapsed / info.ratio) * (1 - info.ratio) / 1000 : null;
            }
            return { kind: "video", stage: info.stage, ratio: info.ratio, etaSec };
          });
        const job = mod.startVideoExport(project, {
          onProgress,
          cancelled: () => cancelledRef.current,
        });
        jobRef.current = job;
        return job.promise;
      })
      .then((blob) => downloadBlob(blob, `${safeName(project)}.mp4`))
      .catch((err) => {
        if (!modIsCancelled(err)) setError(String(err));
      })
      .finally(() => {
        jobRef.current = null;
        setBusy(null);
        setCancelling(false);
      });
  }, [busy, options, projectRef]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    setCancelling(true);
    // Worker 路径:terminate 后 promise 立刻 reject,遮罩即时关闭
    jobRef.current?.cancel();
  }, []);

  const dismiss = useCallback(() => setError(null), []);

  return { busy, confirming, cancelling, error, runJson, runHtml, beginVideo, startVideo, dismissConfirm, cancel, dismiss };
}

/** 导出确认弹窗 / 进行中遮罩 / 失败提示 */
export function ExportOverlay({ state }: { state: ExportState }) {
  if (state.error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40" onClick={state.dismiss}>
        <div className="max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <div className="mb-2 text-sm font-semibold text-red-600">导出失败</div>
          <div className="mb-4 break-all text-xs text-neutral-600">{state.error}</div>
          <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white" onClick={state.dismiss}>
            知道了
          </button>
        </div>
      </div>
    );
  }
  if (state.confirming) return <VideoConfirmDialog info={state.confirming} state={state} />;
  if (!state.busy) return null;
  if (state.busy.kind === "video") return <VideoProgressOverlay state={state} />;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40">
      <div className="w-72 rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-neutral-800">
          <span className="h-2 w-2 animate-pulse rounded-full bg-slate-900" />
          {state.busy.kind === "html" ? "正在生成 HTML 动画…" : "正在导出 JSON…"}
        </div>
        {state.busy.kind === "html" && (
          <button className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-400" disabled>
            生成中,稍候…
          </button>
        )}
      </div>
    </div>
  );
}

/** MP4 导出前的二次确认:说清产物规格与耗时预期 */
function VideoConfirmDialog({ info, state }: { info: VideoExportConfirm; state: ExportState }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40" onClick={state.dismissConfirm}>
      <div className="w-80 rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 text-sm font-semibold text-neutral-800">导出 MP4 视频</div>
        <div className="mb-3 space-y-1 text-xs text-neutral-600">
          <div>
            时长 {info.durationSec.toFixed(1)} 秒 · 共 {info.frames} 帧({info.fps} fps)
          </div>
          <div>
            分辨率 {info.width}×{info.height} · H.264 编码
            {info.durationSec > 0 && ` · 含全部 ${info.frames} 帧逐帧渲染`}
          </div>
        </div>
        <div className="mb-4 rounded-lg bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-500">
          逐帧渲染在后台进行,通常需要几秒到几分钟(取决于时长与机器);期间可以继续编辑,随时可取消。完成后自动下载 .mp4 文件。
        </div>
        <div className="flex gap-2">
          <button
            className="flex-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50"
            onClick={state.dismissConfirm}
          >
            暂不导出
          </button>
          <button
            className="flex-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-700"
            onClick={state.startVideo}
          >
            开始导出
          </button>
        </div>
      </div>
    </div>
  );
}

/** MP4 导出进行中:阶段 + 百分比 + 剩余时间估算 + 取消 */
function VideoProgressOverlay({ state }: { state: ExportState }) {
  const busy = state.busy;
  if (busy?.kind !== "video") return null;
  const { stage, ratio, etaSec } = busy;
  const pct = Math.round(ratio * 100);
  const label = state.cancelling
    ? "正在取消…"
    : stage === "prepare"
      ? "正在准备配音与图片素材…"
      : `正在编码视频… ${pct}%`;
  const eta =
    !state.cancelling && stage === "encode" && etaSec !== null && ratio < 1
      ? `预计剩余约 ${Math.max(1, Math.round(etaSec))} 秒`
      : null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40">
      <div className="w-72 rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-3 text-sm font-medium text-neutral-800">{label}</div>
        <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-neutral-100">
          <div
            className={`h-full rounded-full bg-slate-900 ${stage === "prepare" && !state.cancelling ? "w-1/3 animate-pulse" : "transition-[width] duration-150"}`}
            style={stage === "prepare" && !state.cancelling ? undefined : { width: `${Math.max(ratio * 100, 4)}%` }}
          />
        </div>
        <div className="mb-3 h-4 text-xs text-neutral-500">{eta ?? (stage === "encode" ? `${pct}%` : "")}</div>
        <button
          className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-400"
          disabled={state.cancelling}
          onClick={state.cancel}
        >
          {state.cancelling ? "正在中止…" : "取消"}
        </button>
      </div>
    </div>
  );
}
