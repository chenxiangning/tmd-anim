import { useCallback, useRef, useState } from "react";

export interface PanelSizeOpts {
  /** 拖拽影响轴:x = 宽度(侧栏),y = 高度(底部面板) */
  axis: "x" | "y";
  /** localStorage 持久化键 */
  key: string;
  def: number;
  min: number;
  /** 上限 = 对应视口轴 × maxRatio */
  maxRatio: number;
  /** 尺寸增量 = 指针轴向位移 × dir;把手在面板右/下缘用 1,左/上缘用 -1 */
  dir: 1 | -1;
}

/**
 * 面板尺寸拖拽:把手 pointerdown 后按手势起点绝对求值,更新经 rAF 合帧
 * (每屏至多一次 re-render,高回报率鼠标下也保持跟手丝滑),松手持久化,
 * 双击复位。纯 UI 尺寸,不进项目数据与撤销历史。
 */
export function usePanelResize({ axis, key, def, min, maxRatio, dir }: PanelSizeOpts) {
  const clampSize = useCallback(
    (v: number): number => {
      const vp = axis === "x" ? window.innerWidth : window.innerHeight;
      const max = Math.max(min, Math.round(vp * maxRatio));
      return Math.min(max, Math.max(min, Math.round(v)));
    },
    [axis, min, maxRatio],
  );

  const [size, setSize] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return clampSize(Number(raw));
    } catch {
      // 忽略存储失败,回落默认尺寸
    }
    return def;
  });
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const persist = useCallback(
    (v: number) => {
      try {
        localStorage.setItem(key, String(v));
      } catch {
        // 忽略存储失败
      }
    },
    [key],
  );

  const startResize = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const startPos = axis === "x" ? e.clientX : e.clientY;
      const startSize = sizeRef.current;
      let target = startSize;
      let raf = 0;
      const apply = () => {
        raf = 0;
        setSize(target);
      };
      const onMove = (ev: PointerEvent) => {
        const pos = axis === "x" ? ev.clientX : ev.clientY;
        target = clampSize(startSize + (pos - startPos) * dir);
        if (!raf) raf = requestAnimationFrame(apply);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        if (raf) cancelAnimationFrame(raf);
        setSize(target);
        persist(target);
      };
      // 手势期间锁光标与选区:指针滑出把手也持续生效,且不选中面板文字
      document.body.style.cursor = axis === "x" ? "ew-resize" : "row-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [axis, clampSize, dir, persist],
  );

  const resetSize = useCallback(() => {
    setSize(def);
    persist(def);
  }, [def, persist]);

  return { size, startResize, resetSize };
}
