import { useEffect, type RefObject } from "react";
import type { Project } from "../core/types";
import { projectDuration } from "../core/timeline";

/** 单页只允许一个活跃时钟:StrictMode 双挂载/重复渲染时不叠加出倍速播放头 */
let clockRunning = false;

/**
 * 播放循环:驱动播放头,播完循环。时间在 setState 的函数式更新里累计,总是接在
 * 真实最新值之后——渲染掉帧不会让播放头系统性慢于墙钟(旧实现按渲染态累加 dt,
 * 渲染一慢播放头就滞后,配音对齐被迫反复回拉,听感断续);updater 是纯函数,
 * StrictMode 双调用幂等。外部挪动播放头(拖时间线/重播/擦洗)无需特判,下一帧
 * 自然从新值继续累计。页面隐藏时 rAF 停走而音频元素继续播,恢复后必然漂移:
 * 切后台统一暂停。
 */
export function usePlaybackClock(
  playing: boolean,
  projectRef: RefObject<Project>,
  setT: (update: (prev: number) => number) => void,
  pause: (v: boolean) => void,
): void {
  useEffect(() => {
    const onHidden = (): void => {
      if (document.hidden) pause(false);
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, [pause]);

  useEffect(() => {
    if (!playing || clockRunning) return;
    clockRunning = true;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      setT((prev) => {
        const total = projectDuration(projectRef.current);
        return total > 0 && prev + dt >= total ? 0 : prev + dt;
      });
    };
    raf = requestAnimationFrame(loop);
    return () => {
      clockRunning = false;
      cancelAnimationFrame(raf);
    };
  }, [playing, projectRef, setT]);
}
