import { useEffect } from "react";
import type { Project } from "../core/types";
import { projectDuration, sceneStartTime } from "../core/timeline";
import { addElements, findElement, removeElements, updateElement } from "./editOps";
import { copyElements, pasteElements } from "./clipboard";
import type { ProjectRepo } from "../store/projects";

interface KeyboardOptions {
  repo: ProjectRepo;
  projectId: string;
  getProject(): Project;
  getSelIds(): string[];
  getIdx(): number;
  setT(v: number | ((prev: number) => number)): void;
  setSel(ids: string[]): void;
  clearSel(): void;
  setPlaying(v: boolean | ((prev: boolean) => boolean)): void;
  setPreviewing(v: boolean): void;
  commit(next: Project, coalesceKey?: string): void;
  undo(): void;
}

/** 编辑器全局键盘:删除/复制剪切粘贴/撤销/保存/播放暂停/方向键(有选中微移元素,无选中擦洗时间)。 */
export function useEditorKeyboard(opts: KeyboardOptions): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target;
      const inInput = target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        if (!inInput) {
          e.preventDefault();
          opts.undo();
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void opts.repo.save(opts.projectId, opts.getProject());
        return;
      }
      if (inInput) return;
      if (e.key === "Escape") {
        opts.setPreviewing(false);
        opts.clearSel();
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        opts.setPlaying((p) => !p);
        return;
      }
      const selIds = opts.getSelIds();
      const idx = opts.getIdx();
      if ((e.metaKey || e.ctrlKey) && ["c", "x", "v"].includes(e.key.toLowerCase())) {
        e.preventDefault();
        if (e.key.toLowerCase() === "v") {
          const pasted = pasteElements();
          if (pasted.length === 0) return;
          opts.commit(addElements(opts.getProject(), idx, pasted));
          opts.setSel(pasted.map((el) => el.id));
          // 播放头若在粘贴元素动画终点之前,元素还不可见;挪到终点保证立即可见
          const start = sceneStartTime(opts.getProject(), idx);
          const endT = Math.max(...pasted.map((el) => start + el.anim.start + el.anim.duration));
          opts.setT((cur) => (cur < endT ? endT : cur));
          return;
        }
        const els = selIds.map((id) => findElement(opts.getProject(), idx, id)).filter((el) => el !== null);
        if (els.length === 0) return;
        copyElements(els);
        if (e.key.toLowerCase() === "x") {
          opts.commit(removeElements(opts.getProject(), idx, selIds));
          opts.clearSel();
        }
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selIds.length > 0) {
        e.preventDefault();
        opts.commit(removeElements(opts.getProject(), idx, selIds));
        opts.clearSel();
        return;
      }
      if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        if (selIds.length > 0) {
          const step = e.shiftKey ? 10 : 1;
          const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          let next = opts.getProject();
          for (const id of selIds) {
            const cur = findElement(next, idx, id);
            if (cur) next = updateElement(next, idx, id, { x: cur.x + dx, y: cur.y + dy });
          }
          opts.commit(next, `nudge:${[...selIds].sort().join(",")}`);
        } else {
          const step = e.shiftKey ? 1 : 0.2;
          const total = projectDuration(opts.getProject());
          opts.setT((v) => Math.min(Math.max(0, v + (e.key === "ArrowRight" ? step : -step)), Math.max(0, total - 0.01)));
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // 状态经 getter 读取,监听只随仓库/回调变化重挂
  }, [opts.repo, opts.projectId, opts.commit, opts.undo]);
}
