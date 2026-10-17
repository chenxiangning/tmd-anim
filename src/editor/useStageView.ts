import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { ViewTransform } from "./stageOverlay";

/** 画布视口:基础 fit 布局 + 手动 zoom/pan 覆盖。滚轮缩放(绕指针),中键拖拽平移,Cmd/Ctrl+0 复位。 */

interface ManualView {
  zoom: number;
  panX: number;
  panY: number;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 10;

export function useStageView(wrapRef: RefObject<HTMLDivElement | null>, pw: number, ph: number) {
  const viewRef = useRef<ViewTransform>({ scale: 1, ox: 0, oy: 0 });
  const manualRef = useRef<ManualView | null>(null);
  const [view, setView] = useState<ViewTransform>(viewRef.current);

  /** fit 基准:容器尺寸 -> 画布铺满缩放与居中偏移 */
  const base = useCallback(
    (cw: number, ch: number): { scale: number; ox: number; oy: number } => {
      const scale = Math.min(cw / pw, ch / ph);
      return { scale, ox: (cw - pw * scale) / 2, oy: (ch - ph * scale) / 2 };
    },
    [pw, ph],
  );

  /** 当前容器尺寸下的最终视图(手动 zoom/pan 叠加在 fit 基准上) */
  const computeView = useCallback(
    (cw: number, ch: number): ViewTransform => {
      const b = base(cw, ch);
      const m = manualRef.current;
      return m ? { scale: b.scale * m.zoom, ox: b.ox + m.panX, oy: b.oy + m.panY } : { scale: b.scale, ox: b.ox, oy: b.oy };
    },
    [base],
  );

  const commitManual = useCallback((next: ManualView | null, cw: number, ch: number) => {
    manualRef.current = next;
    const v = computeView(cw, ch);
    viewRef.current = v;
    setView(v);
  }, [computeView]);

  /** 滚轮缩放:绕指针点,clamp 绝对 scale;传入容器尺寸避免依赖渲染时机 */
  const zoomAt = useCallback(
    (clientX: number, clientY: number, deltaY: number) => {
      const wrap = wrapRef.current;
      const canvas = wrap?.querySelector("canvas");
      if (!wrap || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const v = viewRef.current;
      const factor = Math.exp(-deltaY * 0.0012);
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
      const lx = (clientX - rect.left - v.ox) / v.scale;
      const ly = (clientY - rect.top - v.oy) / v.scale;
      const ox = clientX - rect.left - lx * scale;
      const oy = clientY - rect.top - ly * scale;
      const b = base(wrap.clientWidth, wrap.clientHeight);
      commitManual({ zoom: scale / b.scale, panX: ox - b.ox, panY: oy - b.oy }, wrap.clientWidth, wrap.clientHeight);
    },
    [base, commitManual, wrapRef],
  );

  /** 中键平移手势:按下时开始,窗口级 move/up 跟踪;回调式接入组件的指针事件 */
  const panStateRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const beginPan = useCallback((clientX: number, clientY: number) => {
    const m = manualRef.current ?? { zoom: 1, panX: 0, panY: 0 };
    panStateRef.current = { x: clientX, y: clientY, panX: m.panX, panY: m.panY };
  }, []);
  const movePan = useCallback(
    (clientX: number, clientY: number) => {
      const s = panStateRef.current;
      const wrap = wrapRef.current;
      if (!s || !wrap) return;
      const m = manualRef.current ?? { zoom: 1, panX: 0, panY: 0 };
      commitManual({ ...m, panX: s.panX + clientX - s.x, panY: s.panY + clientY - s.y }, wrap.clientWidth, wrap.clientHeight);
    },
    [commitManual, wrapRef],
  );
  const endPan = useCallback(() => {
    panStateRef.current = null;
  }, []);

  const reset = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    commitManual(null, wrap.clientWidth, wrap.clientHeight);
  }, [commitManual, wrapRef]);

  /** Cmd/Ctrl+0 复位视图(吃掉浏览器整页缩放复位) */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "0") {
        e.preventDefault();
        reset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reset]);

  return { view, setView, viewRef, computeView, zoomAt, beginPan, movePan, endPan, reset };
}
